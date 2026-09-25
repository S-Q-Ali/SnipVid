import path from "path";
import fs from "fs";

export interface DownloaderProvider {
  name: string;
  matchUrl: (url: string) => boolean;
  getVideoInfo: (url: string) => Promise<{
    title: string;
    thumbnail?: string;
    duration?: number;
    formats?: Array<{
      quality?: string;
      url?: string;
      codec?: string;
      container?: string;
    }>;
    error?: string;
  }>;
  downloadVideo: (url: string, quality?: string) => Promise<{
    success: boolean;
    filepath: string;
    title: string;
    error?: string;
  }>;
}

export interface DownloaderJob {
  id: string;
  url: string;
  platform: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  title?: string;
  thumbnail?: string;
  duration?: number;
  availableFormats?: Array<{
    quality: string;
    url: string;
  }>;
  error?: string;
  outputPath?: string;
}

export class DownloaderService {
  static providers: DownloaderProvider[] = [];

  static registerProvider(provider: DownloaderProvider): void {
    this.providers.push(provider);
  }

  static async analyzeUrl(url: string): Promise<{
    platform: string | null;
    provider: DownloaderProvider | null;
    videoInfo: Awaited<ReturnType<DownloaderProvider["getVideoInfo"]>>;
  }> {
    for (const provider of this.providers) {
      if (provider.matchUrl(url)) {
        try {
          const videoInfo = await provider.getVideoInfo(url);
          return {
            platform: provider.name,
            provider,
            videoInfo,
          };
        } catch (error) {
          console.warn(`Provider ${provider.name} failed`, error);
        }
      }
    }

    return {
      platform: null,
      provider: null,
      videoInfo: {
        title: "Unknown platform",
        duration: undefined,
        formats: undefined,
        error: "Unsupported URL or platform",
      },
    };
  }

  static async getVideoInfo(url: string): Promise<{
    platform: string | null;
    title: string;
    thumbnail?: string;
    duration?: number;
    formats?: Array<{ quality: string; url: string }>;
    error?: string;
  }> {
    const analysis = await this.analyzeUrl(url);
    if (analysis.provider) {
      return {
        platform: analysis.platform,
        title: analysis.videoInfo.title,
        thumbnail: analysis.videoInfo.thumbnail,
        duration: analysis.videoInfo.duration,
        formats: analysis.videoInfo.formats
          ? analysis.videoInfo.formats.map((f: any) => ({
              quality: f.quality || "unknown",
              url: f.url || "",
            }))
          : undefined,
        error: analysis.videoInfo.error,
      };
    }
    return {
      platform: null,
      title: analysis.videoInfo.title,
      error: analysis.videoInfo.error,
    };
  }

  static async download(url: string, quality?: string): Promise<{
    jobId: string;
    platform: string;
    status: "pending" | "processing" | "completed" | "failed";
    error?: string;
  }> {
    const analysis = await this.analyzeUrl(url);
    if (!analysis.provider) {
      return {
        jobId: crypto.randomUUID(),
        platform: "unknown",
        status: "failed",
        error: analysis.videoInfo.error || "Unsupported URL",
      };
    }

    const jobId = crypto.randomUUID();
    const tempDir = path.join(process.cwd(), "storage", "temp", jobId);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      const downloadResult = await analysis.provider.downloadVideo(url, quality);

      if (downloadResult.success && downloadResult.filepath) {
        return {
          jobId,
          platform: analysis.platform || "unknown",
          status: "completed",
          error: undefined,
        };
      } else {
        return {
          jobId,
          platform: analysis.platform || "unknown",
          status: "failed",
          error: downloadResult.error || "Download failed",
        };
      }
    } catch (error) {
      console.error("Download error:", error);
      return {
        jobId,
        platform: analysis.platform || "unknown",
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown download error",
      };
    }
  }

  static async cancel(jobId: string): Promise<boolean> {
    const tempDir = path.join(process.cwd(), "storage", "temp", jobId);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      return true;
    }
    return false;
  }
}