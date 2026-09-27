import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

import { TEMP_ROOT } from "@/lib/instagram/service";
import { isJobId } from "@/lib/security/identifiers";
import { rateLimiters } from "@/lib/security/service";
import { clientIp } from "@/lib/instagram/http";

export const runtime = "nodejs";

const MIME_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".webm": "video/webm",
  ".avi": "video/x-msvideo",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".gif": "image/gif",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
};

/**
 * Resolve a requested filename to a path inside the job directory, or null if
 * the request cannot possibly refer to a file this service produced.
 */
function resolveJobFile(jobId: string, filename: string): string | null {
  if (!isJobId(jobId)) return null;

  // yt-dlp only ever writes flat filenames into the job directory, so a
  // separator in the request is a malformed request rather than a missing file.
  if (filename.includes("/") || filename.includes("\\")) return null;

  const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!cleanName || cleanName.includes("..")) return null;

  const jobDir = path.join(TEMP_ROOT, jobId);
  const filePath = path.join(jobDir, cleanName);

  // Defence in depth: the checks above already prevent this.
  if (!filePath.startsWith(jobDir + path.sep)) return null;

  return filePath;
}

/**
 * GET /api/download/[jobId]/[filename]
 * Serve a processed output file.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string; filename: string }> }
) {
  try {
    const { jobId, filename } = await params;
    if (!isJobId(jobId)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    }

    const ip = clientIp(request);
    if (!rateLimiters.instagramFile.isAllowed(ip).allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    const filePath = resolveJobFile(jobId, filename);
    if (!filePath) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // lstat, not stat: a symlink reports as a file only after following it, and
    // the target could sit outside the job directory.
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Not a file" }, { status: 400 });
    }

    const cleanName = path.basename(filePath);
    const contentType = MIME_TYPES[path.extname(cleanName).toLowerCase()] || "application/octet-stream";

    // Stream rather than readFileSync: an output file is capped at hundreds of
    // megabytes, and buffering one per request is an easy way to exhaust heap.
    const stream = Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream;

    return new NextResponse(stream, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(stat.size),
        "Content-Disposition": `attachment; filename="${cleanName}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json({ error: "Failed to download file" }, { status: 500 });
  }
}
