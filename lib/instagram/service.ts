import { spawn, type ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

import { classifyInstagramUrl, type InstagramUrlInfo } from "./url";
import { cookieArgs, hasCookieSession, redactSecrets } from "./cookies";
import type {
  DownloadJob,
  InstagramAnalyzeResult,
  InstagramMediaItem,
} from "./types";

export class YtDlpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YtDlpError";
  }
}

export const TEMP_ROOT = path.join(process.cwd(), "storage", "temp");

export function jobDir(jobId: string): string {
  return path.join(TEMP_ROOT, jobId);
}

export function getYtDlpPath(): string {
  return process.env.YTDLP_PATH || "yt-dlp";
}

export function spawnYtDlp(args: string[]): ChildProcess {
  return spawn(getYtDlpPath(), args, { shell: false, windowsHide: true });
}

export function parseProgressLine(line: string): number | null {
  const match = line.match(/\[download\]\s+([\d.]+)%/);
  if (!match) return null;
  return Math.min(100, parseFloat(match[1]));
}

/** Maximum characters of yt-dlp stderr retained per job for diagnosis. */
const MAX_DIAGNOSTICS_CHARS = 4000;

function appendDiagnostics(existing: string | undefined, chunk: string): string {
  const addition = redactSecrets(chunk).trim();
  if (!addition) return existing ?? "";
  const combined = existing ? `${existing}\n${addition}` : addition;
  return combined.length > MAX_DIAGNOSTICS_CHARS
    ? combined.slice(0, MAX_DIAGNOSTICS_CHARS)
    : combined;
}

const STARTUP_HINT = "yt-dlp could not be started. Install yt-dlp or set YTDLP_PATH.";

const LOGIN_WALL_PATTERN =
  /login_?required|sign in|log in|login to|authentication|unable to extract data|empty media response|empty response/i;

function sessionRequiredMessage(hasCookies: boolean): string {
  if (hasCookies) {
    return "Instagram rejected the server's session cookie. It has probably expired - export a fresh session and update INSTAGRAM_COOKIES_FILE.";
  }
  return "This content is not accessible anonymously - Instagram now requires a login for most posts. An operator can supply an Instagram session cookie via INSTAGRAM_COOKIES_FILE.";
}

export function mapYtDlpError(
  stderr: string,
  options: { hasCookies?: boolean } = {}
): string {
  const text = stderr || "";
  if (LOGIN_WALL_PATTERN.test(text)) {
    return sessionRequiredMessage(Boolean(options.hasCookies));
  }
  if (/private|without logging in/i.test(text)) {
    return "This account or content is private and cannot be downloaded anonymously.";
  }
  if (/rate.?limit/i.test(text)) {
    return "Instagram is rate-limiting anonymous downloads right now. Please wait a few minutes and try again.";
  }
  if (/not available|unavailable|does not exist|has been deleted|no longer/i.test(text)) {
    return "This post is no longer available. It may have been deleted or made private.";
  }
  if (text.trim()) {
    return "Could not download this content. The link may be invalid, deleted, or no longer available.";
  }
  return "Instagram could not be reached. Please try again in a moment.";
}

function kindFromEntry(entry: Record<string, unknown>): InstagramMediaItem["kind"] {
  if (entry.vcodec && entry.vcodec !== "none") return "video";
  if (entry.acodec && entry.acodec !== "none") return "video";
  if (entry.url && /\.mp4|\.m4v|\.webm|\.mov/i.test(String(entry.url))) return "video";
  return "image";
}

export function parseMetadata(
  json: Record<string, unknown>,
  urlInfo: InstagramUrlInfo
): InstagramAnalyzeResult {
  const mediaType = urlInfo.mediaType || "post";
  const entries = Array.isArray(json.entries) ? (json.entries as Record<string, unknown>[]) : null;
  const isCarousel = entries !== null && entries.length > 1;

  const media: InstagramMediaItem[] = (entries ?? [json]).map((entry, index) => ({
    id: String(entry.id ?? `${urlInfo.shortcode}-${index + 1}`),
    index: entries ? index + 1 : undefined,
    kind: kindFromEntry(entry),
    title: String(entry.title ?? json.title ?? "Instagram media"),
    thumbnail: typeof entry.thumbnail === "string" ? entry.thumbnail : undefined,
    duration: typeof entry.duration === "number" ? entry.duration : undefined,
  }));

  return {
    mediaType,
    title: String(json.title ?? "Instagram media"),
    uploader: typeof json.uploader === "string" ? json.uploader : undefined,
    thumbnail:
      typeof json.thumbnail === "string"
        ? json.thumbnail
        : entries?.[0]?.thumbnail
          ? String(entries[0].thumbnail)
          : undefined,
    duration: typeof json.duration === "number" ? json.duration : undefined,
    isCarousel,
    media,
  };
}

