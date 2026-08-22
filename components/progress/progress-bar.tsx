export interface ProgressBarProps {
  progress: number;
  status?: string;
  elapsed?: string;
  remaining?: string;
  showPercentage?: boolean;
}

export function ProgressBar({
  progress,
  status,
  elapsed,
  remaining,
  showPercentage = true,
}: ProgressBarProps) {
  const progressPercent = Math.max(0, Math.min(100, progress));

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="relative">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {showPercentage && (
          <span
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-primary"
          >
            {Math.round(progressPercent)}%
          </span>
        )}
      </div>

      {/* Status text */}
      {status && (
        <p className="text-xs text-muted-foreground">{status}</p>
      )}

      {/* Time info */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{elapsed || "0:00"}</span>
        <span>{remaining || "0:00"}</span>
      </div>
    </div>
  );
}