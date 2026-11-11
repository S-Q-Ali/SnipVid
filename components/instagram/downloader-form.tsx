"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardPaste,
  Download,
  Image as ImageIcon,
  Link2,
  Loader2,
  PlayCircle,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

type MediaType = "post" | "reel" | "story" | "highlight" | "profile";

interface MediaItem {
  id: string;
  index?: number;
  kind: "video" | "image";
  title: string;
}

interface AnalyzeResult {
  mediaType: MediaType;
  title: string;
  uploader?: string;
  thumbnail?: string;
  duration?: number;
  isCarousel: boolean;
  media: MediaItem[];
  /** How many items the source really has, when the server capped the list. */
  totalItems?: number;
}

interface JobFile {
  name: string;
  url: string;
}

interface Job {
  id: string;
  mediaType: MediaType;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  files: JobFile[];
  error?: string;
}

const MEDIA_LABEL: Record<MediaType, string> = {
  post: "Post",
  reel: "Reel",
  story: "Story",
  highlight: "Highlight",
  profile: "Profile",
};

function cleanError(body: unknown, isAnalyze = false): string {
  const raw =
    body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
      ? ((body as { error: string }).error ?? "").trim()
      : "";
  if (!raw) return "Something went wrong. Please try again.";
  if (isAnalyze && /Only Instagram/i.test(raw)) {
    return "Please paste a valid Instagram link (public posts, reels, photos, and carousels).";
  }
  if (isAnalyze && /anonymous|login|disabled/i.test(raw)) {
    return "This content is not accessible anonymously. Instagram requires login for private posts, stories, highlights, and some public links.";
  }
  return raw;
}

