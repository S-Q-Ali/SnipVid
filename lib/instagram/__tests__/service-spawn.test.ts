import { EventEmitter } from "events";
import path from "path";
import fs from "fs";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const spawned: Array<{
  command: string;
  args: string[];
  options: Record<string, unknown>;
  child: ReturnType<typeof makeFakeChild>;
}> = [];

function makeFakeChild() {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
  const child = {
    stdout,
    stderr,
    kill: vi.fn(),
    on(event: string, cb: (...args: unknown[]) => void) {
      (handlers[event] = handlers[event] || []).push(cb);
      return child;
    },
    emit(event: string, ...args: unknown[]) {
      (handlers[event] || []).forEach((cb) => cb(...args));
    },
  };
  return child;
}

let childMode: "normal" | "noStdout" = "normal";

vi.mock("child_process", () => ({
  spawn: (command: string, args: string[], options: Record<string, unknown>) => {
    const child = makeFakeChild();
    if (childMode === "noStdout") {
      (child as unknown as { stdout: EventEmitter | null }).stdout = null;
    }
    spawned.push({ command, args, options, child });
    return child;
  },
}));

import {
  createDownloadJob,
  startDownloadJob,
  getDownloadJob,
  getYtDlpPath,
  downloadInstagramUrl,
  analyzeFromInput,
  analyzeInstagramUrl,
  parseMetadata,
  purgeExpiredJobs,
  purgeOrphanDirectories,
  YtDlpError,
  TEMP_ROOT,
  JOB_TTL_MS,
  MAX_JOBS,
  MAX_ENTRIES,
  MAX_CONCURRENT_DOWNLOADS,
  DOWNLOAD_TIMEOUT_MS,
  ANALYZE_TIMEOUT_MS,
} from "../service";
import { classifyInstagramUrl } from "../url";

const postInfo = {
  kind: "post" as const,
  mediaType: "post" as const,
  shortcode: "CxYz123AbcD",
  canonicalUrl: "https://www.instagram.com/p/CxYz123AbcD/",
};

const createdJobIds: string[] = [];

function cleanupCreatedJobs() {
  for (const id of createdJobIds.splice(0)) {
    fs.rmSync(path.join(TEMP_ROOT, id), { recursive: true, force: true });
  }
}

function newJob(url: string, itemIndex?: number) {
  const job = createDownloadJob(url, classifyInstagramUrl(url), itemIndex);
  createdJobIds.push(job.id);
  return job;
}

function makeJob() {
  const url = "https://www.instagram.com/reel/CxYz123AbcD/";
  const job = newJob(url);
  fs.mkdirSync(path.join(TEMP_ROOT, job.id), { recursive: true });
  return job;
}

