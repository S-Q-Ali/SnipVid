import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import os from "os";

import { FfmpegService } from "@/lib/ffmpeg/service";
import { rateLimiters, ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from "@/lib/security/service";

const TEMP_DIR = path.join(os.tmpdir(), "videotoolkit", "temp");
export const runtime = "nodejs";

function checkRateLimit(request: Request, limiter: { isAllowed: (key: string) => { allowed: boolean; resetTime: Date } }) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const result = limiter.isAllowed(`ip:${ip}`);
  if (!result.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        message: `Too many requests. Try again in ${Math.ceil((result.resetTime.getTime() - Date.now()) / 1000)} seconds`,
      },
      { status: 429 }
    );
  }
  return null;
}

/**
 * Build FFmpeg arguments for a given operation.
 */
function buildArgs(
  inputPath: string,
  outputPath: string,
  operation: string,
  settings: Record<string, string | undefined>
): string[] {
  const ext = path.extname(outputPath).toLowerCase();

  switch (operation) {
    case "compress": {
      const quality = settings.quality || "balanced";
      const crf = quality === "small" ? "28" : quality === "high" ? "18" : "23";
      return [
        "-i", inputPath,
        "-c:v", "libx264",
        "-crf", crf,
        "-preset", "medium",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
      ];
    }
    case "resize": {
      const width = settings.width || "1280";
      const height = settings.height || "720";
      const maintainRatio = settings.maintainRatio !== "false";
      const filter = maintainRatio
        ? `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`
        : `scale=${width}:${height}`;
      return [
        "-i", inputPath,
        "-vf", filter,
        "-c:v", "libx264",
        "-crf", "23",
        "-preset", "medium",
        "-c:a", "aac",
        "-movflags", "+faststart",
      ];
    }
    case "trim": {
      const start = settings.start || "0";
      const duration = settings.duration || "10";
      return [
        "-i", inputPath,
        "-ss", start,
        "-t", duration,
        "-c:v", "libx264",
        "-crf", "23",
        "-preset", "medium",
        "-c:a", "aac",
        "-movflags", "+faststart",
      ];
    }
    case "crop": {
      const width = settings.width || "1280";
      const height = settings.height || "720";
      const x = settings.x || "0";
      const y = settings.y || "0";
      return [
        "-i", inputPath,
        "-vf", `crop=${width}:${height}:${x}:${y}`,
        "-c:v", "libx264",
        "-crf", "23",
        "-preset", "medium",
        "-c:a", "aac",
        "-movflags", "+faststart",
      ];
    }
    case "rotate": {
      const angle = settings.angle || "90";
      const transform: Record<string, string> = {
        "90": "transpose=1",
        "180": "transpose=1,transpose=1",
        "270": "transpose=2",
        "hflip": "hflip",
        "vflip": "vflip",
      };
      return [
        "-i", inputPath,
        "-vf", transform[angle] || "transpose=1",
        "-c:v", "libx264",
        "-crf", "23",
        "-preset", "medium",
        "-c:a", "aac",
        "-movflags", "+faststart",
      ];
    }
    case "gif": {
      const start = settings.start || "0";
      const duration = settings.duration || "5";
      const fps = settings.fps || "10";
      const width = settings.width || "480";
      return [
        "-i", inputPath,
        "-ss", start,
        "-t", duration,
        "-vf", `fps=${fps},scale=${width}:-1:flags=lanczos`,
        "-c:v", "gif",
      ];
    }
    case "mp3": {
      const bitrate = settings.bitrate || "192k";
      return [
        "-i", inputPath,
        "-vn",
        "-c:a", "libmp3lame",
        "-b:a", bitrate,
      ];
    }
    case "m4a": {
      return [
        "-i", inputPath,
        "-vn",
        "-c:a", "aac",
        "-b:a", "192k",
      ];
    }
    case "wav": {
      return [
        "-i", inputPath,
        "-vn",
        "-c:a", "pcm_s16le",
      ];
    }
    // Default: convert to output format
    default: {
      const preset = FfmpegService.getDefaultPreset();
      // If output is audio-only and no video
      if (ext === ".mp3") {
        return ["-i", inputPath, "-vn", "-c:a", "libmp3lame", "-b:a", "192k"];
      }
      return [
        "-i", inputPath,
        "-c:v", preset.videoCodec,
        "-c:a", preset.audioCodec,
        ...(preset.crf !== undefined ? ["-crf", String(preset.crf)] : []),
        "-preset", preset.preset || "medium",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
      ];
    }
  }
}

/**
 * POST /api/convert
 * Upload a video/audio file, probe it, and start processing.
 */
