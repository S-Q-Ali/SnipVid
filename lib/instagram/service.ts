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

/**
 * Where produced media is written and served from.
 *
 * Overridable because the default lands inside the project directory, which is
 * not writable on every host, and because tests need a directory that is not
 * shared with any other process.
 */
export const TEMP_ROOT = (() => {
  const configured = (process.env.STORAGE_TEMP_DIR ?? "").trim();
  if (configured) return path.resolve(configured);
  return path.join(process.cwd(), "storage", "temp");
})();

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

/** How long a finished job and its downloaded media stay collectable. */
export const JOB_TTL_MS = 60 * 60 * 1000;

/** Upper bound on jobs held in memory, so the registry cannot grow forever. */
export const MAX_JOBS = 200;

/** Upper bound on yt-dlp processes running at the same time. */
export const MAX_CONCURRENT_DOWNLOADS = 3;

export const DOWNLOAD_TIMEOUT_MS = 15 * 60 * 1000;
export const ANALYZE_TIMEOUT_MS = 60 * 1000;

/** Upper bound on media items reported by analyze, matching the item cap. */
export const MAX_ENTRIES = 50;

/** Upper bound on items a single bulk download will fetch. */
export const MAX_BULK_ITEMS = 50;

/** Upper bound on one downloaded file, so one request cannot fill the disk. */
const MAX_FILE_SIZE = "512M";

const TIMEOUT_MESSAGES = {
  analyze: "Instagram took too long to respond. Please try again in a moment.",
  download: "The download took too long and was stopped. Please try again.",
} as const;

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
  const allEntries = Array.isArray(json.entries) ? (json.entries as Record<string, unknown>[]) : null;
  const entries = allEntries ? allEntries.slice(0, MAX_ENTRIES) : null;
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
    totalItems: allEntries ? allEntries.length : media.length,
  };
}

/**
 * Bounded number of concurrent yt-dlp downloads. The route already returns 202
 * and the client polls, so a run that has to wait stays "pending" instead of
 * being rejected.
 */
let activeRuns = 0;
const runWaiters: Array<() => void> = [];

/**
 * Take a run slot. Returns undefined when one was free immediately, so the
 * common case keeps spawning synchronously; only a queued run defers.
 */
function acquireRunSlot(): Promise<void> | undefined {
  if (activeRuns < MAX_CONCURRENT_DOWNLOADS) {
    activeRuns += 1;
    return undefined;
  }
  return new Promise<void>((resolve) => runWaiters.push(resolve)).then(() => {
    activeRuns += 1;
  });
}

function releaseRunSlot(): void {
  activeRuns -= 1;
  const next = runWaiters.shift();
  if (next) next();
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
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      proc.kill();
      reject(new YtDlpError(TIMEOUT_MESSAGES.analyze));
    }, ANALYZE_TIMEOUT_MS);

    const settle = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      action();
    };

    proc.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    proc.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    proc.on("error", (err) => {
      console.error("yt-dlp spawn failed:", redactSecrets(err.message));
      settle(() => reject(new YtDlpError(STARTUP_HINT)));
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        settle(() =>
          reject(new YtDlpError(mapYtDlpError(redactSecrets(stderr), { hasCookies: hasCookieSession() })))
        );
        return;
      }
      settle(() => {
        try {
          resolve(JSON.parse(stdout) as Record<string, unknown>);
        } catch {
          reject(new YtDlpError("Instagram returned unexpected data. Please try again."));
        }
      });
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

function removeJobFiles(id: string): void {
  try {
    fs.rmSync(jobDir(id), { recursive: true, force: true });
  } catch (error) {
    console.error("failed to remove job directory:", error);
  }
}

function evictOldestJob(): void {
  for (const [id, job] of jobs) {
    // Never evict a run that is holding a yt-dlp process right now.
    if (job.status === "processing") continue;
    jobs.delete(id);
    removeJobFiles(id);
    return;
  }
}

/**
 * Delete finished jobs (and the media they produced) once they are older than
 * the retention window, and drop the oldest finished jobs once the registry is
 * full. In-flight jobs are never evicted.
 */
export function purgeExpiredJobs(now: number = Date.now()): number {
  let removed = 0;
  for (const [id, job] of jobs) {
    if (job.status !== "completed" && job.status !== "failed") continue;
    if (now - job.createdAt <= JOB_TTL_MS) continue;
    jobs.delete(id);
    removeJobFiles(id);
    removed += 1;
  }
  while (jobs.size > MAX_JOBS) {
    const before = jobs.size;
    evictOldestJob();
    if (jobs.size === before) break;
  }
  return removed;
}

/**
 * Remove directories under storage/temp that are old and that no live job owns.
 *
 * These accumulate whenever the process restarts, because the in-memory registry
 * starts empty while the files on disk do not.
 *
 * Age is the primary test, not registry membership. The registry is per
 * process while the directory is shared, so a membership sweep would delete
 * another instance's in-flight downloads the moment this process created its
 * first job. Anything touched within the retention window is assumed live.
 *
 * `now` is a parameter so callers, and tests, can reason about the window
 * without rewriting timestamps on shared disk.
 */
export function purgeOrphanDirectories(now: number = Date.now()): number {
  let removed = 0;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(TEMP_ROOT, { withFileTypes: true });
  } catch {
    return 0;
  }
  const staleBefore = now - JOB_TTL_MS;
  for (const entry of entries) {
    if (!entry.isDirectory() || jobs.has(entry.name)) continue;
    const full = path.join(TEMP_ROOT, entry.name);
    try {
      if (fs.statSync(full).mtimeMs > staleBefore) continue;
    } catch {
      continue;
    }
    fs.rmSync(full, { recursive: true, force: true });
    removed += 1;
  }
  return removed;
}

