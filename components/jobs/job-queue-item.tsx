import { Loader2, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";

export interface JobStatus {
  id: string;
  filename: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  elapsedTime?: string;
  estimatedRemaining?: string;
  fileSize?: string;
  outputSize?: string;
  error?: string;
}

export interface JobQueueItemProps {
  job: JobStatus;
  onCancel?: (jobId: string) => void;
  onRetry?: (jobId: string) => void;
}

export function JobQueueItem({ job, onCancel, onRetry }: JobQueueItemProps) {
  const statusLabels: Record<JobStatus["status"], string> = {
    pending: "Pending",
    processing: "Processing",
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled",
  };

  const StatusIcon = {
    pending: Clock,
    processing: Loader2,
    completed: CheckCircle2,
    failed: XCircle,
    cancelled: AlertCircle,
  }[job.status];

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border">
      <div className="flex-shrink-0 mt-0.5">
        <StatusIcon
          className={`h-5 w-5 ${job.status === "processing" ? "animate-spin" : ""} ${
            job.status === "completed"
              ? "text-green-600 dark:text-green-400"
              : job.status === "failed"
                ? "text-red-600 dark:text-red-400"
                : "text-muted-foreground"
          }`}
          aria-hidden="true"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium truncate text-sm">{job.filename}</p>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {statusLabels[job.status]}
          </span>
        </div>

        {/* Simple progress bar */}
        <div className="mt-2">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${Math.max(0, Math.min(100, job.progress))}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{Math.round(job.progress)}%</span>
            <span>
              {job.elapsedTime || ""}
              {job.elapsedTime && job.estimatedRemaining ? " · " : ""}
              {job.estimatedRemaining || ""}
            </span>
          </div>
        </div>

        {job.status === "failed" && job.error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{job.error}</p>
        )}

        {job.status === "completed" && job.outputSize && (
          <p className="mt-1 text-xs text-muted-foreground">Output: {job.outputSize}</p>
        )}

        {(onCancel || (onRetry && job.status === "failed")) && (
          <div className="mt-2 flex gap-3">
            {onCancel && (job.status === "pending" || job.status === "processing") && (
              <button
                type="button"
                className="text-xs text-primary hover:underline underline-offset-2"
                onClick={() => onCancel(job.id)}
                aria-label={`Cancel ${job.filename}`}
              >
                Cancel
              </button>
            )}
            {onRetry && job.status === "failed" && (
              <button
                type="button"
                className="text-xs text-primary hover:underline underline-offset-2"
                onClick={() => onRetry(job.id)}
                aria-label={`Retry ${job.filename}`}
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}