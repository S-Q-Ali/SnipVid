"use client";

import * as React from "react";
import { Loader2, Zap } from "lucide-react";
import { Header } from "@/components/header/header";
import { Footer } from "@/components/footer/footer";
import { validateURL } from "@/lib/security/service";

interface DownloadJob {
  id: string;
  url: string;
  status: "pending" | "processing" | "completed" | "failed";
  message?: string;
  error?: string;
}

export default function VideoDownloaderPage() {
  const [inputUrl, setInputUrl] = React.useState<string>("");
  const [jobs, setJobs] = React.useState<DownloadJob[]>([]);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputUrl(e.target.value);
    setError(null);
  };

  const startDownload = async () => {
    if (!inputUrl.trim()) return;

    // Validate URL
    const check = validateURL(inputUrl.trim());
    if (!check.valid) {
      setError(check.reason || "Invalid URL");
      return;
    }

    setIsProcessing(true);
    setError(null);

    const jobId = crypto.randomUUID();
    const newJob: DownloadJob = {
      id: jobId,
      url: inputUrl,
      status: "processing",
      message: "Analyzing URL...",
    };
    setJobs((prev) => [newJob, ...prev]);

    try {
      // For now, we'll return a clear message that downloader support
      // requires platform-specific providers to be registered
      await new Promise((r) => setTimeout(r, 1500));
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                status: "failed",
                error: "This platform is not currently supported. Direct MP4/WebM file URLs are supported in a future update.",
              }
            : j
        )
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Download failed";
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: "failed", error: msg } : j))
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tighter mb-3">
          Video Downloader
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Enter a publicly accessible video URL to download it. This tool supports
          direct video file URLs and works with supported public platforms.
        </p>

        {/* URL input */}
        <div className="flex gap-2">
          <input
            type="url"
            value={inputUrl}
            onChange={handleUrlChange}
            className="input-field flex-1"
            placeholder="Enter video URL"
            aria-label="Video URL"
            required
          />
          <button
            type="button"
            onClick={startDownload}
            disabled={!inputUrl.trim() || isProcessing}
            className="btn btn-primary disabled:opacity-50"
            aria-label="Start download"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-1" />
            )}
            {isProcessing ? "Analyzing..." : "Download"}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          Supported platforms: direct video file URLs and select public platforms.
          We do not support DRM, private, or access-controlled content.
        </p>

        {/* Jobs */}
        {jobs.length > 0 && (
          <div className="mt-8">
            <h2 className="font-medium text-sm text-muted-foreground mb-3">
              Download Jobs
            </h2>
            <div className="space-y-3">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="p-3 rounded-xl bg-muted/30 border border-border text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate">{job.url}</p>
                    <span
                      className={
                        job.status === "failed"
                          ? "text-red-600 dark:text-red-400"
                          : "text-muted-foreground"
                      }
                    >
                      {job.status === "processing" ? "Processing..." : job.status === "failed" ? "Failed" : "Completed"}
                    </span>
                  </div>
                  {(job.error || job.message) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {job.error || job.message}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}