describe("startDownloadJob (spawn safety)", () => {
  beforeEach(() => {
    spawned.length = 0;
    childMode = "normal";
  });

  afterEach(() => {
    cleanupCreatedJobs();
  });

  it("spawns the binary with an argument array and shell:false", async () => {
    const job = makeJob();
    const promise = startDownloadJob(job);

    const call = spawned[0];
    expect(call.command).toBe(getYtDlpPath());
    expect(Array.isArray(call.args)).toBe(true);
    expect(call.options.shell).toBe(false);

    const urlIndex = call.args.indexOf(job.url);
    expect(urlIndex).toBeGreaterThan(0);
    const outputIndex = call.args.indexOf("-o");
    expect(outputIndex).toBeGreaterThanOrEqual(0);
    expect(call.args[outputIndex + 1]).toContain("storage/temp");
    expect(call.args[outputIndex + 1]).not.toContain(job.url);

    call.child.stdout.emit("data", Buffer.from("[download]  42.3% of 12.5MiB at 1.2MiB/s\n"));
    fs.writeFileSync(path.join(TEMP_ROOT, job.id, "reel.mp4"), "data");
    call.child.emit("close", 0);
    const finished = await promise;
    expect(finished.status).toBe("completed");
    expect(finished.progress).toBe(100);
    expect(finished.files).toEqual(["reel.mp4"]);
  });

  it("downloads a single carousel item and suffixes the filename with its index", async () => {
    const url = "https://www.instagram.com/p/CxYz123AbcD/";
    const job = newJob(url, 2);
    fs.mkdirSync(path.join(TEMP_ROOT, job.id), { recursive: true });
    const promise = startDownloadJob(job);

    const call = spawned[0];
    const selectorIndex = call.args.indexOf("--playlist-items");
    expect(selectorIndex).toBeGreaterThan(-1);
    expect(call.args[selectorIndex + 1]).toBe("2");
    expect(call.args[call.args.indexOf("-o") + 1]).toContain("-2.%(ext)s");
    expect(job.itemIndex).toBe(2);

    fs.writeFileSync(path.join(TEMP_ROOT, job.id, "photo.jpg"), "data");
    call.child.emit("close", 0);
    const finished = await promise;
    expect(finished.status).toBe("completed");
    expect(finished.files).toEqual(["photo.jpg"]);
  });

  it("omits the playlist selector when downloading every item", async () => {
    const job = makeJob();
    const promise = startDownloadJob(job);

    expect(spawned[0].args).not.toContain("--playlist-items");

    fs.writeFileSync(path.join(TEMP_ROOT, job.id, "one.jpg"), "data");
    spawned[0].child.emit("close", 0);
    const finished = await promise;
    expect(finished.files).toEqual(["one.jpg"]);
  });

  it("emits progress from yt-dlp stdout and lists produced files", async () => {
    const job = makeJob();
    fs.writeFileSync(path.join(TEMP_ROOT, job.id, "reel.mp4"), "data");
    const promise = startDownloadJob(job);

    const call = spawned[0];
    call.child.stdout.emit("data", Buffer.from("[download]  42.3% of 12.5MiB at 1.2MiB/s\n"));
    expect(job.progress).toBeCloseTo(42.3);
    call.child.emit("close", 0);
    const finished = await promise;
    expect(finished.progress).toBe(100);
    expect(Object.keys(spawned)).toHaveLength(1);
    expect(finished.files).toEqual(["reel.mp4"]);
  });

  it("marks the job failed when the process exits non-zero", async () => {
    const job = makeJob();
    const promise = startDownloadJob(job);

    const call = spawned[0];
    call.child.stderr.emit("data", Buffer.from("ERROR: Instagram said: login_required\n"));
    call.child.emit("close", 1);
    const finished = await promise;
    expect(finished.status).toBe("failed");
    expect(finished.error).toContain("login");
  });

  it("fails gracefully when the binary cannot start", async () => {
    const job = makeJob();
    const promise = startDownloadJob(job);

    const call = spawned[0];
    call.child.emit("error", new Error("spawn ENOENT"));
    const finished = await promise;
    expect(finished.status).toBe("failed");
    expect(finished.error).toContain("yt-dlp could not be started");
  });

  it("reports an unreachable-instagram failure when the process exits non-zero without stderr", async () => {
    const job = makeJob();
    const promise = startDownloadJob(job);

    spawned[0].child.emit("close", 1);
    const finished = await promise;
    expect(finished.status).toBe("failed");
    expect(finished.error).toBe("Instagram could not be reached. Please try again in a moment.");
  });

  it("fails when the process exits cleanly but produced no files", async () => {
    const job = makeJob();
    const promise = startDownloadJob(job);

    spawned[0].child.emit("close", 0);
    const finished = await promise;
    expect(finished.status).toBe("failed");
    expect(finished.error).toBe("No files were produced by the download.");
  });
});

describe("startDownloadJob (diagnostics hygiene)", () => {
  beforeEach(() => {
    spawned.length = 0;
    childMode = "normal";
  });

  afterEach(() => {
    cleanupCreatedJobs();
    vi.unstubAllEnvs();
  });

  it("keeps raw stderr out of the user-facing error when the download succeeds", async () => {
    const job = makeJob();
    const promise = startDownloadJob(job);

    const call = spawned[0];
    call.child.stderr.emit("data", Buffer.from("WARNING: odd thing at C:/secret/yt-dlp.exe\n"));
    fs.writeFileSync(path.join(TEMP_ROOT, job.id, "reel.mp4"), "data");
    call.child.emit("close", 0);

    const finished = await promise;
    expect(finished.status).toBe("completed");
    expect(finished.error).toBeUndefined();
    expect(finished.diagnostics).toContain("C:/secret/yt-dlp.exe");
  });

  it("does not leak the configured binary path when the process cannot start", async () => {
    vi.stubEnv("YTDLP_PATH", "C:/secret/tools/yt-dlp.exe");
    const job = makeJob();
    const promise = startDownloadJob(job);

    spawned[0].child.emit("error", new Error("spawn C:/secret/tools/yt-dlp.exe ENOENT"));

    const finished = await promise;
    expect(finished.status).toBe("failed");
    expect(finished.error).toContain("yt-dlp could not be started");
    expect(finished.error).not.toContain("secret");
    expect(finished.diagnostics).toContain("C:/secret/tools/yt-dlp.exe");
  });

  it("sanitizes stderr into a friendly message on failure", async () => {
    const job = makeJob();
    const promise = startDownloadJob(job);

    const call = spawned[0];
    call.child.stderr.emit("data", Buffer.from("ERROR: cookie sessionid=abc123 rejected\n"));
    call.child.emit("close", 1);

    const finished = await promise;
    expect(finished.status).toBe("failed");
    expect(finished.error).not.toContain("abc123");
    expect(finished.diagnostics).not.toContain("abc123");
    expect(finished.diagnostics).toContain("sessionid=");
  });
});

