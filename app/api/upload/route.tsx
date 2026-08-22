import { NextResponse } from "next/server";
import { execFile } from "child_process";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";

import { FfmpegService } from "@/lib/ffmpeg/service";
import { validateURL, sanitizeFilename } from "@/lib/security/service";
import { rateLimiters } from "@/lib/security/service";

const TEMP_DIR = path.join(os.tmpdir(), "videotoolkit", "temp");
const MAX_FILE_SIZE = 1 * 1024 * 1024 * 1024; // 1GB

export const config = {
  api: {
    bodyParser: false,
  },
};

/** Apply rate limiting middleware */
function applyRateLimit(limiter: any) {
  return async (request: Request) => {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const result = limiter.isAllowed(`ip:${ip}`);

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `Too many requests. Try again in ${Math.ceil(
            (result.resetTime.getTime() - Date.now()) / 1000
          )} seconds`,
        },
        { status: 429 }
      );
    }

    return null; // Continue processing
  };
}

export async function POST(request: Request) {
  try {
    // Apply rate limiting
    const rateLimitCheck = applyRateLimit(rateLimiters.upload)(request);
    if (rateLimitCheck) {
      return rateLimitCheck;
    }

    const data = await request.formData();
    const file = data.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: "File too large",
          message: `Maximum file size is ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(
            1
          )}MB`,
        },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: "Invalid file type",
          message: "Only video and audio files are allowed",
        },
        { status: 400 }
      );
    }

    // Sanitize filename
    const filenameResult = sanitizeFilename(file.name);

    if (!filenameResult.valid) {
      return NextResponse.json(
        {
          error: "Invalid filename",
          warnings: filenameResult.warnings,
        },
        { status: 400 }
      );
    }

    // Create unique job ID and temporary directories
    const jobId = uuidv4();
    const jobDir = path.join(TEMP_DIR, jobId);

    // Ensure temp directory exists
    os.mkdirSync(jobDir, { recursive: true });

    // Save uploaded file with sanitized name
    const filePath = path.join(jobDir, filenameResult.sanitizedName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await new Promise<void>((resolve, reject) => {
      const fs = require("fs");
      fs.writeFile(filePath, buffer, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    return NextResponse.json({
      success: true,
      jobId,
      filename: filenameResult.sanitizedName,
      size: file.size,
      message: "File uploaded successfully",
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

/* Array of allowed MIME types for validation */
const ALLOWED_FILE_TYPES = [
  "video/mp4",
  "video/mpeg",
  "video/quicktime",
  "video/x-mkv",
  "video/webm",
  "video/x-msvideo",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
];