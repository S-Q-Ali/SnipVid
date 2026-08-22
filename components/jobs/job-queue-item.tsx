import { Loader2, X, CheckCircle, Clock } from "lucide-react";

export interface JobStatus {
  id: string;
  filename: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  elapsedTime: string;
  estimatedRemaining: string;
  fileSize: string;
  outputSize?: string;
  error?: string;
}

export interface JobQueueItemProps {
  job: JobStatus;
  onCancel?: (jobId: string) => void;
  onRetry?: (jobId: string) => void;
}

export function JobQueueItem({ job, onCancel, onRetry }: JobQueueItemProps) {
  const statusColors: Record<JobStatus["status"], string> = {
    pending: "text-muted-foreground",
    processing: "text-primary",
    completed: "text-success",
    failed: "text-error",
    cancelled: "text-muted-foreground",
  };

  const statusLabels: Record<JobStatus["status"], string> = {
    pending: "Pending",
    processing: "Processing",
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled",
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border-border">
      <div className="flex-shrink-0">
        <Loader2 className="h-5 w-5 animate-spin" jobId={job.id} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{job.filename}</p>
        <p className="text-xs text-muted-foreground truncate">
          {job.status}
        </p>
      </div>

      <div className="flex-1 flex flex-col gap-1">
        <ProgressBar
          progress={job.progress}
          status={statusLabels[job.status]}
          elapsed={job.elapsedTime}
          remaining={job.estimatedRemaining}
          showPercentage={false}
        />

        {job.status === "processing" && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{job.elapsedTime}</span>
            <span>{job.estimatedRemaining}</span>
          </div>
        )}

        {job.status === "completed" && (
          <div className="flex justify-between text-xs text-success">
            <span>Completed</span>
            {job.outputSize && <span>{job.outputSize}</span>}
          </div>
        )}

        {job.status === "failed" && (
          <div className="flex justify-between text-xs text-error">
            <span>Failed</span>
            {job.error && <span>{job.error.substring(0, 50)}</span>}
          </div>
        )}

        {onCancel && (
          <button
            type="button"
            className="mt-1 text-xs text-primary hover:text-primary/80"
            onClick={() => onCancel(job.id)}
            aria-label="Cancel job"
          >
            Cancel
          </button>
        )}

        {onRetry && job.status === "failed" && (
          <button
            type="button"
            className="mt-1 text-xs text-primary hover:text-primary/80"
            onClick={() => onRetry(job.id)}
            aria-label="Retry job"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}