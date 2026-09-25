import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

import { rateLimiters } from "@/lib/security/service";
import { TEMP_ROOT } from "@/lib/instagram/service";

export const runtime = "nodejs";

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

    // Validate job ID format (UUID)
    if (!/^[a-f0-9-]{36}$/i.test(jobId)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    }

    // Sanitize filename - prevent path traversal
    const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    if (!cleanName || cleanName.includes("..")) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const jobDir = path.join(TEMP_ROOT, jobId);
    const filePath = path.join(jobDir, cleanName);

    // Ensure the resolved path is still inside the job directory
    if (!filePath.startsWith(jobDir + path.sep)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Not a file" }, { status: 400 });
    }

    const data = fs.readFileSync(filePath);

    // Determine MIME type from extension
    const ext = path.extname(cleanName).toLowerCase();
    const mimeTypes: Record<string, string> = {
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
    const contentType = mimeTypes[ext] || "application/octet-stream";

    return new NextResponse(data, {
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