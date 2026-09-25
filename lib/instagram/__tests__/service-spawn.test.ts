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

vi.mock("child_process", () => ({
  spawn: (command: string, args: string[], options: Record<string, unknown>) => {
    const child = makeFakeChild();
    spawned.push({ command, args, options, child });
    return child;
  },
}));

import { createDownloadJob, startDownloadJob, getYtDlpPath, TEMP_ROOT } from "../service";
import { classifyInstagramUrl } from "../url";

function makeJob() {
  const url = "https://www.instagram.com/reel/CxYz123AbcD/";
  const job = createDownloadJob(url, classifyInstagramUrl(url));
  fs.mkdirSync(path.join(TEMP_ROOT, job.id), { recursive: true });
  return job;
}

describe("startDownloadJob (spawn safety)", () => {
  beforeEach(() => {
    spawned.length = 0;
  });

  afterEach(() => {
    fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
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
});