describe("analyzeInstagramUrl (yt-dlp -J)", () => {
  beforeEach(() => {
    spawned.length = 0;
    childMode = "normal";
  });

  const urlInfo = classifyInstagramUrl("https://www.instagram.com/reel/CxYz123AbcD/");

  it("parses metadata on a clean exit", async () => {
    const promise = analyzeInstagramUrl(urlInfo);
    const call = spawned[0];
    expect(call.args[0]).toBe("-J");
    expect(call.args).toContain("https://www.instagram.com/reel/CxYz123AbcD/");
    call.child.stdout.emit(
      "data",
      Buffer.from(JSON.stringify({ id: "r1", title: "A reel", vcodec: "h264", url: "http://x/1.mp4" }))
    );
    call.child.emit("close", 0);

    const result = await promise;
    expect(result.title).toBe("A reel");
    expect(result.media[0].kind).toBe("video");
  });

  it("rejects unsupported non-Instagram input before spawning", async () => {
    await expect(analyzeFromInput("https://www.youtube.com/watch?v=abc")).rejects.toThrow(/Only Instagram/);
    expect(spawned).toHaveLength(0);
  });

  it("rejects when the child process exposes no stdout", async () => {
    childMode = "noStdout";
    await expect(analyzeInstagramUrl(urlInfo)).rejects.toBeInstanceOf(YtDlpError);
    await expect(analyzeInstagramUrl(urlInfo)).rejects.toThrow(/Could not capture yt-dlp output/);
  });

  it("rejects with an install hint when the binary cannot start", async () => {
    const promise = analyzeInstagramUrl(urlInfo);
    spawned[0].child.emit("error", new Error("spawn ENOENT"));
    await expect(promise).rejects.toThrow(/yt-dlp could not be started/);
  });

  it("maps stderr to a friendly error on a non-zero exit", async () => {
    const promise = analyzeInstagramUrl(urlInfo);
    spawned[0].child.stderr.emit("data", Buffer.from("ERROR: Instagram said: login_required\n"));
    spawned[0].child.emit("close", 1);
    await expect(promise).rejects.toThrow(/login/);
  });

  it("rejects when Instagram returns non-JSON output", async () => {
    const promise = analyzeInstagramUrl(urlInfo);
    spawned[0].child.stdout.emit("data", Buffer.from("<html>nope</html>"));
    spawned[0].child.emit("close", 0);
    await expect(promise).rejects.toThrow(/unexpected data/);
  });
});

