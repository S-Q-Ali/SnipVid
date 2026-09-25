import { execFile, spawn } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";

const TEMP_DIR = path.join(os.tmpdir(), "videotoolkit", "temp");
const FFMPEG_BIN = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE_BIN = process.env.FFPROBE_PATH || "ffprobe";

export interface FfprobeMetadata {
  duration: number;
  width: number;
  height: number;
  codec: string;
  codec_long_name: string;
  bitrate: number;
  fps: number;
  format: string;
  size: number;
  nb_streams: number;
  video_codec: string;
  audio_codec: string;
  video_bitrate: number;
  audio_bitrate: number;
}

export interface ConversionPreset {
  name: string;
  videoCodec: string;
  audioCodec: string;
  videoBitrate?: string;
  audioBitrate?: string;
  crf?: number;
  preset?: string;
  resolution?: string;
  fps?: number;
}

export interface FfmpegJobOptions {
  input: string;
  output: string;
  preset?: ConversionPreset;
  cwd?: string;
  timeout?: number;
  onProgress?: (progress: number, metric: "percentage" | "time" | "size") => void;
  onStatusUpdate?: (status: "pending" | "processing" | "completed" | "failed" | "cancelled") => void;
}

export class FfmpegService {
  static async ensureDirectories(): Promise<void> {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  static async probe(filePath: string): Promise<FfprobeMetadata> {
    await FfmpegService.ensureDirectories();

    return new Promise((resolve, reject) => {
      const args = [
        "-v", "error",
        "-show_entries", "stream:format",
        "-print_format", "json",
        filePath,
      ];

      execFile(FFPROBE_BIN, args, { timeout: 30000 }, (error, stdout) => {
        if (error) {
          reject(new Error(`FFprobe failed: ${error.message}`));
          return;
        }

        try {
          const metadata = JSON.parse(stdout.toString());
          const streams = metadata.streams || [];

          const videoStream = streams.find((s: any) => s.codec_type === "video");
          const audioStream = streams.find((s: any) => s.codec_type === "audio");

          let fps = 0;
          if (videoStream?.r_frame_rate) {
            fps = parseFloat(videoStream.r_frame_rate) || 0;
          } else if (videoStream?.avg_frame_rate) {
            fps = parseFloat(videoStream.avg_frame_rate) || 0;
          }

          const format = metadata.format || {};

          const result: FfprobeMetadata = {
            duration: parseFloat(format.duration) || 0,
            width: videoStream ? videoStream.width || 0 : 0,
            height: videoStream ? videoStream.height || 0 : 0,
            codec: videoStream?.codec_name || audioStream?.codec_name || "",
            codec_long_name: videoStream?.codec_long_name || audioStream?.codec_long_name || "",
            bitrate: parseInt(format.bitrate || "0", 10) || 0,
            fps,
            format: format.format_name || "",
            size: parseInt(format.size || "0", 10) || 0,
            nb_streams: metadata.streams ? metadata.streams.length : 0,
            video_codec: videoStream?.codec_name || "",
            audio_codec: audioStream?.codec_name || "",
            video_bitrate: videoStream?.bit_rate ? parseInt(videoStream.bit_rate, 10) : 0,
            audio_bitrate: audioStream?.bit_rate ? parseInt(audioStream.bit_rate, 10) : 0,
          };

          resolve(result);
        } catch (parseError) {
          reject(new Error(`Failed to parse FFprobe output: ${parseError instanceof Error ? parseError.message : String(parseError)}`));
        }
      });
    });
  }

  static async inspectInput(filePath: string): Promise<{
    valid: boolean;
    metadata: FfprobeMetadata;
    warning?: string;
  }> {
    try {
      const metadata = await this.probe(filePath);

      let warning: string | undefined;

      if (metadata.video_codec && !this.isCodecSupported(metadata.video_codec)) {
        warning = `Video codec "${metadata.video_codec}" may not be fully supported`;
      }

      if (metadata.audio_codec && !this.isCodecSupported(metadata.audio_codec)) {
        warning = warning
          ? `${warning}; Audio codec "${metadata.audio_codec}" may not be fully supported`
          : `Audio codec "${metadata.audio_codec}" may not be fully supported`;
      }

      if (metadata.size && metadata.size > 500 * 1024 * 1024) {
        warning = warning
          ? `${warning} Large file (${this.formatBytes(metadata.size)})`
          : `Large file (${this.formatBytes(metadata.size)})`;
      }

      return { valid: true, metadata, warning };
    } catch (error) {
      return {
        valid: false,
        metadata: FfmpegService.emptyMetadata(),
        warning: error instanceof Error ? error.message : "Failed to inspect input",
      };
    }
  }

  static emptyMetadata(): FfprobeMetadata {
    return {
      duration: 0,
      width: 0,
      height: 0,
      codec: "",
      codec_long_name: "",
      bitrate: 0,
      fps: 0,
      format: "",
      size: 0,
      nb_streams: 0,
      video_codec: "",
      audio_codec: "",
      video_bitrate: 0,
      audio_bitrate: 0,
    };
  }

  static isCodecSupported(codec: string): boolean {
    const supported = new Set([
      "h264", "hevc", "mpeg2", "mpeg4", "vp8", "vp9", "av1",
      "aac", "mp3", "mp2", "ac3", "eac3",
      "mpg", "mov", "wmv", "flv", "theora", "pcm_s16le", "pcm_s16be",
    ]);
    return supported.has(codec.toLowerCase());
  }

  static formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  /**
   * Spawn FFmpeg with the given arguments and track real progress.
   */
  static spawn(
    input: string,
    output: string,
    args: string[] = [],
    timeout = 300000,
    onProgress?: (progress: number, metric: "percentage" | "time" | "size") => void,
    duration?: number
  ): Promise<{ success: boolean; error?: string; outputPath?: string }> {
    return new Promise((resolve) => {
      FfmpegService.ensureDirectories().catch(() => {});

      const fullArgs = [
        "-y",
        "-hide_banner",
        "-nostdin",
        ...args,
        output,
      ];

      let timer: NodeJS.Timeout | null = null;
      let settled = false;

      const child = spawn(FFMPEG_BIN, fullArgs, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      if (timeout > 0) {
        timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            child.kill("SIGKILL");
            resolve({ success: false, error: "FFmpeg operation timed out" });
          }
        }, timeout);
      }

      let stderrData = "";

      child.stderr?.on("data", (chunk: Buffer) => {
        stderrData += chunk.toString();
        if (onProgress && duration && duration > 0) {
          const timeMatch = stderrData.match(/time=\s*(\d+):(\d+):(\d+(?:\.\d+)?)/g);
          if (timeMatch && timeMatch.length > 0) {
            const last = timeMatch[timeMatch.length - 1];
            const parts = last.replace("time=", "").trim().split(":");
            const seconds = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseFloat(parts[2]);
            const pct = Math.min(99, Math.round((seconds / duration) * 100));
            onProgress(pct, "percentage");
          }
        }
      });

      child.on("error", (err) => {
        if (!settled) {
          settled = true;
          if (timer) clearTimeout(timer);
          resolve({ success: false, error: err.message || "Failed to spawn FFmpeg" });
        }
      });

      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);

        if (code === 0) {
          if (onProgress) onProgress(100, "percentage");
          resolve({ success: true, outputPath: output });
        } else {
          const lastLine = stderrData.trim().split("\n").pop() || "";
          const friendly = FfmpegService.convertError(lastLine);
          resolve({ success: false, error: friendly });
        }
      });
    });
  }

  /** Convert raw FFmpeg stderr into a user-friendly error */
  static friendlyError(raw: string): string {
    return FfmpegService.convertError(raw);
  }

  /** Convert raw FFmpeg stderr into a user-friendly error */
  static convertError(raw: string): string {
    const lower = raw.toLowerCase();
    if (lower.includes("no such file")) {
      return "We couldn't read the input file. It may have been removed or is not accessible.";
    }
    if (lower.includes("invalid data") || lower.includes("could not find codec") || lower.includes("unknown encoder") || lower.includes("requested output format")) {
      return "We couldn't process this video. The input codec or container may not be supported.";
    }
    if (lower.includes("out of memory")) {
      return "The video is too large to process with the available memory.";
    }
    if (lower.includes("permission denied")) {
      return "We couldn't write the output file. Please try again with a different filename.";
    }
    return "We couldn't process this video. The input codec or container may not be supported.";
  }

  static getDefaultPreset(): ConversionPreset {
    return {
      name: "Default MP4",
      videoCodec: "libx264",
      audioCodec: "aac",
      crf: 23,
      preset: "medium",
    };
  }

  static getSocialMediaPreset(platform: string): ConversionPreset {
    const presets: Record<string, ConversionPreset> = {
      youtube: {
        name: "YouTube",
        videoCodec: "libx264",
        audioCodec: "aac",
        videoBitrate: "5000k",
        audioBitrate: "128k",
        crf: 20,
        preset: "fast",
      },
      tiktok: {
        name: "TikTok",
        videoCodec: "libx264",
        audioCodec: "aac",
        videoBitrate: "3000k",
        audioBitrate: "96k",
        crf: 22,
        preset: "fast",
      },
      instagram: {
        name: "Instagram",
        videoCodec: "libx264",
        audioCodec: "aac",
        videoBitrate: "4000k",
        audioBitrate: "128k",
        crf: 22,
        preset: "fast",
      },
    };
    return presets[platform] || presets.youtube;
  }
}

export function ffmpegCheck(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(FFMPEG_BIN, ["-version"], { timeout: 10000 }, (err) => resolve(!err));
  });
}

export function ffprobeCheck(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(FFPROBE_BIN, ["-version"], { timeout: 10000 }, (err) => resolve(!err));
  });
}