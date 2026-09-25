import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import os from "os";

import { rateLimiters, ALLOWED_FILE_TYPES, MAX_FILE_SIZE, sanitizeFilename } from "@/lib/security/service";

const TEMP_DIR = path.join(os.tmpdir(), "videotoolkit", "temp");
export const runtime = "nodejs";

/**
 * POST /api/upload
 * Upload a video/audio file and return a job ID.
 */
export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const limiter = rateLimiters.upload;
    const rate = limiter.isAllowed(`ip:${ip}`);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `Too many uploads. Try again in ${Math.ceil((rate.resetTime.getTime() - Date.now()) / 1000)} seconds`,
        },
        { status: 429 }
      );
    }

    const data = await request.formData();
    const file = data.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE.upload) {
      return NextResponse.json(
        {
          error: "File too large",
          message: `Maximum file size is ${(MAX_FILE_SIZE.upload / 1024 / 1024).toFixed(0)}MB`,
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: "Invalid file type",
          message: "Only video and audio files are allowed",
        },
        { status: 400 }
      );
    }

    const sanitized = sanitizeFilename(file.name);
    if (!sanitized.safeToProcess) {
      return NextResponse.json(
        { error: "Invalid filename", warnings: sanitized.warnings },
        { status: 400 }
      );
    }

    const jobId = crypto.randomUUID();
    const jobDir = path.join(TEMP_DIR, jobId);
    fs.mkdirSync(jobDir, { recursive: true });

    const filePath = path.join(jobDir, sanitized.sanitizedName);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    return NextResponse.json({
      success: true,
      jobId,
      filename: sanitized.sanitizedName,
      size: file.size,
      message: "File uploaded successfully",
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Failed to upload file. Please try again." }, { status: 500 });
  }
}