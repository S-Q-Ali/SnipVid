import { NextResponse } from "next/server";
import path from "path";
import os from "os";
import fs from "fs";

import { FfmpegService } from "@/lib/ffmpeg/service";

export async function GET() {
  const checks: Record<string, { status: string; detail?: string }> = {
    "ffmpeg": { status: "unknown" },
    "ffprobe": { status: "unknown" },
    "storage": { status: "unknown" },
    "system": { status: "unknown" },
  };

  // Check FFmpeg
  try {
    const ffmpegPath = require.resolve("@ffmpeg-installer/lib/ffmpeg");
    checks.ffmpeg = { status: "available", detail: "FFmpeg binary found" };
  } catch {
    checks.ffmpeg = { status: "unavailable", detail: "FFmpeg not found" };
  }

  // Check FFprobe
  try {
    const ffprobePath = require.resolve("@ffmpeg-installer/lib/ffprobe");
    checks.ffprobe = { status: "available", detail: "FFprobe binary found" };
  } catch {
    checks.ffprobe = { status: "unavailable", detail: "FFprobe not found" };
  }

  // Check storage
  try {
    const tempDir = path.join(os.tmpdir(), "videotoolkit", "temp");
    if (fs.existsSync(tempDir)) {
      checks.storage = { status: "available" };
    } else {
      fs.mkdirSync(tempDir, { recursive: true });
      checks.storage = { status: "created" };
    }
  } catch {
    checks.storage = { status: "error", detail: "Cannot access temporary storage" };
  }

  // Run FFmpeg health check
  try {
    await FfmpegService.ensureDirectories();
    checks.system = { status: "ok", detail: "FFmpeg service initialized" };
  } catch (error) {
    checks.system = { status: "error", detail: error instanceof Error ? error.message : "Unknown error" };
  }

  const allOk = Object.values(checks).every(
    (check) => check.status !== "unavailable" && check.status !== "error"
  );

  return NextResponse.json({
    status: allOk ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    checks,
  });
}