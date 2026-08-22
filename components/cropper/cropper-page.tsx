import { Search, Loader2, CheckCircle, X, FolderUpload, Mouse, Image, Music, Crop, Scissors, FormatAudio, Layout, Repeat, Video, Trash, Calendar, AlignCenter, Zap } from "lucide-react";

import { UploadZone } from "@/components/upload/upload-zone";
import { FormatSelector } from "@/components/converter/format-selector";
import { ProgressBar } from "@/components/progress/progress-bar";
import { ResultCard } from "@/components/results/result-card";
import { JobQueueItem } from "@/components/jobs/job-queue-item";
import { ToolNavigation } from "@/components/header/tool-navigation";
import { FfmpegService } from "@/lib/ffmpeg/service";

export interface CropJob {
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
  cropArea?: "16:9" | "9:16" | "1:1" | "4:5" | "4:3";
  customX?: number;
  customY?: number;
  customWidth?: number;
  customHeight?: number;
}

export default function VideoCropperPage() {
  const [jobs, setJobs] = React.useState<CropJob[]>([]);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [cropArea, setCropArea] = React.useState<"16:9" | "9:16" | "1:1" | "4:5" | "4:3">("16:9");
  const [customX, setCustomX] = React.useState<number>(0);
  const [customY, setCustomY] = React.useState<number>(0);
  const [customWidth, setCustomWidth] = React.useState<number>(1920);
  const [customHeight, setCustomHeight] = React.useState<number>(1080);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [ffmpegService] = React.useState(() => new FfmpegService());

  // Common aspect ratios
  const aspectRatios = [
    { label: "16:9", value: "16:9" },
    { label: "9:16", value: "9:16" },
    { label: "1:1", value: "1:1" },
    { label: "4:5", value: "4:5" },
    { label: "4:3", value: "4:3" },
  ];

  // Upload handling
  const handleFilesSelected = (files: FileList) => {
    if (files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  // Start cropping
  const startCropping = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setJobs([...jobs, {
      id: uuidv4(),
      filename: selectedFile.name,
      status: "pending",
      progress: 0,
      cropArea,
    }]);

    try {
      const jobId = jobs[jobs.length].id;
      const tempDir = path.join(process.cwd(), "storage", "temp", jobId);
      const inputPath = path.join(tempDir, selectedFile.name);
      const outputPath = path.join(tempDir, `cropped-${selectedFile.name}.mp4`);

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

      // Build FFmpeg crop arguments based on aspect ratio
      let cropArgs: string[];

      if (cropArea === "16:9") {
        cropArgs = [
          "-y",
          "-i", inputPath,
          "-vf", "crop=1920:1080:0:0",
          "-c:v", "libx264",
          "-c:a", "aac",
          "-preset", "medium",
          "-crf", "23",
          outputPath,
        ];
      } else if (cropArea === "9:16") {
        cropArgs = [
          "-y",
          "-i", inputPath,
          "-vf", "crop=1080:1920:0:0",
          "-c:v", "libx264",
          "-c:a", "aac",
          "-preset", "medium",
          "-crf", "23",
          outputPath,
        ];
      } else if (cropArea === "1:1") {
        cropArgs = [
          "-y",
          "-i", inputPath,
          "-vf", "crop=1080:1080:0:0",
          "-c:v", "libx264",
          "-c:a", "aac",
          "-preset", "medium",
          "-crf", "23",
          outputPath,
        ];
      } else if (cropArea === "4:5") {
        cropArgs = [
          "-y",
          "-i", inputPath,
          "-vf", "crop=1080:1350:0:0",
          "-c:v", "libx264",
          "-c:a", "aac",
          "-preset", "medium",
          "-crf", "23",
          outputPath,
        ];
      } else if (cropArea === "4:3") {
        cropArgs = [
          "-y",
          "-i", inputPath,
          "-vf", "crop=1440:1080:0:0",
          "-c:v", "libx264",
          "-c:a", "aac",
          "-preset", "medium",
          "-crf", "23",
          outputPath,
        ];
      } else {
        // Custom crop
        cropArgs = [
          "-y",
          "-i", inputPath,
          `-vf`, `crop=${customWidth}:${customHeight}:${customX}:${customY}`,
          "-c:v", "libx264",
          "-c:a", "aac",
          "-preset", "medium",
          "-crf", "23",
          outputPath,
        ];
      }

      // Run FFmpeg crop
      const result = await FfmpegService.spawn(inputPath, outputPath, cropArgs, 300000);

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
            updated[jobIndex].outputResolution = `${customWidth || 1920}×${customHeight || 1080}`;
            updated[jobIndex].outputSize = FfmpegService.formatBytes(outputSize);
          }
          return updated;
        });
      } else {
        setJobs(prev => {
          const updated = [...prev];
          const jobIndex = updated.findIndex(j => j.id === jobId);
          if (jobIndex !== -1) {
            updated[jobIndex].status = "failed";
            updated[jobIndex].error = result.error || "Crop failed";
          }
          return updated;
        });
      }

    } catch (error) {
      console.error("Crop error:", error);
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

  // Aspect ratio change handler
  const handleAspectRatioChange = (value: "16:9" | "9:16" | "1:1" | "4:5" | "4:3") => {
    setCropArea(value);
    setCustomX(0);
    setCustomY(0);
    setCustomWidth(value === "4:5" ? 1080 : value === "4:3" ? 1440 : value === "1:1" ? 1080 : 1920);
    setCustomHeight(value === "4:5" ? 1350 : value === "4:3" ? 1080 : value === "1:1" ? 1080 : 1080);
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
              Video Cropper
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

        {/* Crop Settings */}
        {selectedFile && (
          <section className="mb-8 p-4 rounded-xl bg-muted/50 border-border">
            <h3 className="font-medium mb-3">Crop Settings</h3>

            {/* Aspect ratio presets */}
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2">Aspect Ratio Presets:</p>
              <div className="grid grid-cols-5 gap-1">
                {aspectRatios.map((ratio) => (
                  <button
                    key={ratio.value}
                    onClick={() => handleAspectRatioChange(ratio.value)}
                    className={`px-3 py-1 text-xs rounded ${cropArea === ratio.value ? "bg-primary text-primary-foreground" : ""}`}
                    aria-label="Crop to: ${ratio.label}"
                  >
                    {ratio.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom crop coordinates */}
            {cropArea === "custom" && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Custom Crop:</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={customX}
                    onChange={(e) => setCustomX(Number(e.target.value))}
                    className="input-field"
                    aria-label="X position"
                    style={{ minWidth: "80px" }}
                  />
                  <input
                    type="number"
                    value={customY}
                    onChange={(e) => setCustomY(Number(e.target.value))}
                    className="input-field"
                    aria-label="Y position"
                    style={{ minWidth: "80px" }}
                  />
                  <input
                    type="number"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(Number(e.target.value))}
                    className="input-field"
                    aria-label="Width"
                    style={{ minWidth: "80px" }}
                  />
                  <input
                    type="number"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(Number(e.target.value))}
                    className="input-field"
                    aria-label="Height"
                    style={{ minWidth: "80px" }}
                  />
                </div>
              </div>
            )}
          </section>
        )}

        {/* Convert Button }}
        <div className="mb-8">
          <button
            onClick={startCropping}
            className="btn btn-primary w-full py-3 font-medium"
            disabled={!selectedFile || isProcessing}
            aria-label="Start video crop"
          >
            {isProcessing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cropping...
            ) : (
              "Crop Video"
            )}
          </button>
        </div>

        {/* Jobs Queue }}
        <section className="mb-8">
          <h2 className="font-medium text-sm text-muted-foreground mb-3">
            Crop Jobs
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
            outputUrl={`/storage/temp/${jobs.find(j => j.status === "completed")?.id}/cropped-${jobs.find(j => j.status === "completed")?.filename}`}
            outputName="cropped-video"
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