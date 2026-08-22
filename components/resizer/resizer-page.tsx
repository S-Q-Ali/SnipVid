import { Search, Loader2, CheckCircle, X, FolderUpload, Mouse, Image, Music, Crop, Scissors, FormatAudio, Layout, Repeat, Video, Trash, Calendar, AlignCenter, Zap } from "lucide-react";

import { UploadZone } from "@/components/upload/upload-zone";
import { FormatSelector } from "@/components/converter/format-selector";
import { ProgressBar } from "@/components/progress/progress-bar";
import { ResultCard } from "@/components/results/result-card";
import { JobQueueItem } from "@/components/jobs/job-queue-item";
import { ToolNavigation } from "@/components/header/tool-navigation";
import { FfmpegService } from "@/lib/ffmpeg/service";

export interface ResizeJob {
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
  width?: number;
  height?: number;
  maintainAspectRatio: boolean;
}

export default function VideoResizerPage() {
  const [jobs, setJobs] = React.useState<ResizeJob[]>([]);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [width, setWidth] = React.useState<number>(1920);
  const [height, setHeight] = React.useState<number>(1080);
  const [maintainAspectRatio, setMaintainAspectRatio] = React.useState(true);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [ffmpegService] = React.useState(() => new FfmpegService());

  // Common presets
  const presets = [
    { name: "1920×1080", width: 1920, height: 1080 },
    { name: "1280×720", width: 1280, height: 720 },
    { name: "1080×1920", width: 1080, height: 1920 },
    { name: "720×1280", width: 720, height: 1280 },
    { name: "1080×1080", width: 1080, height: 1080 },
    { name: "1080×1350", width: 1080, height: 1350 },
  ];

  // Upload handling
  const handleFilesSelected = (files: FileList) => {
    if (files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  // Start resizing
  const startResizing = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setJobs([...jobs, {
      id: uuidv4(),
      filename: selectedFile.name,
      status: "pending",
      progress: 0,
      maintainAspectRatio,
    }]);

    try {
      const jobId = jobs[jobs.length].id;
      const tempDir = path.join(process.cwd(), "storage", "temp", jobId);
      const inputPath = path.join(tempDir, selectedFile.name);
      const outputPath = path.join(tempDir, `resized-${selectedFile.name}.mp4`);

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

      // Build FFmpeg resize arguments
      let resizeArgs: string[];

      if (maintainAspectRatio) {
        // Scale with aspect ratio maintenance
        resizeArgs = [
          "-y",
          "-i", inputPath,
          "-vf", `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
          "-s", `${width}x${height}`,
          "-c:v", "libx264",
          "-c:a", "aac",
          "-preset", "medium",
          outputPath,
        ];
      } else {
        // Fixed dimensions (may distort aspect ratio)
        resizeArgs = [
          "-y",
          "-i", inputPath,
          "-vf", `scale=${width}:${height}`,
          "-c:v", "libx264",
          "-c:a", "aac",
          "-preset", "medium",
          outputPath,
        ];
      }

      // Run FFmpeg resize
      const result = await FfmpegService.spawn(inputPath, outputPath, resizeArgs, 300000);

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
            updated[jobIndex].outputResolution = `${width}×${height}`;
            updated[jobIndex].outputSize = FfmpegService.formatBytes(outputSize);
            updated[jobIndex].width = width;
            updated[jobIndex].height = height;
          }
          return updated;
        });
      } else {
        setJobs(prev => {
          const updated = [...prev];
          const jobIndex = updated.findIndex(j => j.id === jobId);
          if (jobIndex !== -1) {
            updated[jobIndex].status = "failed";
            updated[jobIndex].error = result.error || "Resize failed";
          }
          return updated;
        });
      }

    } catch (error) {
      console.error("Resize error:", error);
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

  // Preset change handler
  const handlePresetChange = (preset: { name: string; width: number; height: number }) => {
    setWidth(preset.width);
    setHeight(preset.height);
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
              Video Resizer
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

        {/* Resize Settings */}
        {selectedFile && (
          <section className="mb-8 p-4 rounded-xl bg-muted/50 border-border">
            <h3 className="font-medium mb-3">Resize Settings</h3>

            {/* Presets */}
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2">Quick Presets:</p>
              <div className="grid grid-cols-3 gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => handlePresetChange(preset)}
                    className={`px-3 py-1 text-sm rounded ${width === preset.width && height === preset.height ? "bg-primary text-primary-foreground" : ""}`}
                    aria-label="Resize to: ${preset.name}"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom dimensions */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">Custom Dimensions:</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  className="input-field"
                  aria-label="Width"
                  style={{ minWidth: "80px" }}
                />
                <span>×</span>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="input-field"
                  aria-label="Height"
                  style={{ minWidth: "80px" }}
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={maintainAspectRatio}
                  onChange={(e) => setMaintainAspectRatio(e.target.checked)}
                  className="rounded border-border"
                  aria-label "Maintain aspect ratio"
                />
                Maintain aspect ratio
              </label>
            </div>
            </div>
          </section>
        )}

        {/* Convert Button */}
        <div className="mb-8">
          <button
            onClick={startResizing}
            className="btn btn-primary w-full py-3 font-medium"
            disabled={!selectedFile || isProcessing}
            aria-label="Start video resize"
          >
            {isProcessing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Resizing...
            ) : (
              "Resize Video"
            )}
          </button>
        </div>

        {/* Jobs Queue */}
        <section className="mb-8">
          <h2 className="font-medium text-sm text-muted-foreground mb-3">
            Resize Jobs
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
            outputUrl={`/storage/temp/${jobs.find(j => j.status === "completed")?.id}/resized-${jobs.find(j => j.status === "completed")?.filename}`}
            outputName="resized-video"
            outputFormat="mp4"
            outputResolution={jobs.find(j => j.status === "completed")?.outputResolution || "1920×1080"}
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