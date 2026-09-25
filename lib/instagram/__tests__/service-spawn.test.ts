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
  YtDlpError,
  TEMP_ROOT,
} from "../service";
import { classifyInstagramUrl } from "../url";

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

  it("reports a generic failure when the process exits non-zero without stderr", async () => {
    const job = makeJob();
    const promise = startDownloadJob(job);

    spawned[0].child.emit("close", 1);
    const finished = await promise;
    expect(finished.status).toBe("failed");
    expect(finished.error).toBe("Download failed.");
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