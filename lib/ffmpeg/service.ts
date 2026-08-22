import { execFile } from "child_process";
import { ffprobe as ffprobePath, ffmpeg as ffmpegPath } from "@ffmpeg-installer/lib/ffmpeg";
import { ffprobe as ffprobePath2 } from "@ffmpeg-installer/lib/ffprobe";

import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";

const TEMP_DIR = path.join(os.tmpdir(), "videotoolkit", "temp");
const MAX_JOB_RETENTION_SECONDS = 24 * 60 * 60; // 24 hours

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
    if (!os.existsSync(TEMP_DIR)) {
      os.mkdirSync(TEMP_DIR, { recursive: true });
    }
  }

  static async probe(filePath: string): Promise<FfprobeMetadata> {
    await FfmpegService.ensureDirectories();

    return new Promise((resolve, reject) => {
      const args = ["-v", "error", "-show_entries", "stream", "-print_format", "json", filePath];

      execFile(ffprobePath, args, { timeout: 30000 }, (error, stdout, stderr) => {
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

          const result: FfprobeMetadata = {
            duration: metadata.format ? parseFloat(metadata.format.duration) : 0,
            width: videoStream ? videoStream.width : 0,
            height: videoStream ? videoStream.height : 0,
            codec: videoStream?.codec_name || audioStream?.codec_name || "",
            codec_long_name: videoStream?.codec_long_name || audioStream?.codec_long_name || "",
            bitrate: metadata.format ? parseInt(metadata.format.bitrate, 10) : 0,
            fps,
            format: metadata.format ? metadata.format.format_name : "",
            size: metadata.format ? parseInt(metadata.format.size, 10) : 0,
            nb_streams: metadata.streams ? metadata.streams.length : 0,
            video_codec: videoStream?.codec_name || "",
            audio_codec: audioStream?.codec_name || "",
            video_bitrate: videoStream?.bit_rate ? parseInt(videoStream.bit_rate, 10) : 0,
            audio_bitrate: audioStream?.bit_rate ? parseInt(audioStream.bit_rate, 10) : 0,
          };

          resolve(result);
        } catch (parseError) {
          reject(new Error(`Failed to parse FFprobe output: ${parseError.message}`));
        }
      });
    });
  }

  static async getJobId(): Promise<string> {
    return uuidv4();
  }

  static async spawn(
    input: string,
    output: string,
    customArgs: string[] = [],
    timeout = 300000
  ): Promise<{
    success: boolean;
    error?: string;
    completed?: boolean;
    progress?: number;
  }> {
    await FfmpegService.ensureDirectories();

    return new Promise((resolve) => {
      const inputPath = input;
      const outputPath = output;

      // Build FFmpeg arguments
      const args = this.buildArgs(inputPath, outputPath, customArgs);

      const child = execFile(ffmpegPath, args, {
        timeout,
        maxBuffer: 1024 * 1024 * 1024,
        killSignal: "SIGTERM",
      }, (error, stdout, stderr) => {
        if (error && !completed) {
          resolve({
            success: false,
            error: error.message || "FFmpeg processing failed",
            completed: false,
          });
        } else {
          resolve({
            success: true,
            completed: true,
          });
        }
      });

      // Handle premature exit
      child.on("error", (spawnError) => {
        resolve({
          success: false,
          error: spawnError.message || "Failed to spawn FFmpeg",
          completed: false,
        });
      });

      // Set up timeout
      const timeoutId = setTimeout(() => {
        child.kill("SIGKILL");
        resolve({
          success: false,
          error: "FFmpeg operation timed out",
          completed: false,
        });
      }, timeout);

      // Parse FFmpeg output for progress
      let progress = 0;
      const progressInterval = setInterval(() => {
        // Check process state
        if (!child || child.killed) {
          clearInterval(progressInterval);
          return;
        }

        // Parse stderr for progress information
        if (stderr) {
          FfmpegService.parseProgressOutput(stderr, (p: number) => {
            progress = p;
            // Could emit progress event here
          });
        }

        // Check if process has finished
        if (child.exitCode !== null && child.exitCode !== undefined) {
          clearInterval(progressInterval);
        }
      }, 500);

      // Parse stdout and stderr after completion
      setTimeout(() => {
        clearInterval(progressInterval);

        if (stdout) {
          this.parseProgress(stdout, (progress) => {
            // Progress callback
          });
        }

        if (stderr) {
          this.parseProgress(stderr, (progress) => {
            // Progress callback
          });
        }

        resolve({
          success: true,
          completed: true,
        });
      }, timeout + 1000);
    });
  }

  static buildArgs(inputPath: string, outputPath: string, customArgs: string[] = []): string[] {
    const baseArgs = [
      "-y", // Overwrite output
      "-hide_banner",
      "-loglevel", "error+info",
    ];

    return [
      ...baseArgs,
      ...customArgs,
      "-i",
      inputPath,
      outputPath,
    ];
  }

  static async inspectInput(filePath: string): Promise<{
    valid: boolean;
    metadata: FfprobeMetadata;
    warning?: string;
  }> {
    try {
      const metadata = await this.probe(filePath);

      let warning: string | undefined;

      // Check for unsupported codecs
      if (metadata.video_codec && !this.isCodecSupported(metadata.video_codec)) {
        warning = `Video codec "${metadata.video_codec}" may not be fully supported`;
      }

      if (metadata.audio_codec && !this.isCodecSupported(metadata.audio_codec)) {
        warning = warning
          ? `${warning}; Audio codec "${metadata.audio_codec}" may not be fully supported`
          : `Audio codec "${metadata.audio_codec}" may not be fully supported`;
      }

      // Check for very large files
      if (metadata.size && metadata.size > 500 * 1024 * 1024) {
        warning = warning
          ? `${warning} Large file (${this.formatSize(metadata.size)})`
          : `Large file (${this.formatSize(metadata.size)})`;
      }

      return {
        valid: true,
        metadata,
        warning,
      };
    } catch (error) {
      return {
        valid: false,
        metadata: {
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
        },
        warning: error instanceof Error ? error.message : "Failed to inspect input",
      };
    }
  }

  static isCodecSupported(codec: string): boolean {
    const supportedCodecs = new Set([
      "h264", "hevc", "mpeg2", "mpeg4", "vp8", "vp9", "av1",
      "aac", "mp3", "mp2", "ac3", "eac3",
      "mpg", "mov", "wmv", "flv",
    ]);

    return supportedCodecs.has(codec.toLowerCase());
  }

  static formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  /** Parse FFmpeg progress output and invoke callback */
  static parseProgress(output: string, callback: (progress: number) => void): void {
    const lines = output.split("\n");

    for (const line of lines) {
      // Match progress lines like "frame= 1234 fps= 25 q=2.5 size=....."
      const progressMatch = line.match(/frame=\s+\d+/);
      if (progressMatch) {
        // Try to extract frame number and calculate percentage
        const frameMatch = line.match(/frame=\s+(\d+)/);
        if (frameMatch) {
          const currentFrame = parseInt(frameMatch[1], 10);
          // If we have total frames, we could calculate percentage
          // For now, just parse any percentage if present
          const percentMatch = line.match(/(\d+\.?\d*)%/);
          if (percentMatch) {
            callback(parseFloat(percentMatch[1]));
          }
        }
      }

      // Match time-based progress
      const timeMatch = line.match(/time=\s+(\d{2}:\d{2}:\d{2})/);
      if (timeMatch) {
        // Time-based progress - could calculate percentage if we know total duration
        // const currentTime = timeMatch[1];
      }

      // Match size-based progress
      const sizeMatch = line.match(/size=\s+(\d+)/);
      if (sizeMatch) {
        // Size-based progress - could calculate percentage if we know total size
      }
    }
  }

  /** Get default conversion preset based on input metadata */
  static getDefaultPreset(
    inputCodec: string,
    inputFormat: string
  ): ConversionPreset {
    const videoCodec = "libx264"; // H.264 is universally supported
    const audioCodec = "aac"; // AAC is universally supported
    const crf = 23; // Default CRF (lower = better quality)
    const preset = "medium"; // Default preset

    return {
      name: "Default MP4",
      videoCodec,
      audioCodec,
      crf,
      preset,
    };
  }

  /** Get preset for social media platforms */
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

  /** Parse FFmpeg progress output for real-time updates */
  static parseProgressOutput(output: string, callback: (progress: number) => void): void {
    const lines = output.split("\n");

    for (const line of lines) {
      // Match "frame=NN fps=N q=N.NN size=NNNNkB time=HH:MM:SS bitrate=NNkbits/s"
      const frameMatch = line.match(/frame=\s+(\d+)/);
      if (frameMatch) {
        const currentFrame = parseInt(frameMatch[1], 10);
        // We would need total frame count for percentage - for now just track
      }

      // Match time progress: time=HH:MM:SS
      const timeMatch = line.match(/time=\s+(\d{2}:\d{2}:\d{2})/);
      if (timeMatch) {
        const timeParts = timeMatch[1].split(":");
        const currentSeconds = parseInt(timeParts[0]) * 3600 + parseInt(timeParts[1]) * 60 + parseInt(timeParts[2]);
        // Could calculate percentage if we know total duration
      }

      // Match bitrate
      const bitrateMatch = line.match(/bitrate=\s+(\d+)/);
      if (bitrateMatch) {
        // Bitrate info available
      }

      // Match final size
      const sizeMatch = line.match(/size=\s+(\d+)/);
      if (sizeMatch) {
        // Final size info available
      }
    }
  }
}