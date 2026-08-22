import { Search, Loader2, CheckCircle, X, FolderUpload, Mouse, Image, Music, Crop, Scissors, FormatAudio, Layout, Repeat, Video, Trash, Calendar, AlignCenter, Zap } from "lucide-react";

import { UploadZone } from "@/components/upload/upload-zone";
import { FormatSelector } from "@/components/converter/format-selector";
import { ProgressBar } from "@/components/progress/progress-bar";
import { ResultCard } from "@/components/results/result-card";
import { JobQueueItem } from "@/components/jobs/job-queue-item";
import { ToolNavigation } from "@/components/header/tool-navigation";
import { DownloaderService, DownloaderJob } from "@/lib/downloader/service";

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

export default function VideoDownloaderPage() {
  const [jobs, setJobs] = React.useState<DownloaderJob[]>([]);
  const [inputUrl, setInputUrl] = React.useState<string>("");
  const [selectedFormat, setSelectedFormat] = React.useState<string>("best");
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [ffmpegService] = React.useState(() => new FfmpegService());

  // Handle URL input change
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputUrl(e.target.value);
  };

  // Format selection change
  const handleFormatChange = (value: string) => {
    setSelectedFormat(value);
  };

  // Start download
  const startDownload = async () => {
    if (!inputUrl.trim()) return;

    setIsProcessing(true);
    setJobs([...jobs, {
      id: uuidv4(),
      url: inputUrl,
      platform: "unknown",
      status: "pending",
      progress: 0,
    }]);

    try {
      // Analyze the URL using the downloader service
      const analysis = await DownloaderService.analyzeUrl(inputUrl);

      if (!analysis.provider) {
        setJobs(prev => {
          const updated = [...prev];
          const jobIndex = updated.findIndex(j => j.id === jobs[jobs.length].id);
          if (jobIndex !== -1) {
            updated[jobIndex].status = "failed";
            updated[jobIndex].error = "Unsupported URL or platform";
          }
          return updated;
        });
        setIsProcessing(false);
        return;
      }

      // Update job with platform info
      setJobs(prev => {
        const updated = [...prev];
        const jobIndex = updated.findIndex(j => j.id === jobs[jobs.length].id);
        if (jobIndex !== -1) {
          updated[jobIndex].platform = analysis.platform || "unknown";
          updated[jobIndex].title = analysis.videoInfo.title || "Unknown video";
          updated[jobIndex].duration = analysis.videoInfo.duration;
          updated[jobIndex].availableFormats = analysis.videoInfo.formats
            ? analysis.videoInfo.formats.map((f: any) => ({
                quality: f.quality || "unknown",
                url: f.url || "",
              }))
            : undefined;
        });
        return updated;
      });

      // Start the download
      const downloadResult = await DownloaderService.download(inputUrl, selectedFormat);

      setJobs(prev => {
        const updated = [...prev];
        const jobIndex = updated.findIndex(j => j.id === jobs[jobs.length].id);
        if (jobIndex !== -1) {
          if (downloadResult.status === "completed") {
            updated[jobIndex].status = "completed";
            updated[jobIndex].progress = 100;
            updated[jobIndex].error = undefined;
            // In a real implementation, we'd set the outputPath
          } else {
            updated[jobIndex].status = "failed";
            updated[jobIndex].error = downloadResult.error || "Download failed";
          }
        }
        return updated;
      });

    } catch (error) {
      console.error("Download error:", error);
      const jobIndex = jobs.length - 1;
      setJobs(prev => {
        const updated = [...prev];
        updated[jobIndex].status = "failed";
        updated[jobIndex].error = error instanceof Error ? error.message : "Unknown error";
        return updated;
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Cancel a job
  const cancelJob = async (jobId: string) => {
    const success = await DownloaderService.cancel(jobId);
    setJobs(prev => {
      const updated = prev.filter(j => j.id !== jobId);
      return updated;
    });
    return success;
  };

  // Format size helper
  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  // UUID helper
  function uuidv4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <header className="border-b border-border bg-card/80 backdrop-blur-sm mb-6">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <h1 className="font-bold text-2xl tracking-tighter">
              Video Downloader
            </h1>
          </div>
        </header>

        {/* URL Input Section */}
        <section className="mb-8 border-b border-border pb-6">
          <div className="max-w-2xl mx-auto">
            <div className="rounded-xl border-border p-3 bg-background">
              <input
                type="text"
                value={inputUrl}
                onChange={handleUrlChange}
                className="input-field w-full p-2 pr-8"
                placeholder="Enter video URL (YouTube, Vimeo, etc.)"
                aria-label "Video URL"
                required
              />
              <button
                type="button"
                onClick={() => {
                  // Trigger download when button clicked
                  // In a full implementation, we'd have a Go button
                }}
                className="btn btn-primary position-absolute right-2 top-1/2 -translate-y-1/2 px-4"
                aria-label="Analyze URL"
              >
                <Zap className="h-4 w-4 mr-2" /> Analyze
              </button>
            </div>

            {/* Supported platforms info */}
            {inputUrl && (
              <div className="mt-3 text-sm text-muted-foreground">
                Supported: YouTube, Vimeo, Facebook, Instagram, Twitter, TikTok
              </div>
            )}
          </div>
        </section>

        {/* Jobs Queue */}
        <section className="mb-8">
          <h2 className="font-medium text-sm text-muted-foreground mb-3">
            Download Jobs
          </h2>
          {jobs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No jobs yet. Enter a URL to get started.
            </p>
          )}
          <div className="space-y-3">
            {jobs.map((job) => (
              <JobQueueItem
                key={job.id}
                job={job}
                onCancel={() => cancelJob(job.id)}
              />
            ))}
          </div>
        </section>

        {/* URL Analysis Results */}
        {inputUrl && jobs.some(j => j.platform !== "unknown") && (
          <section className="mb-8 p-4 rounded-xl bg-muted/50 border-border">
            <h3 className="font-medium mb-2">URL Analysis</h3>
            <p className="text-sm text-muted-foreground">
              Platform: <span className="font-medium">{jobs.find(j => j.platform !== "unknown")?.platform || "unknown"}</span>
            </p>
            {jobs.find(j => j.platform !== "unknown")?.title && (
              <p className="text-sm mb-2">
                Title: {jobs.find(j => j.platform !== "unknown")?.title}
              </p>
            )}
            {jobs.find(j => j.platform !== "unknown")?.duration && (
              <p className="text-sm">
                Duration: {jobs.find(j => j.platform !== "unknown")?.duration} seconds
              </p>
            )}
            {jobs.find(j => j.platform !== "unknown")?.availableFormats?.length && (
              <p className="text-sm mb-2">
                Available qualities: {jobs.find(j => j.platform !== "unknown")?.availableFormats?.map(f => f.quality).join(", ") || "none"}
              </p>
            )}
          </section>
        )}

        {/* Convert Button (for download) */}
        <div className="mt-6 pt-6 border-t border-border">
          <button
            onClick={startDownload}
            className="btn btn-primary w-full py-3 font-medium"
            disabled={!inputUrl.trim() || isProcessing}
            aria-label="Start video download"
          >
            {isProcessing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            ) : inputUrl.trim() ? "Download Video" : "Enter a URL above"};
          </button>
        </div>
      </div>
    </main>
  );
}