function runJson(args: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const proc = spawnYtDlp(args);
    if (!proc.stdout || !proc.stderr) {
      reject(new YtDlpError("Could not capture yt-dlp output."));
      return;
    }
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    proc.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    proc.on("error", (err) => {
      console.error("yt-dlp spawn failed:", redactSecrets(err.message));
      reject(new YtDlpError(STARTUP_HINT));
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new YtDlpError(mapYtDlpError(redactSecrets(stderr), { hasCookies: hasCookieSession() })));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as Record<string, unknown>);
      } catch {
        reject(new YtDlpError("Instagram returned unexpected data. Please try again."));
      }
    });
  });
}

export async function analyzeInstagramUrl(urlInfo: InstagramUrlInfo): Promise<InstagramAnalyzeResult> {
  const json = await runJson(["-J", "--no-warnings", ...cookieArgs(), urlInfo.canonicalUrl]);
  return parseMetadata(json, urlInfo);
}

export async function analyzeFromInput(input: string): Promise<InstagramAnalyzeResult> {
  const info = classifyInstagramUrl(input);
  if (info.kind === "unsupported") {
    throw new YtDlpError("Only Instagram post, reel, story, highlight, and profile links are supported.");
  }
  return analyzeInstagramUrl(info);
}

const jobs = new Map<string, DownloadJob>();

export function getDownloadJob(id: string): DownloadJob | undefined {
  return jobs.get(id);
}

export function createDownloadJob(
  input: string,
  urlInfo: InstagramUrlInfo,
  itemIndex?: number
): DownloadJob {
  const job: DownloadJob = {
    id: randomUUID(),
    url: input,
    mediaType: urlInfo.mediaType || "post",
    status: "pending",
    progress: 0,
    files: [],
    itemIndex,
    createdAt: Date.now(),
  };
  jobs.set(job.id, job);
  return job;
}

const OUTPUT_TEMPLATE = "%(title).80s [%(id)s]";

function outputTemplateFor(dir: string, itemIndex?: number): string {
  const suffix = itemIndex === undefined ? "" : `-${itemIndex}`;
  const forwardDir = dir.replace(/\\/g, "/");
  return `${forwardDir}/${OUTPUT_TEMPLATE}${suffix}.%(ext)s`;
}

export async function startDownloadJob(job: DownloadJob): Promise<DownloadJob> {
  const dir = jobDir(job.id);
  fs.mkdirSync(dir, { recursive: true });
  job.status = "processing";
  job.progress = 0;

  const args = [
    "-o",
    outputTemplateFor(dir, job.itemIndex),
    "--newline",
    "--no-warnings",
    "--no-colors",
    ...cookieArgs(),
  ];
  if (job.itemIndex !== undefined) {
    args.push("--playlist-items", String(job.itemIndex));
  }
  args.push(job.url);
  const proc = spawnYtDlp(args);

  return new Promise((resolve) => {
    if (!proc.stderr || !proc.stdout) {
      job.status = "failed";
      job.error = "Could not capture yt-dlp output.";
      resolve(job);
      return;
    }
    proc.stderr.on("data", (chunk: Buffer) => {
      // Stderr can contain session material and absolute paths, so it is kept
      // out of `error` (which the API returns) and redacted for server logs.
      job.diagnostics = appendDiagnostics(job.diagnostics, chunk.toString());
    });
    proc.stdout.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString().split("\n")) {
        const pct = parseProgressLine(line);
        if (pct !== null) job.progress = pct;
      }
    });
    proc.on("error", (err) => {
      job.status = "failed";
      job.error = STARTUP_HINT;
      job.diagnostics = appendDiagnostics(job.diagnostics, err.message);
      console.error("yt-dlp spawn failed:", job.diagnostics);
      resolve(job);
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        job.status = "failed";
        job.error = mapYtDlpError(job.diagnostics ?? "", { hasCookies: hasCookieSession() });
        console.error("yt-dlp download failed:", job.diagnostics);
        resolve(job);
        return;
      }
      job.progress = 100;
      job.files = finalizeDownloadedFiles(dir);
      job.status = job.files.length > 0 ? "completed" : "failed";
      if (job.status === "failed") job.error = "No files were produced by the download.";
      resolve(job);
    });
  });
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function finalizeDownloadedFiles(dir: string): string[] {
  const raw = listFiles(dir);
  for (const rel of raw) {
    const dirPart = path.dirname(rel);
    const base = sanitizeFilename(path.basename(rel));
    const from = path.join(dir, rel);
    const to = path.join(dir, dirPart === "." ? base : path.join(dirPart, base));
    if (from !== to && fs.existsSync(from)) fs.renameSync(from, to);
  }
  return listFiles(dir);
}

function listFiles(dir: string, prefix: string = ""): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      return listFiles(path.join(dir, entry.name), relative);
    }
    if (entry.isFile()) return [relative];
    return [];
  });
}

export function downloadInstagramUrl(
  input: string,
  urlInfo: InstagramUrlInfo,
  itemIndex?: number
): Promise<DownloadJob> {
  const job = createDownloadJob(input, urlInfo, itemIndex);
  return startDownloadJob(job);
}