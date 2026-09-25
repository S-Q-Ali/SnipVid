"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertCircle,
  Download,
  Image as ImageIcon,
  Link2,
  Loader2,
  PlayCircle,
  Search,
  ShieldCheck,
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
    return "Only Instagram post, reel, story, highlight, and profile links are supported.";
  }
  if (isAnalyze && /anonymous|login|disabled/i.test(raw)) {
    return "This content is not accessible anonymously. Only public posts, reels, stories, and photos can be downloaded.";
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

export function InstagramDownloaderForm() {
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [startingIndex, setStartingIndex] = useState<number | "all" | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleAnalyze = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      const trimmed = url.trim();
      if (!trimmed) {
        setAnalyzeError("Paste an Instagram link to get started.");
        return;
      }
      stopPolling();
      setAnalyzing(true);
      setAnalyzeError("");
      setResult(null);
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
    [url, stopPolling]
  );

  const handleDownload = useCallback(
    async (itemIndex?: number) => {
      const trimmed = url.trim();
      if (!trimmed) return;
      stopPolling();
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
            const j: Job = await pollRes.json();
            setJob(j);
            if (j.status === "completed" || j.status === "failed") {
              stopPolling();
            }
          } catch {
            stopPolling();
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

  const running =
    analyzing || downloading || job?.status === "pending" || job?.status === "processing";

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form
        onSubmit={running ? undefined : handleAnalyze}
        className="flex flex-col sm:flex-row gap-3"
      >
        <div className="relative flex-1">
          <label htmlFor="instagram-url" className="sr-only">
            Instagram link
          </label>
          <Link2 className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="instagram-url"
            type="url"
            inputMode="url"
            placeholder="Paste an Instagram post, reel, story, highlight, or profile link"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <button
          type="submit"
          disabled={running}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {analyzing ? "Analyzing…" : "Analyze"}
        </button>
      </form>

      {analyzeError && (
        <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{analyzeError}</span>
        </p>
      )}

      {downloadError && (
        <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{downloadError}</span>
        </p>
      )}

      {result && !job && (
        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col sm:flex-row gap-4">
            {result.thumbnail && (
              <div className="shrink-0">
                <img
                  src={result.thumbnail}
                  alt=""
                  className="h-28 w-28 object-cover rounded-lg"
                  width={112}
                  height={112}
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {result.mediaType === "reel" ? (
                    <PlayCircle className="h-3 w-3" />
                  ) : (
                    <ImageIcon className="h-3 w-3" />
                  )}
                  {result.mediaType === "reel" ? MEDIA_LABEL.reel : MEDIA_LABEL[result.mediaType]}
                </span>
                {result.duration ? (
                  <span className="text-xs text-muted-foreground">{prettySeconds(result.duration)}</span>
                ) : null}
                {result.isCarousel && (
                  <span className="text-xs text-muted-foreground">{result.media.length} items</span>
                )}
              </div>
              <h2 className="text-base font-semibold line-clamp-2">{result.title}</h2>
              {result.uploader && (
                <p className="text-sm text-muted-foreground mt-1">@{result.uploader}</p>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {result.isCarousel && result.media.length > 1 ? (
              <>
                {result.media.map((item, position) => {
                  const number = item.index ?? position + 1;
                  const busy = downloading && startingIndex === number;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleDownload(number)}
                      disabled={running}
                      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:border-primary/40 disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : item.kind === "image" ? (
                        <ImageIcon className="h-3.5 w-3.5" />
                      ) : (
                        <PlayCircle className="h-3.5 w-3.5" />
                      )}
                      {item.kind === "image" ? "Photo" : "Video"} {number}
                      {!busy && <Download className="h-3.5 w-3.5" />}
                    </button>
                  );
                })}
                <button
                  onClick={() => handleDownload()}
                  disabled={running}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {downloading && startingIndex === "all" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {downloading && startingIndex === "all"
                    ? "Starting…"
                    : `Download all ${result.media.length} items`}
                </button>
              </>
            ) : (
              <button
                onClick={() => handleDownload()}
                disabled={running}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {downloading ? "Starting…" : "Download"}
              </button>
            )}
          </div>
        </div>
      )}

      {job && (
        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              {job.status === "completed" ? (
                "Download complete"
              ) : job.status === "failed" ? (
                "Download failed"
              ) : job.status === "pending" ? (
                "Queued…"
              ) : (
                "Downloading…"
              )}
            </span>
            {job.status === "processing" && (
              <span className="text-sm text-muted-foreground">{job.progress}%</span>
            )}
          </div>

          {job.status === "processing" && (
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(100, job.progress)}%` }}
              />
            </div>
          )}

          {job.status === "completed" && job.files.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {job.files.map((file) => (
                <a
                  key={file.url}
                  href={file.url}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Download className="h-3.5 w-3.5" />
                  {file.name}
                </a>
              ))}
            </div>
          )}

          {job.status === "failed" && (
            <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{job.error ?? "The download failed unexpectedly."}</span>
            </p>
          )}
        </div>
      )}

      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        Anonymous downloader — public Instagram content only.
      </p>
    </div>
  );
}
