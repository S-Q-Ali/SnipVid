import { Search, Loader2, CheckCircle, X, FolderUpload, Mouse, Image, Music, Crop, Scissors, FormatAudio, Layout, Repeat, Video, Trash, Calendar, AlignCenter, Zap } from "lucide-react";

import { UploadZone } from "@/components/upload/upload-zone";
import { FormatSelector } from "@/components/converter/format-selector";
import { ProgressBar } from "@/components/progress/progress-bar";
import { ResultCard } from "@/components/results/result-card";
import { JobQueueItem } from "@/components/jobs/job-queue-item";
import { ToolNavigation } from "@/components/header/tool-navigation";
import { FfmpegService } from "@/lib/ffmpeg/service";

export interface TrimJob {
  id: string;
  filename: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  inputFormat?: string;
  outputFormat?: string;
  inputResolution?: string;
  outputResolution?: string;
  elapsedTime?: string;
  estimatedRemaining?: string;
  error?: string;
  outputSize?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
}

export default function VideoTrimmerPage() {
  const [jobs, setJobs] = React.useState<TrimJob[]>([]);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [startTime, setStartTime] = React.useState<string>("00:00");
  const [endTime, setEndTime] = React.useState<string>("00:30");
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [ffmpegService] = React.useState(() => new FfmpegService());

  // Upload handling
  const handleFilesSelected = (files: FileList) => {
    if (files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  // Start trimming
  const startTrimming = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setJobs([...jobs, {
      id: uuidv4(),
      filename: selectedFile.name,
      status: "pending",
      progress: 0,
      startTime,
      endTime,
    }]);

    try {
      const jobId = jobs[jobs.length].id;
      const tempDir = path.join(process.cwd(), "storage", "temp", jobId);
      const inputPath = path.join(tempDir, selectedFile.name);
      const outputPath = path.join(tempDir, `trimmed-${selectedFile.name}.mp4`);

      // Ensure temp directory exists
      os.mkdirSync(tempDir, { recursive: true });

      // Save uploaded file
      const buffer = Buffer.from(await selectedFile.arrayBuffer());
      await new Promise<void>((resolve, reject) => {
        const fs = require("fs");
        fs.writeFile(inputPath, buffer, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Parse start and end times (HH:MM:SS format)
      const [startMin, startSec] = startTime.split(":").map(Number);
      const [endMin, endSec] = endTime.split(":").map(Number);
      const startTimeSeconds = startMin * 60 + startSec;
      const endTimeSeconds = endMin * 60 + endSec;
      const clipDuration = Math.max(1, endTimeSeconds - startTimeSeconds); // At least 1 second

      // Build FFmpeg trim arguments
      const args = [
        "-y",
        "-i", inputPath,
        "-ss", startTimeSeconds.toString(),
        "-t", clipDuration.toString(),
        "-c:v", "libx264",
        "-c:a", "aac",
        "-preset", "medium",
        "-crf", "23",
        outputPath,
      ];

      // Run FFmpeg trim
      const result = await FfmpegService.spawn(inputPath, outputPath, args, 300000);

      if (result.success && result.completed) {
        // Get output file size
        const outputSize = os.statSync(outputPath).size;

        setJobs(prev => {
          const updated = [...prev];
          const jobIndex = updated.findIndex(j => j.id === jobId);
          if (jobIndex !== -1) {
            updated[jobIndex].status = "completed";
            updated[jobIndex].progress = 100;
            updated[jobIndex].outputFormat = "mp4";
            updated[jobIndex].outputResolution = "1920×1080";
            updated[jobIndex].outputSize = FfmpegService.formatBytes(outputSize);
            updated[jobIndex].startTime = startTime;
            updated[jobIndex].endTime = endTime;
            updated[jobIndex].duration = clipDuration;
          }
          return updated;
        });
      } else {
        setJobs(prev => {
          const updated = [...prev];
          const jobIndex = updated.findIndex(j => j.id === jobId);
          if (jobIndex !== -1) {
            updated[jobIndex].status = "failed";
            updated[jobIndex].error = result.error || "Trim failed";
          }
          return updated;
        });
      }

    } catch (error) {
      console.error("Trim error:", error);
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

  // Format time helper
  function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ":" : ""}${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  }

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
              Video Trimmer
            </h1>
          </div>
        </header>

        {/* Upload Zone */}
        <section className="mb-8">
          <UploadZone
            acceptedFiles="video/*"
            onFilesSelected={handleFilesSelected}
            multiple={false}
          />
        </section>

        {/* Trim Settings */}
        {selectedFile && (
          <section className="mb-8 p-4 rounded-xl bg-muted/50 border-border">
            <h3 className="font-medium mb-3">Trim Settings</h3>

            {/* Time inputs */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">
                  Start Time
                </label>
                <input
                  type="text"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="input-field"
                  placeholder="HH:MM:SS"
                  aria-label="Start time"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">
                  End Time
                </label>
                <input
                  type="text"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="input-field"
                  placeholder="HH:MM:SS"
                  aria-label="End time"
                />
              </div>
            </div>

            {/* Preview info */}
            <div className="mt-4 p-3 rounded-xl bg-muted/30">
              <p className="text-sm text-muted-foreground mb-1">Video Duration</p>
              <p className="font-medium" id="video-duration">
                --:--:--
              </p>
              <p className="text-xs text-muted-foreground">
                Clip will be: {formatTime((new Date().getTime() / 1000) - 60)}-{formatTime((new Date().getTime() / 1000) + 60)} (estimated)
              </p>
            </div>
          </section>
        )}

        {/* Convert Button */}
        <div className="mb-8">
          <button
            onClick={startTrimming}
            className="btn btn-primary w-full py-3 font-medium"
            disabled={!selectedFile || isProcessing}
            aria-label="Start video trim"
          >
            {isProcessing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Trimming...
            ) : (
              "Trim Video"
            )}
          </button>
        </div>

        {/* Jobs Queue */}
        <section className="mb-8">
          <h2 className="font-medium text-sm text-muted-foreground mb-3">
            Trim Jobs
          </h2>
          {jobs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No jobs yet. Upload a video to get started.
            </p>
          )}
          <div className="space-y-3">
            {jobs.map((job) => (
              <JobQueueItem key={job.id} job={job} />
            ))}
          </div>
        </section>

        {/* Result Card (shown after completion) */}
        {jobs.some((job) => job.status === "completed") && (
          <ResultCard
            outputUrl={`/storage/temp/${jobs.find(j => j.status === "completed")?.id}/trimmed-${jobs.find(j => j.status === "completed")?.filename}`}
            outputName="trimmed-video"
            outputFormat="mp4"
            outputResolution="1920×1080"
            outputSize={jobs.find(j => j.status === "completed")?.outputSize || "45.3 MB"}
            onDownload={() => window.alert("Download started")}
            onConvertAgain={() => {
              // Reset state
              setJobs([]);
              setSelectedFile(null);
            }}
          />
        )}
      </div>
    </main>
  );
}