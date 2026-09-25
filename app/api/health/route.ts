import { NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";

import { FfmpegService, ffmpegCheck, ffprobeCheck } from "@/lib/ffmpeg/service";

export const runtime = "nodejs";

export async function GET() {
  const checks: Record<string, { status: string; detail?: string }> = {
    ffmpeg: { status: "unknown" },
    ffprobe: { status: "unknown" },
    storage: { status: "unknown" },
    system: { status: "unknown" },
  };

  // Check FFmpeg
  const hasFfmpeg = await ffmpegCheck();
  checks.ffmpeg = hasFfmpeg
    ? { status: "available", detail: "FFmpeg binary found" }
    : { status: "unavailable", detail: "FFmpeg not found" };

  // Check FFprobe
  const hasFfprobe = await ffprobeCheck();
  checks.ffprobe = hasFfprobe
    ? { status: "available", detail: "FFprobe binary found" }
    : { status: "unavailable", detail: "FFprobe not found" };

  // Check storage
  try {
    const tempDir = path.join(os.tmpdir(), "videotoolkit", "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    checks.storage = { status: "available" };
  } catch {
    checks.storage = { status: "error", detail: "Cannot access temporary storage" };
  }

  // System check
  try {
    await FfmpegService.ensureDirectories();
    checks.system = { status: "ok", detail: "FFmpeg service initialized" };
  } catch (error) {
    checks.system = {
      status: "error",
      detail: error instanceof Error ? error.message : "Unknown error",
    };
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