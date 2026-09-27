import type { InstagramMediaType } from "./url";

export interface InstagramMediaItem {
  id: string;
  index?: number;
  kind: "video" | "image";
  title: string;
  thumbnail?: string;
  duration?: number;
}

export interface InstagramAnalyzeResult {
  mediaType: InstagramMediaType;
  title: string;
  uploader?: string;
  thumbnail?: string;
  duration?: number;
  isCarousel: boolean;
  media: InstagramMediaItem[];
  error?: string;
}

export type DownloadJobStatus = "pending" | "processing" | "completed" | "failed";

export interface DownloadJob {
  id: string;
  url: string;
  mediaType: InstagramMediaType;
  status: DownloadJobStatus;
  progress: number;
  files: string[];
  itemIndex?: number;
  error?: string;
  /**
   * Redacted yt-dlp stderr, kept for server-side diagnosis only. Never exposed
   * through the API - it can contain session material and absolute paths.
   */
  diagnostics?: string;
  createdAt: number;
}