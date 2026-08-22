import { NextResponse } from "next/server";
import { execFile } from "child_process";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";

import { FfmpegService } from "@/lib/ffmpeg/service";

const TEMP_DIR = path.join(os.tmpdir(), "videotoolkit", "temp");
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB limit for conversions

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const file = data.get("file") as File | null;
    const outputFormat = data.get("format") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!outputFormat) {
      return NextResponse.json(
        { error: "Output format required" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 500MB." },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("video/") && file.type !== "audio/mp3") {
      return NextResponse.json(
        { error: "Invalid file type. Only video and audio files are allowed." },
        { status: 400 }
      );
    }

    // Create unique job ID and temporary directories
    const jobId = uuidv4();
    const jobDir = path.join(TEMP_DIR, jobId);
    const inputPath = path.join(jobDir, file.name);

    // Ensure temp directory exists
    os.mkdirSync(jobDir, { recursive: true });

    // Save uploaded file
    const buffer = Buffer.from(await file.arrayBuffer());
    await new Promise<void>((resolve, reject) => {
      const fs = require("fs");
      fs.writeFile(inputPath, buffer, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Probe the input file to get metadata
    let metadata: FfmpegService["probe"](string) | null = null;
    try {
      metadata = await FfmpegService.probe(inputPath);
    } catch (probeError) {
      // Continue even if probe fails - we'll use defaults
      console.warn("FFprobe probe failed, using defaults:", probeError);
    }

    // Return job ID immediately for async processing
    return NextResponse.json({
      success: true,
      jobId,
      filename: file.name,
      size: file.size,
      hasMetadata: metadata !== null,
      message: "Conversion job started",
    });
  } catch (error) {
    console.error("Conversion start error:", error);
    return NextResponse.json(
      { error: "Failed to start conversion" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID required" },
        { status: 400 }
      );
    }

    const jobDir = path.join(TEMP_DIR, jobId);
    const outputPath = path.join(jobDir, "output.mp4");

    // Check if output exists
    if (os.existsSync(outputPath)) {
      // Read output file size
      const outputSize = os.statSync(outputPath).size;

      return NextResponse.json({
        success: true,
        jobId,
        status: "completed",
        outputUrl: `/api/download/${jobId}/output.mp4`,
        outputSize,
      });
    }

    // Check if input still exists (job in progress)
    const inputPath = path.join(jobDir, "input.mp4");
    if (os.existsSync(inputPath)) {
      return NextResponse.json({
        success: true,
        jobId,
        status: "processing",
        message: "Conversion in progress",
      });
    }

    // Job not found or completed cleanup
    return NextResponse.json({
      success: false,
      jobId,
      status: "not_found",
      message: "Job not found or already cleaned up",
    });
  } catch (error) {
    console.error("Conversion status check error:", error);
    return NextResponse.json(
      { error: "Failed to check conversion status" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID required" },
        { status: 400 }
      );
    }

    const jobDir = path.join(TEMP_DIR, jobId);

    if (os.existsSync(jobDir)) {
      // Delete directory and all contents
      const fs = require("fs");
      fs.rmSync(jobDir, { recursive: true, force: true });
    }

    return NextResponse.json({
      success: true,
      jobId,
      message: "Job cleaned up",
    });
  } catch (error) {
    console.error("Job cleanup error:", error);
    return NextResponse.json(
      { error: "Failed to clean up job" },
      { status: 500 }
    );
  }
}