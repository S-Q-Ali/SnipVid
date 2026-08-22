import { Search, Loader2, CheckCircle, X, FolderUpload, Mouse, Image, Music, Crop, Scissors, FormatAudio, Layout, Repeat, Video, Trash, Calendar, AlignCenter, Zap } from "lucide-react";

import { UploadZone } from "@/components/upload/upload-zone";
import { FormatSelector } from "@/components/converter/format-selector";
import { ProgressBar } from "@/components/progress/progress-bar";
import { ResultCard } from "@/components/results/result-card";
import { JobQueueItem } from "@/components/jobs/job-queue-item";
import { ToolNavigation } from "@/components/header/tool-navigation";
import { FfmpegService } from "@/lib/ffmpeg/service";
import { ConversionPreset } from "@/lib/ffmpeg/service";

export interface CompressionJob {
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
  crf?: number;
  bitrate?: string;
}

export default function VideoCompressorPage() {
  const [jobs, setJobs] = React.useState<CompressionJob[]>([]);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [crf, setCrf] = React.useState<number>(23);
  const [bitrate, setBitrate] = React.useState<string | undefined>("5000k");
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [ffmpegService] = React.useState(() => new FfmpegService());

  // Compression presets
  const presets = [
    { name: "Small", crf: 28, bitrate: "1500k", description: "Smallest file size" },
    { name: "Balanced", crf: 23, bitrate: "3000k", description: "Good balance of size/quality" },
    { name: "High Quality", crf: 18, bitrate: "5000k", description: "High quality output" },
  ];

  // Upload handling
  const handleFilesSelected = (files: FileList) => {
    if (files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  // Start compression
  const startCompression = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setJobs([...jobs, {
      id: uuidv4(),
      filename: selectedFile.name,
      status: "pending",
      progress: 0,
    }]);

    try {
      const jobId = jobs[jobs.length].id;
      const tempDir = path.join(process.cwd(), "storage", "temp", jobId);
      const inputPath = path.join(tempDir, selectedFile.name);
      const outputPath = path.join(tempDir, `compressed-${selectedFile.name}`);

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

      // Build FFmpeg compression arguments
      const args = [
        "-y",
        "-i", inputPath,
        "-c:v", "libx264",
        "-c:a", "aac",
        "-crf", String(crf),
        ...(bitrate ? ["-b:a", bitrate] : []),
        "-preset", "medium",
        outputPath,
      ];

      // Run FFmpeg compression
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
            updated[jobIndex].crf = crf;
            updated[jobIndex].bitrate = bitrate;
          }
          return updated;
        });
      } else {
        setJobs(prev => {
          const updated = [...prev];
          const jobIndex = updated.findIndex(j => j.id === jobId);
          if (jobIndex !== -1) {
            updated[jobIndex].status = "failed";
            updated[jobIndex].error = result.error || "Compression failed";
          }
          return updated;
        });
      }

    } catch (error) {
      console.error("Compression error:", error);
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
  const handlePresetChange = (preset: { name: string; crf: number; bitrate: string }) => {
    setCrf(preset.crf);
    setBitrate(preset.bitrate);
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
              Video Compressor
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

        {/* Compression Settings */}
        {selectedFile && (
          <section className="mb-8 p-4 rounded-xl bg-muted/50 border-border">
            <h3 className="font-medium mb-3">Compression Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">CRF (Quality)</p>
                <p className="font-medium">{crf}</p>
                <small className="text-xs">
                  Lower = Better Quality (10-51, default 23)</small>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Target Bitrate</p>
                <p className="font-medium">{bitrate}</p>
              </div>
            </div>

            {/* Presets */}
            <div className="mt-4">
              <p className="text-xs text-muted-foreground mb-2">Quick Presets:</p>
              <div className="grid grid-cols-3 gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => handlePresetChange(preset)}
                    className={`px-3 py-1 text-sm rounded ${crf === preset.crf ? "bg-primary text-primary-foreground" : ""}`}
                    aria-label="Select preset: ${preset.name}"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Convert Button */}
        <div className="mb-8">
          <button
            onClick={startCompression}
            className="btn btn-primary w-full py-3 font-medium"
            disabled={!selectedFile || isProcessing}
            aria-label="Start video compression"
          >
            {isProcessing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Compressing...
            ) : (
              "Compress Video"
            )}
          </button>
        </div>

        {/* Jobs Queue */}
        <section className="mb-8">
          <h2 className="font-medium text-sm text-muted-foreground mb-3">
            Compression Jobs
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
            outputUrl={`/storage/temp/${jobs.find(j => j.status === "completed")?.id}/compressed-${jobs.find(j => j.status === "completed")?.filename}`}
            outputName="compressed-video"
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