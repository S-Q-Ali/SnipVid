import { describe, it, expect, afterEach, vi } from "vitest";
import { EventEmitter } from "events";
import { PassThrough } from "stream";
import fs from "fs";
import type { ChildProcess } from "child_process";

vi.mock("@/lib/instagram/service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/instagram/service")>();
  return {
    ...original,
    spawnYtDlp: vi.fn(),
  };
});

import { spawnYtDlp } from "@/lib/instagram/service";
import { GET } from "../route";

type FakeProcess = EventEmitter & { stdout: PassThrough; kill: () => void };

function fakeProcess(): FakeProcess {
  const proc = new EventEmitter() as FakeProcess;
  proc.stdout = new PassThrough();
  proc.kill = vi.fn();
  return proc;
}

function stubProcess(proc: FakeProcess) {
  vi.mocked(spawnYtDlp).mockReturnValue(proc as unknown as ChildProcess);
}

describe("GET /api/health", () => {
  afterEach(() => {
    vi.mocked(spawnYtDlp).mockReset();
    vi.restoreAllMocks();
  });

  it("reports ok with the yt-dlp version when the binary responds", async () => {
    const proc = fakeProcess();
    stubProcess(proc);

    const pending = GET();
    proc.stdout.write("2025.09.25\n");
    proc.emit("close", 0);

    const res = await pending;
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.checks.ytdlp).toEqual({
      status: "available",
      detail: "yt-dlp is installed",
      version: "2025.09.25",
    });
    expect(body.checks.storage.status).toBe("available");
    expect(typeof body.timestamp).toBe("string");
  });

  it("degrades when the yt-dlp binary cannot be spawned", async () => {
    const proc = fakeProcess();
    stubProcess(proc);

    const pending = GET();
    proc.emit("error", new Error("spawn yt-dlp ENOENT"));

    const body = await (await pending).json();
    expect(body.status).toBe("degraded");
    expect(body.checks.ytdlp.status).toBe("unavailable");
    expect(body.checks.ytdlp.detail).toBe("yt-dlp binary not found");
  });

  it("degrades when yt-dlp exits non-zero without a version", async () => {
    const proc = fakeProcess();
    stubProcess(proc);

    const pending = GET();
    proc.emit("close", 1);

    const body = await (await pending).json();
    expect(body.status).toBe("degraded");
    expect(body.checks.ytdlp.status).toBe("unavailable");
    expect(body.checks.ytdlp.detail).toBe("yt-dlp --version did not succeed");
  });

  it("does not leak the configured binary path", async () => {
    const proc = fakeProcess();
    stubProcess(proc);

    const pending = GET();
    proc.stdout.write("2025.09.25\n");
    proc.emit("close", 0);

    const body = await (await pending).json();
    expect(body.checks.ytdlp.path).toBeUndefined();
  });

  it("degrades when temporary storage is not writable", async () => {
    const proc = fakeProcess();
    stubProcess(proc);
    vi.spyOn(fs, "accessSync").mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });

    const pending = GET();
    proc.stdout.write("2025.09.25\n");
    proc.emit("close", 0);

    const body = await (await pending).json();
    expect(body.status).toBe("degraded");
    expect(body.checks.storage).toEqual({
      status: "error",
      detail: "Cannot access temporary storage",
    });
  });
});