let orphanSweepDone = false;

export function createDownloadJob(
  input: string,
  urlInfo: InstagramUrlInfo,
  itemIndex?: number
): DownloadJob {
  // Cheap, opportunistic housekeeping: no timers, so nothing is left running
  // after the process goes away.
  if (!orphanSweepDone) {
    orphanSweepDone = true;
    purgeOrphanDirectories();
  }
  purgeExpiredJobs();

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

export function startDownloadJob(job: DownloadJob): Promise<DownloadJob> {
  const queued = acquireRunSlot();
  if (!queued) {
    return runDownload(job).finally(releaseRunSlot);
  }
  return queued.then(() => runDownload(job)).finally(releaseRunSlot);
}

async function runDownload(job: DownloadJob): Promise<DownloadJob> {
  const dir = jobDir(job.id);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (error) {
    console.error("failed to create job directory:", error);
    job.status = "failed";
    job.error = "The server could not prepare temporary storage for this download.";
    return job;
  }
  job.status = "processing";
  job.progress = 0;

  const args = [
    "-o",
    outputTemplateFor(dir, job.itemIndex),
    "--newline",
    "--no-warnings",
    "--no-colors",
    "--max-filesize",
    MAX_FILE_SIZE,
    // iOS Safari only plays H.264 + AAC in MP4. Without this yt-dlp picks
    // "best", which for Instagram is often H.265 or a VP9/WebM stream, and
    // the user gets audio with no video on their phone.
    "--format",
    "bestvideo[vcodec^=avc1]+bestaudio[acodec^=mp4a]/best[vcodec^=avc1]/best",
    "--merge-output-format",
    "mp4",
    ...cookieArgs(),
  ];
  if (job.itemIndex !== undefined) {
    args.push("--playlist-items", String(job.itemIndex));
  } else {
    // A profile link resolves to a whole playlist; without a cap one request
    // would try to fetch every post the account has ever posted.
    args.push("--playlist-end", String(MAX_BULK_ITEMS));
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

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      proc.kill();
      job.status = "failed";
      job.error = TIMEOUT_MESSAGES.download;
      resolve(job);
    }, DOWNLOAD_TIMEOUT_MS);

    const settle = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      action();
    };

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
      job.error = STARTUP_HINT;
      job.diagnostics = appendDiagnostics(job.diagnostics, err.message);
      console.error("yt-dlp spawn failed:", job.diagnostics);
      settle(() => {
        job.status = "failed";
        resolve(job);
      });
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        job.error = mapYtDlpError(job.diagnostics ?? "", { hasCookies: hasCookieSession() });
        console.error("yt-dlp download failed:", job.diagnostics);
        settle(() => {
          job.status = "failed";
          resolve(job);
        });
        return;
      }
      settle(() => {
        job.progress = 100;
        job.files = finalizeDownloadedFiles(dir);
        job.status = job.files.length > 0 ? "completed" : "failed";
        if (job.status === "failed") job.error = "No files were produced by the download.";
        resolve(job);
      });
    });
  });
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** How many `-N` variants to try before giving a colliding file its raw name. */
const MAX_COLLISION_SUFFIX = 400;

/**
 * Move every produced file into the job directory root under a name that
 * cannot collide with one already taken.
 *
 * Two things make the naive rename wrong. A title containing a separator makes
 * yt-dlp write a subdirectory, and the download route only serves flat names.
 * And two different raw names can sanitize to the same one, which used to
 * rename one file onto the other and silently drop it.
 */
export function finalizeDownloadedFiles(dir: string): string[] {
  const claimed = new Set<string>();
  const claimedPaths: string[] = [];

  for (const rel of listFiles(dir)) {
    const from = path.join(dir, rel);
    const base = sanitizeFilename(path.basename(rel));
    let target = uniqueName(base, claimed);
    if (fs.existsSync(path.join(dir, target))) target = uniqueName(base, claimed);
    fs.renameSync(from, path.join(dir, target));
    claimed.add(target);
    claimedPaths.push(target);
  }

  removeEmptyDirectories(dir);
  return listFiles(dir);
}

/** Append `-1`, `-2`, ... before the extension until the name is free. */
function uniqueName(base: string, claimed: Set<string>): string {
  if (!claimed.has(base)) return base;

  const ext = path.extname(base);
  const stem = base.slice(0, base.length - ext.length);
  for (let n = 1; n <= MAX_COLLISION_SUFFIX; n += 1) {
    const candidate = `${stem}-${n}${ext}`;
    if (!claimed.has(candidate)) return candidate;
  }
  return base;
}

/** Delete the directories a flatten emptied out, keeping the job root. */
function removeEmptyDirectories(dir: string): void {
  // Deepest first: a parent is only empty once its children are gone.
  const directories = listDirectories(dir).sort(
    (a, b) => b.split("/").length - a.split("/").length
  );
  for (const rel of directories) {
    const full = path.join(dir, rel);
    if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
  }
}

function listDirectories(dir: string, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    found.push(relative, ...listDirectories(path.join(dir, entry.name), relative));
  }
  return found;
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