describe("resource bounds", () => {
  beforeEach(() => {
    spawned.length = 0;
    childMode = "normal";
  });

  afterEach(() => {
    cleanupCreatedJobs();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("bounds the number of yt-dlp processes running at once", async () => {
    const runs = [
      startDownloadJob(newJob("https://www.instagram.com/reel/CxYz123AbcD/")),
      startDownloadJob(newJob("https://www.instagram.com/reel/CxYz123AbcD/")),
      startDownloadJob(newJob("https://www.instagram.com/reel/CxYz123AbcD/")),
      startDownloadJob(newJob("https://www.instagram.com/reel/CxYz123AbcD/")),
    ];

    // The run slot is acquired asynchronously, so let the queue settle.
    await new Promise((resolve) => setImmediate(resolve));
    expect(spawned.length).toBe(MAX_CONCURRENT_DOWNLOADS);

    // Let every queued run through, then fail them all so nothing dangles.
    for (let i = 0; i < runs.length; i += 1) {
      while (spawned.length <= i) {
        await new Promise((resolve) => setImmediate(resolve));
      }
      spawned[i].child.emit("close", 1);
      await new Promise((resolve) => setImmediate(resolve));
    }
    await Promise.all(runs);
  });

  it("stops a download that overruns its time budget", async () => {
    vi.useFakeTimers();
    const job = newJob("https://www.instagram.com/reel/CxYz123AbcD/");
    const promise = startDownloadJob(job);

    await vi.advanceTimersByTimeAsync(DOWNLOAD_TIMEOUT_MS + 1000);

    const finished = await promise;
    expect(finished.status).toBe("failed");
    expect(finished.error).toMatch(/too long/i);
    expect(spawned[0].child.kill).toHaveBeenCalled();
  });

  it("stops an analyze call that overruns its time budget", async () => {
    vi.useFakeTimers();
    const promise = analyzeInstagramUrl(
      classifyInstagramUrl("https://www.instagram.com/reel/CxYz123AbcD/")
    );
    // Attach the expectation before advancing, otherwise the rejection lands
    // with no handler attached and is reported as an unhandled rejection.
    const rejection = expect(promise).rejects.toThrow(/too long/i);

    await vi.advanceTimersByTimeAsync(ANALYZE_TIMEOUT_MS + 1000);

    await rejection;
    expect(spawned[0].child.kill).toHaveBeenCalled();
  });

  it("does not time out an analyze call that finishes in time", async () => {
    vi.useFakeTimers();
    const promise = analyzeInstagramUrl(
      classifyInstagramUrl("https://www.instagram.com/reel/CxYz123AbcD/")
    );
    spawned[0].child.stdout.emit("data", Buffer.from(JSON.stringify({ id: "r1", title: "ok" })));
    spawned[0].child.emit("close", 0);

    await expect(promise).resolves.toMatchObject({ title: "ok" });

    await vi.advanceTimersByTimeAsync(ANALYZE_TIMEOUT_MS + 1000);
    expect(spawned[0].child.kill).not.toHaveBeenCalled();
  });

  it("caps the size of a single downloaded file", async () => {
    const job = newJob("https://www.instagram.com/reel/CxYz123AbcD/");
    const promise = startDownloadJob(job);

    const args = spawned[0].args;
    expect(args).toContain("--max-filesize");
    expect(args[args.indexOf("--max-filesize") + 1]).toMatch(/^\d+[MG]$/);

    spawned[0].child.emit("close", 1);
    await promise;
  });

  it("caps how many playlist items a bulk download will fetch", async () => {
    const job = newJob("https://www.instagram.com/instagram/");
    const promise = startDownloadJob(job);

    const args = spawned[0].args;
    expect(args).toContain("--playlist-end");
    expect(Number(args[args.indexOf("--playlist-end") + 1])).toBeGreaterThan(0);

    spawned[0].child.emit("close", 1);
    await promise;
  });

  it("does not cap playlist items when a single carousel item was requested", async () => {
    const job = newJob("https://www.instagram.com/p/CxYz123AbcD/", 2);
    const promise = startDownloadJob(job);

    expect(spawned[0].args).not.toContain("--playlist-end");

    spawned[0].child.emit("close", 1);
    await promise;
  });

  it("fails the job rather than rejecting when the output directory cannot be created", async () => {
    const job = newJob("https://www.instagram.com/reel/CxYz123AbcD/");
    const mkdir = vi.spyOn(fs, "mkdirSync").mockImplementation(() => {
      throw new Error("ENOSPC: no space left on device");
    });

    try {
      const finished = await startDownloadJob(job);
      expect(finished.status).toBe("failed");
      expect(finished.error).toMatch(/temporary storage/i);
      expect(spawned).toHaveLength(0);
    } finally {
      mkdir.mockRestore();
    }
  });
});

describe("job retention", () => {
  beforeEach(() => {
    spawned.length = 0;
    childMode = "normal";
  });

  afterEach(() => {
    cleanupCreatedJobs();
    vi.unstubAllEnvs();
  });

  it("deletes finished jobs and their files once past the retention window", () => {
    const job = newJob("https://www.instagram.com/reel/CxYz123AbcD/");
    fs.mkdirSync(path.join(TEMP_ROOT, job.id), { recursive: true });
    fs.writeFileSync(path.join(TEMP_ROOT, job.id, "reel.mp4"), "data");
    job.status = "completed";
    job.createdAt = Date.now() - JOB_TTL_MS - 60_000;

    const removed = purgeExpiredJobs();

    expect(removed).toBeGreaterThanOrEqual(1);
    expect(getDownloadJob(job.id)).toBeUndefined();
    expect(fs.existsSync(path.join(TEMP_ROOT, job.id))).toBe(false);
  });

  it("keeps a job that is still running past the retention window", () => {
    const job = newJob("https://www.instagram.com/reel/CxYz123AbcD/");
    fs.mkdirSync(path.join(TEMP_ROOT, job.id), { recursive: true });
    job.status = "processing";
    job.createdAt = Date.now() - JOB_TTL_MS - 60_000;

    purgeExpiredJobs();

    expect(getDownloadJob(job.id)).toBe(job);
  });

  it("keeps a recently finished job so the user can still collect the file", () => {
    const job = newJob("https://www.instagram.com/reel/CxYz123AbcD/");
    fs.mkdirSync(path.join(TEMP_ROOT, job.id), { recursive: true });
    job.status = "completed";

    purgeExpiredJobs();

    expect(getDownloadJob(job.id)).toBe(job);
  });

  it("never tracks more jobs than the cap", () => {
    const ids: string[] = [];
    for (let i = 0; i < MAX_JOBS + 25; i += 1) {
      ids.push(newJob("https://www.instagram.com/reel/CxYz123AbcD/").id);
    }

    expect(getDownloadJob(ids[0])).toBeUndefined();
    expect(getDownloadJob(ids[ids.length - 1])).toBeDefined();
  });

  it("cleans up directories left behind by a previous process", () => {
    const orphan = path.join(TEMP_ROOT, "orphaned-job-directory");
    fs.mkdirSync(orphan, { recursive: true });
    fs.writeFileSync(path.join(orphan, "reel.mp4"), "data");
    const live = newJob("https://www.instagram.com/reel/CxYz123AbcD/");
    fs.mkdirSync(path.join(TEMP_ROOT, live.id), { recursive: true });

    const removed = purgeOrphanDirectories();

    expect(removed).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(orphan)).toBe(false);
    expect(fs.existsSync(path.join(TEMP_ROOT, live.id))).toBe(true);
  });
});

describe("parseMetadata bounds", () => {
  it("caps how many carousel items it reports and keeps the real total", () => {
    const entries = Array.from({ length: MAX_ENTRIES + 40 }, (_, i) => ({
      id: `e${i}`,
      url: `http://x/${i}.jpg`,
    }));

    const result = parseMetadata({ entries }, postInfo);

    expect(result.media).toHaveLength(MAX_ENTRIES);
    expect(result.totalItems).toBe(MAX_ENTRIES + 40);
  });
});

describe("job registry", () => {
  beforeEach(() => {
    spawned.length = 0;
    childMode = "normal";
  });

  afterEach(() => {
    cleanupCreatedJobs();
  });

  it("stores created jobs so they can be polled by id", () => {
    const url = "https://www.instagram.com/reel/CxYz123AbcD/";
    const job = newJob(url);
    expect(getDownloadJob(job.id)).toBe(job);
    expect(getDownloadJob("missing")).toBeUndefined();
  });

  it("downloadInstagramUrl creates a job and runs it to completion", async () => {
    const url = "https://www.instagram.com/reel/CxYz123AbcD/";
    const promise = downloadInstagramUrl(url, classifyInstagramUrl(url));
    const call = spawned[0];
    const template = call.args[call.args.indexOf("-o") + 1];
    const id = template.match(/temp\/([0-9a-f-]{36})\//)?.[1];
    expect(id).toBeTruthy();
    createdJobIds.push(id as string);
    fs.writeFileSync(path.join(TEMP_ROOT, id as string, "reel.mp4"), "data");
    call.child.emit("close", 0);

    const finished = await promise;
    expect(finished.status).toBe("completed");
    expect(finished.files).toEqual(["reel.mp4"]);
    expect(getDownloadJob(finished.id)).toBe(finished);
  });
});