"use client";

import * as React from "react";
import { Loader2, Download, RefreshCcw } from "lucide-react";

import { UploadZone } from "@/components/upload/upload-zone";
import { JobQueueItem } from "@/components/jobs/job-queue-item";

export interface ConversionToolProps {
  title: string;
  description?: string;
  defaultOutputFormat?: string;
  formats?: { value: string; label: string; description?: string }[];
  actionLabel?: string;
  operation?: string;
  settingsFields?: Array<{
    name: string;
    label: string;
    type?: "text" | "select" | "number";
    options?: { value: string; label: string }[];
    placeholder?: string;
    defaultValue?: string;
  }>;
}

interface Job {
  id: string;
  filename: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  error?: string;
  outputSize?: string;
  outputName?: string;
  outputUrl?: string;
}

export function ConversionTool({
  title,
  description,
  defaultOutputFormat = "mp4",
  formats = [
    { value: "mp4", label: "MP4", description: "H.264 video, AAC audio" },
    { value: "mov", label: "MOV", description: "QuickTime format" },
    { value: "mkv", label: "MKV", description: "Matroska format" },
    { value: "webm", label: "WebM", description: "WebM format" },
    { value: "avi", label: "AVI", description: "Audio Video Interleave" },
  ],
  actionLabel = "Convert Video",
  operation = "convert",
  settingsFields = [],
}: ConversionToolProps) {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [outputFormat, setOutputFormat] = React.useState<string>(defaultOutputFormat);
  const [settings, setSettings] = React.useState<Record<string, string>>({});
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleFilesSelected = (files: FileList) => {
    if (files.length > 0) {
      setSelectedFile(files[0]);
      setError(null);
    }
  };

  const updateSetting = (name: string, value: string) => {
    setSettings((prev) => ({ ...prev, [name]: value }));
  };

  const handleConvert = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError(null);

    const jobId = crypto.randomUUID();
    const newJob: Job = {
      id: jobId,
      filename: selectedFile.name,
      status: "pending",
      progress: 0,
    };
    setJobs((prev) => [newJob, ...prev]);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("format", outputFormat);
      formData.append("operation", operation);

      // Add operation settings
      for (const field of settingsFields) {
        const value = settings[field.name] ?? field.defaultValue;
        if (value) {
          formData.append(field.name, value);
        }
      }

      const res = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start processing");
      }

      const serverJobId = data.jobId as string;

      const poll = async () => {
        const statusRes = await fetch(`/api/convert?jobId=${serverJobId}`);
        const status = await statusRes.json();

        if (status.status === "completed") {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === jobId
                ? {
                    ...j,
                    status: "completed",
                    progress: 100,
                    outputSize: status.outputSizeReadable || undefined,
                    outputName: status.outputName || undefined,
                    outputUrl: status.outputUrl || undefined,
                  }
                : j
            )
          );
          setIsProcessing(false);
          return;
        }

        if (status.status === "processing" || status.status === "not_found") {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === jobId ? { ...j, status: "processing", progress: Math.min(90, j.progress + 5) } : j
            )
          );
          setTimeout(poll, 2000);
          return;
        }

        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? { ...j, status: "failed", error: status.error || "Processing failed" }
              : j
          )
        );
        setIsProcessing(false);
      };

      poll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Processing failed";
      setError(msg);
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId ? { ...j, status: "failed", error: msg } : j
        )
      );
      setIsProcessing(false);
    }
  };

  const completedJob = jobs.find((j) => j.status === "completed");

  return (
    <div>
      {description && (
        <p className="text-sm text-muted-foreground mb-6 max-w-2xl">{description}</p>
      )}

      {/* File selection */}
      <UploadZone
        acceptedFiles="video/*,audio/*"
        onFilesSelected={handleFilesSelected}
        multiple={false}
        onRemove={() => setSelectedFile(null)}
      />

      {/* Options */}
      {selectedFile && (
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="output-format" className="text-sm font-medium mb-1.5 block">
              Output format
            </label>
            <select
              id="output-format"
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              className="input-field w-full"
            >
              {formats.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                  {f.description ? ` - ${f.description}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Operation-specific settings */}
          {settingsFields.map((field) => (
            <div key={field.name}>
              <label htmlFor={field.name} className="text-sm font-medium mb-1.5 block">
                {field.label}
              </label>
              {field.type === "select" ? (
                <select
                  id={field.name}
                  value={settings[field.name] ?? field.defaultValue ?? ""}
                  onChange={(e) => updateSetting(field.name, e.target.value)}
                  className="input-field w-full"
                >
                  {(field.options || []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={field.name}
                  type={field.type || "text"}
                  value={settings[field.name] ?? field.defaultValue ?? ""}
                  onChange={(e) => updateSetting(field.name, e.target.value)}
                  className="input-field w-full"
                  placeholder={field.placeholder}
                />
              )}
            </div>
          ))}

          {/* Selected file info */}
          <div className="p-3 rounded-lg bg-muted/40 text-sm">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="text-sm text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${selectedFile.name}`}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900">
          {error}
        </div>
      )}

      {/* Process button */}
      <button
        onClick={handleConvert}
        disabled={!selectedFile || isProcessing}
        className="btn btn-primary w-full py-3 font-medium mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={actionLabel}
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          actionLabel
        )}
      </button>

      {/* Jobs queue */}
      {jobs.length > 0 && (
        <div className="mt-8">
          <h2 className="font-medium text-sm text-muted-foreground mb-3">
            Processing Jobs
          </h2>
          <div className="space-y-3">
            {jobs.map((job) => (
              <JobQueueItem
                key={job.id}
                job={{
                  ...job,
                  elapsedTime: job.status === "processing" ? "Processing" : undefined,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {completedJob && (
        <div className="mt-6 p-4 rounded-xl bg-card border border-border">
          <h3 className="font-medium mb-3">Output</h3>
          <div className="space-y-2 text-sm">
            {completedJob.outputName && (
              <p>
                <span className="text-muted-foreground">Filename:</span>{" "}
                <span className="font-medium">{completedJob.outputName}</span>
              </p>
            )}
            {completedJob.outputSize && (
              <p>
                <span className="text-muted-foreground">Size:</span>{" "}
                <span className="font-medium">{completedJob.outputSize}</span>
              </p>
            )}
          </div>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <a
              href={completedJob.outputUrl || `/api/download/${completedJob.id}/output`}
              download
              className="btn btn-primary flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
            <button
              onClick={() => {
                setSelectedFile(null);
                setJobs([]);
                setSettings({});
              }}
              className="btn btn-ghost flex items-center justify-center gap-2 text-sm"
            >
              <RefreshCcw className="h-4 w-4" />
              Process Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}