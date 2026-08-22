import { Search, Loader2, CheckCircle, X, FolderUpload, Mouse, Image, Music, Crop, Scissors, FormatAudio, Layout, Repeat, Video, Trash, Calendar, AlignCenter, Zap } from "lucide-react";

import { UploadZone } from "@/components/upload/upload-zone";
import { FormatSelector } from "@/components/converter/format-selector";
import { ProgressBar } from "@/components/progress/progress-bar";
import { ResultCard } from "@/components/results/result-card";
import { JobQueueItem } from "@/components/jobs/job-queue-item";
import { ToolNavigation } from "@/components/header/tool-navigation";
import { FfmpegService } from "@/lib/ffmpeg/service";

export interface ConversionJob {
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
}

import os from "os";

export default function VideoConverterPage() {
  const [jobs, setJobs] = React.useState<ConversionJob[]>([]);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [selectedOutputFormat, setSelectedOutputFormat] = React.useState<string>("mp4");
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [ffmpegService] = React.useState(() => new FfmpegService());

  // Load available formats
  const formats: FormatSelectorProps["options"] = [
    { value: "mp4", label: "MP4", description: "H.264 video, AAC audio" },
    { value: "mkv", label: "MKV", description: "Matroska format" },
    { value: "mov", label: "MOV", description: "QuickTime format" },
    { value: "avi", label: "AVI", description: "Audio Video Interleave" },
    { value: "webm", label: "WebM", description: "WebM format" },
    { value: "mpeg4", label: "MPEG-4", description: "MPEG-4 codec" },
  ];

  // Upload handling
  const handleFilesSelected = (files: FileList) => {
    if (files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  // Start conversion
  const startConversion = async () => {
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
      const outputPath = path.join(tempDir, `output-${selectedOutputFormat}.mp4`);

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

      // Build FFmpeg conversion arguments
      const preset = FfmpegService.getDefaultPreset("h264", "mp4");
      const args = [
        "-y",
        "-i", inputPath,
        "-c:v", preset.videoCodec,
        "-c:a", preset.audioCodec,
        ...(preset.crf !== undefined ? ["-crf", String(preset.crf)] : []),
        ...(preset.width !== undefined ? ["-s", preset.width] : []),
        outputPath,
      ];

      // Run FFmpeg conversion
      const result = await FfmpegService.spawn(inputPath, outputPath, args, 300000);

      if (result.success && result.completed) {
        // Conversion completed - update job status
        setJobs(prev => {
          const updated = [...prev];
          const jobIndex = updated.findIndex(j => j.id === jobId);
          if (jobIndex !== -1) {
            updated[jobIndex].status = "completed";
            updated[jobIndex].progress = 100;
            updated[jobIndex].outputFormat = selectedOutputFormat;
            updated[jobIndex].outputResolution = "1920×1080";
            updated[jobIndex].outputSize = "45.3 MB";
          }
          return updated;
        });
      } else {
        // Conversion failed
        setJobs(prev => {
          const updated = [...prev];
          const jobIndex = updated.findIndex(j => j.id === jobId);
          if (jobIndex !== -1) {
            updated[jobIndex].status = "failed";
            updated[jobIndex].error = result.error || "Conversion failed";
          }
          return updated;
        });
      }

    } catch (error) {
      console.error("Conversion error:", error);
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

  // Format change handler
  const handleFormatSelect = (value: string) => {
    setSelectedOutputFormat(value);
  };

  // UUID helper
  function uuidv4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Format size helper
  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <header className="border-b border-border bg-card/80 backdrop-blur-sm mb-6">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <h1 className="font-bold text-2xl tracking-tighter">
              Video Converter
            </h1>
            <div className="flex items-center gap-3">
              <FormatSelector
                value={selectedOutputFormat}
                onSelect={handleFormatSelect}
                options={formats}
              />
            </div>
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

        {/* Jobs Queue */}
        <section className="mb-8">
          <h2 className="font-medium text-sm text-muted-foreground mb-3">
            Processing Jobs
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

        {/* Convert Button */}
        <div className="mt-6 pt-6 border-t border-border">
          <button
            onClick={startConversion}
            className="btn btn-primary w-full py-3 font-medium"
            disabled={!selectedFile || isProcessing}
            aria-label="Start video conversion"
          >
            {isProcessing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            ) : (
              "Convert Video"
            )}
          </button>
        </div>

        {/* Result Card (shown after completion) */}
        {jobs.some((job) => job.status === "completed") && (
          <ResultCard
            outputUrl={`/api/download/${jobs.find(j => j.status === "completed")?.id}/output.mp4`}
            outputName="converted-video"
            outputFormat="mp4"
            outputResolution="1920×1080"
            outputSize="45.3 MB"
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