export async function POST(request: Request) {
  try {
    const rateLimit = checkRateLimit(request, rateLimiters.convert);
    if (rateLimit) return rateLimit;

    const data = await request.formData();
    const file = data.get("file") as File | null;
    const format = (data.get("format") as string | null) || "mp4";
    const operation = (data.get("operation") as string | null) || "convert";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type) && !file.type.startsWith("video/") && !file.type.startsWith("audio/")) {
      return NextResponse.json(
        { error: "Invalid file type. Only video and audio files are allowed." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE.conversion) {
      return NextResponse.json(
        {
          error: "File too large",
          message: `Maximum file size for processing is ${(MAX_FILE_SIZE.conversion / 1024 / 1024).toFixed(0)}MB`,
        },
        { status: 400 }
      );
    }

    // Collect settings from form data
    const settings: Record<string, string | undefined> = {};
    for (const key of ["quality", "width", "height", "maintainRatio", "start", "duration", "x", "y", "angle", "fps", "bitrate"]) {
      const val = data.get(key);
      if (val) settings[key] = String(val);
    }

    const jobId = crypto.randomUUID();
    const jobDir = path.join(TEMP_DIR, jobId);
    fs.mkdirSync(jobDir, { recursive: true });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const inputPath = path.join(jobDir, safeName);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(inputPath, buffer);

    // Probe the input file
    let hasMetadata = false;
    let metadata: Record<string, unknown> = {};
    try {
      const probe = await FfmpegService.probe(inputPath);
      hasMetadata = true;
      metadata = {
        duration: probe.duration,
        width: probe.width,
        height: probe.height,
        codec: probe.video_codec,
        format: probe.format,
        fps: probe.fps,
        bitrate: probe.bitrate,
      };
    } catch (probeError) {
      console.warn(`FFprobe failed for job ${jobId}:`, probeError);
    }

    // Determine output filename
    const outputExt = format.startsWith(".") ? format : `.${format}`;
    const baseName = safeName.replace(/\.[^.]+$/, "");
    const outputName = `${baseName}-${operation}${outputExt}`;
    const outputPath = path.join(jobDir, outputName);

    // Build args
    const args = buildArgs(inputPath, outputPath, operation, settings);

    // Run FFmpeg asynchronously
    FfmpegService.spawn(inputPath, outputPath, args, 600000)
      .catch((err) => {
        console.error(`Processing job ${jobId} failed:`, err);
        fs.rmSync(jobDir, { recursive: true, force: true });
      });

    return NextResponse.json({
      success: true,
      jobId,
      filename: safeName,
      outputName,
      size: file.size,
      hasMetadata,
      metadata,
      operation,
      message: "Processing job started",
    });
  } catch (error) {
    console.error("Processing start error:", error);
    return NextResponse.json(
      { error: "Failed to start processing. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/convert?jobId=...
 * Check job status
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json({ error: "Job ID required" }, { status: 400 });
    }

    if (!/^[a-f0-9-]{36}$/i.test(jobId)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    }

    const jobDir = path.join(TEMP_DIR, jobId);

    if (!fs.existsSync(jobDir)) {
      return NextResponse.json({
        success: false,
        jobId,
        status: "not_found",
        message: "Job not found or already cleaned up",
      });
    }

    // Find output file (any file that isn't the input)
    const files = fs.readdirSync(jobDir);
    const inputCandidates = [".mp4", ".mov", ".mkv", ".avi", ".webm", ".mpeg", ".mpg", ".ts", ".flv", ".mp3", ".wav", ".m4a"];
    const outputFile = files.find(
      (f) => !inputCandidates.includes(path.extname(f).toLowerCase()) || f.includes("-convert") || f.includes("-compress") || f.includes("-trim") || f.includes("-crop") || f.includes("-rotate") || f.includes("-gif") || f.includes("-resize") || f.includes("-mp3") || f.includes("-m4a") || f.includes("-wav")
    );

    if (outputFile) {
      const outputPath = path.join(jobDir, outputFile);
      const stat = fs.statSync(outputPath);
      return NextResponse.json({
        success: true,
        jobId,
        status: "completed",
        outputUrl: `/api/download/${jobId}/${encodeURIComponent(outputFile)}`,
        outputName: outputFile,
        outputSize: stat.size,
        outputSizeReadable: FfmpegService.formatBytes(stat.size),
      });
    }

    return NextResponse.json({
      success: true,
      jobId,
      status: "processing",
      message: "Processing in progress",
    });
  } catch (error) {
    console.error("Job status check error:", error);
    return NextResponse.json({ error: "Failed to check job status" }, { status: 500 });
  }
}

/**
 * DELETE /api/convert?jobId=...
 * Clean up a job
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json({ error: "Job ID required" }, { status: 400 });
    }

    if (!/^[a-f0-9-]{36}$/i.test(jobId)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    }

    const jobDir = path.join(TEMP_DIR, jobId);
    if (fs.existsSync(jobDir)) {
      fs.rmSync(jobDir, { recursive: true, force: true });
    }

    return NextResponse.json({ success: true, jobId, message: "Job cleaned up" });
  } catch (error) {
    console.error("Job cleanup error:", error);
    return NextResponse.json({ error: "Failed to clean up job" }, { status: 500 });
  }
}