function prettySeconds(total?: number): string {
  if (typeof total !== "number" || !Number.isFinite(total) || total <= 0) return "";
  const s = Math.round(total);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function triggerBrowserDownload(file: JobFile): void {
  const link = document.createElement("a");
  link.href = file.url;
  link.download = file.name;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function InstagramDownloaderForm() {
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [startingIndex, setStartingIndex] = useState<number | "all" | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autoDownloadedJobRef = useRef<string | null>(null);

  const truncated = Boolean(
    result?.totalItems && result.totalItems > result.media.length
  );

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => {
    if (
      job?.status === "completed" &&
      job.files.length > 0 &&
      autoDownloadedJobRef.current !== job.id
    ) {
      autoDownloadedJobRef.current = job.id;
      triggerBrowserDownload(job.files[0]);
    }
  }, [job]);

  const running =
    analyzing || downloading || job?.status === "pending" || job?.status === "processing";

  const handleReset = useCallback(() => {
    stopPolling();
    autoDownloadedJobRef.current = null;
    setUrl("");
    setAnalyzeError("");
    setDownloadError("");
    setResult(null);
    setThumbFailed(false);
    setJob(null);
    inputRef.current?.focus();
  }, [stopPolling]);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setUrl(text.trim());
        setAnalyzeError("");
      } else {
        inputRef.current?.focus();
      }
    } catch {
      inputRef.current?.focus();
    }
  }, []);

  const handleAnalyze = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      if (running) return;
      const trimmed = url.trim();
      if (!trimmed) {
        setAnalyzeError("Paste an Instagram link to get started.");
        return;
      }
      stopPolling();
      setAnalyzing(true);
      setAnalyzeError("");
      setResult(null);
      setThumbFailed(false);
      setJob(null);
      setDownloadError("");
      try {
        const res = await fetch("/api/instagram/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmed }),
        });
        const body = await res.json();
        if (!res.ok) {
          setAnalyzeError(cleanError(body, true));
          return;
        }
        setResult(body as AnalyzeResult);
      } catch {
        setAnalyzeError("Could not reach the server. Please try again.");
      } finally {
        setAnalyzing(false);
      }
    },
    [url, running, stopPolling]
  );

  const handleDownload = useCallback(
    async (itemIndex?: number) => {
      const trimmed = url.trim();
      if (!trimmed) return;
      stopPolling();
      autoDownloadedJobRef.current = null;
      setDownloading(true);
      setStartingIndex(itemIndex ?? "all");
      setDownloadError("");
      setJob(null);
      try {
        const res = await fetch("/api/instagram/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            itemIndex === undefined ? { url: trimmed } : { url: trimmed, itemIndex }
          ),
        });
        const body = await res.json();
        if (!res.ok) {
          setDownloadError(cleanError(body));
          return;
        }
        const jobId: string = body.jobId;
        pollTimer.current = setInterval(async () => {
          try {
            const pollRes = await fetch(`/api/instagram/jobs/${encodeURIComponent(jobId)}`, {
              cache: "no-store",
            });
            if (!pollRes.ok) {
              stopPolling();
              setJob(null);
              if (pollRes.status === 404) {
                setDownloadError(
                  "This download job expired or could not be found. Please start a new download."
                );
                return;
              }
              const errBody = await pollRes.json().catch(() => null);
              setDownloadError(cleanError(errBody));
              return;
            }
            const j: Job = await pollRes.json();
            setJob(j);
            if (j.status === "completed" || j.status === "failed") {
              stopPolling();
            }
          } catch {
            stopPolling();
            setJob(null);
            setDownloadError("Lost connection while checking download progress.");
          }
        }, 1200);
      } catch {
        setDownloadError("Could not start the download. Please try again.");
      } finally {
        setDownloading(false);
        setStartingIndex(null);
      }
    },
    [url, stopPolling]
  );

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm sm:p-5">
        <form onSubmit={handleAnalyze} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <label htmlFor="instagram-url" className="sr-only">
              Instagram link
            </label>
            <Link2
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              ref={inputRef}
              id="instagram-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://www.instagram.com/reel/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="min-h-[46px] w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-20 text-sm text-foreground placeholder:text-muted-foreground/75 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {url ? (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={running}
                  aria-label="Clear link"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  disabled={running}
                  aria-label="Paste link from clipboard"
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-secondary px-2.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
                >
                  <ClipboardPaste className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Paste</span>
                </button>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={running}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {analyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{analyzing ? "Analyzing…" : "Analyze"}</span>
          </button>
        </form>

        <p className="mt-2.5 text-xs text-muted-foreground">
          Supports public links like <span className="font-medium text-foreground">instagram.com/reel/...</span>,{" "}
          <span className="font-medium text-foreground">instagram.com/p/...</span>, and carousels.
        </p>
      </div>

      {analyzeError && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{analyzeError}</span>
        </div>
      )}

      {downloadError && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{downloadError}</span>
        </div>
      )}

      {result && !job && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row">
            {result.thumbnail && !thumbFailed ? (
              <div className="shrink-0">
                <img
                  src={result.thumbnail}
                  alt=""
                  onError={() => setThumbFailed(true)}
                  className="h-28 w-28 rounded-xl border border-border object-cover"
                  width={112}
                  height={112}
                />
              </div>
            ) : (
              <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground">
                {result.mediaType === "reel" ? (
                  <PlayCircle className="h-8 w-8" aria-hidden="true" />
                ) : (
                  <ImageIcon className="h-8 w-8" aria-hidden="true" />
                )}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {result.mediaType === "reel" ? (
                    <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {MEDIA_LABEL[result.mediaType]}
                </span>
                {result.duration ? (
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                    {prettySeconds(result.duration)}
                  </span>
                ) : null}
                {result.isCarousel && (
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                    {result.media.length} items
                  </span>
                )}
              </div>
              <h2 className="line-clamp-2 font-display text-base font-semibold text-foreground">
                {result.title}
              </h2>
              {result.uploader && (
                <p className="mt-1 text-sm text-muted-foreground">@{result.uploader}</p>
              )}
              {truncated && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing the first {result.media.length} of {result.totalItems} items. Download
                  individual items below, or use bulk download to fetch up to 50 at a time.
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2.5 border-t border-border pt-4">
            {result.isCarousel && result.media.length > 1 ? (
              <>
                {result.media.map((item, position) => {
                  const number = item.index ?? position + 1;
                  const busy = downloading && startingIndex === number;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleDownload(number)}
                      disabled={running}
                      className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : item.kind === "image" ? (
                        <ImageIcon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      ) : (
                        <PlayCircle className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      )}
                      <span>
                        {item.kind === "image" ? "Photo" : "Video"} {number}
                      </span>
                      {!busy && <Download className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handleDownload()}
                  disabled={running}
                  className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {downloading && startingIndex === "all" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>
                    {downloading && startingIndex === "all"
                      ? "Starting…"
                      : `Download all ${result.media.length} items (.zip)`}
                  </span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handleDownload()}
                disabled={running}
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{downloading ? "Starting…" : "Download media"}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {job && (
        <div
          role="status"
          aria-live="polite"
          className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              {job.status === "completed" ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span>Download started</span>
                </>
              ) : job.status === "failed" ? (
                <>
                  <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
                  <span>Download failed</span>
                </>
              ) : (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                  <span>{job.status === "pending" ? "Queued…" : "Preparing download…"}</span>
                </>
              )}
            </span>
            {job.status === "processing" && (
              <span className="text-sm font-medium text-muted-foreground">{job.progress}%</span>
            )}
          </div>

          {job.status === "processing" && (
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, Math.round(job.progress))}
              className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${Math.min(100, job.progress)}%` }}
              />
            </div>
          )}

          {job.status === "completed" && job.files.length > 0 && (
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                Your download started automatically. If your browser blocked it, click the button
                below to save manually.
              </p>
              <div className="flex flex-wrap gap-2">
                {job.files.map((file) => (
                  <a
                    key={file.url}
                    href={file.url}
                    download={file.name}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="break-all">{file.name}</span>
                  </a>
                ))}
              </div>
              <div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Download another link</span>
                </button>
              </div>
            </div>
          )}

          {job.status === "failed" && (
            <div className="mt-3 flex flex-col gap-3">
              <p role="alert" className="text-sm text-destructive">
                {job.error ?? "The download failed unexpectedly."}
              </p>
              <div>
                <button
                  type="button"
                  onClick={() => setJob(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Back to preview</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        <span>Anonymous access — public Instagram content only.</span>
      </p>
    </div>
  );
}
