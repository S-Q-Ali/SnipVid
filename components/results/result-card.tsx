export interface ResultCardProps {
  outputUrl?: string;
  outputName?: string;
  outputFormat?: string;
  outputResolution?: string;
  outputSize?: string;
  showPreview?: boolean;
  onDownload?: () => void;
  onConvertAgain?: () => void;
}

export function ResultCard({
  outputUrl,
  outputName,
  outputFormat,
  outputResolution,
  outputSize,
  showPreview = false,
  onDownload,
  onConvertAgain,
}: ResultCardProps) {
  const hasResult = !!outputUrl;

  return (
    <div className="rounded-2xl bg-card p-6 transition-all duration-300 hover:shadow-lg">
      {hasResult && (
        <div className="mb-4">
          <p className="text-sm text-muted-foreground mb-2">Output</p>
          <div className="flex items-center gap-2">
            <span className="font-medium">{outputName || "output"}</span>
            <span className="text-xs text-muted-foreground">.{outputFormat || "mp4"}</span>
          </div>
          {outputResolution && (
            <p className="text-xs text-muted-foreground mb-1">
              {outputResolution}
            </p>
          )}
          {outputSize && (
            <p className="text-xs text-muted-foreground">
              {outputSize}
            </p>
          )}
        </div>
      )}

      {showPreview && (
        <div className="mb-4 h-48 rounded-xl bg-muted overflow-hidden">
          <svg
            className="h-full w-full opacity-20"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M8 4h8v2H8zm0 4h8v2H8zm0 4h8v2H8zm0 4h8v2H8zm0 4h8v2H8zm0 4h8v2H8z" />
          </svg>
        </div>
      )}

      {hasResult && outputUrl && (
        <div className="flex gap-3">
          <a
            href={outputUrl}
            download={outputName || undefined}
            className="flex-1 btn btn-primary flex items-center justify-center gap-2"
            aria-label="Download processed video"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 8v8l-6-4-6 4v8h12v-8l-6-4-6 4z" />
            </svg>
            Download
          </a>
          <button
            onClick={onConvertAgain}
            className="btn btn-ghost flex items-center gap-2 text-sm hover:text-primary transition-colors"
            aria-label="Convert again"
          >
            Convert Again
          </button>
        </div>
      )}

      {!hasResult && (
        <p className="text-sm text-muted-foreground">
          Process a video to see results here.
        </p>
      )}
    </div>
  );
}