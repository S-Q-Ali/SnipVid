import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { EventEmitter } from "events";
import { PassThrough } from "stream";
import fs from "fs";
import os from "os";
import path from "path";
import type { ChildProcess } from "child_process";

vi.mock("@/lib/instagram/service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/instagram/service")>();
  return {
    ...original,
    spawnYtDlp: vi.fn(),
  };
});

import { spawnYtDlp } from "@/lib/instagram/service";
import { resetHealthCheckCache } from "@/lib/instagram/health";
import { rateLimiters } from "@/lib/security/service";
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

let clientSeq = 0;

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/health", {
    headers: {
      "x-forwarded-for": `10.10.0.${(clientSeq += 1)}`,
      ...headers,
    },
  });
}

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.stubEnv("TRUST_PROXY", "true");
    resetHealthCheckCache();
  });

  afterEach(() => {
    resetHealthCheckCache();
    vi.mocked(spawnYtDlp).mockReset();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns minimal public readiness without exposing internal checks or version", async () => {
    const proc = fakeProcess();
    stubProcess(proc);

    const pending = GET(makeRequest());
    proc.stdout.write("2026.10.26\n");
    proc.emit("close", 0);

    const res = await pending;
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
    expect(body.checks).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("2026.10.26");
  });

  it("includes diagnostic checks only when HEALTH_SECRET matches x-health-token", async () => {
    vi.stubEnv("HEALTH_SECRET", "ops-secret-token");
    const proc = fakeProcess();
    stubProcess(proc);

    const pending = GET(makeRequest({ "x-health-token": "ops-secret-token" }));
    proc.stdout.write("2026.10.26\n");
    proc.emit("close", 0);

    const res = await pending;
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.checks.ytdlp).toEqual({
      status: "available",
      detail: "yt-dlp is installed",
      version: "2026.10.26",
    });
    expect(body.checks.storage.status).toBe("available");
    expect(body.checks.session.status).toBe("anonymous");
  });

  it("withholds diagnostic checks when x-health-token is wrong", async () => {
    vi.stubEnv("HEALTH_SECRET", "ops-secret-token");
    const proc = fakeProcess();
    stubProcess(proc);

    const pending = GET(makeRequest({ "x-health-token": "wrong-secret" }));
    proc.stdout.write("2026.10.26\n");
    proc.emit("close", 0);

    const body = await (await pending).json();
    expect(body.status).toBe("ok");
    expect(body.checks).toBeUndefined();
  });

  it("caches yt-dlp probe results across repeated health requests", async () => {
    const proc = fakeProcess();
    stubProcess(proc);

    const first = GET(makeRequest());
    proc.stdout.write("2026.10.26\n");
    proc.emit("close", 0);
    await first;

    const second = await GET(makeRequest());
    expect((await second.json()).status).toBe("ok");
    expect(spawnYtDlp).toHaveBeenCalledTimes(1);
  });

  it("degrades when the yt-dlp binary cannot be spawned", async () => {
    vi.stubEnv("HEALTH_SECRET", "ops-secret");
    const proc = fakeProcess();
    stubProcess(proc);

    const pending = GET(makeRequest({ "x-health-token": "ops-secret" }));
    proc.emit("error", new Error("spawn yt-dlp ENOENT"));

    const body = await (await pending).json();
    expect(body.status).toBe("degraded");
    expect(body.checks.ytdlp.status).toBe("unavailable");
    expect(body.checks.ytdlp.detail).toBe("yt-dlp binary not found");
  });

  it("degrades when yt-dlp exits non-zero without a version", async () => {
    vi.stubEnv("HEALTH_SECRET", "ops-secret");
    const proc = fakeProcess();
    stubProcess(proc);

    const pending = GET(makeRequest({ "x-health-token": "ops-secret" }));
    proc.emit("close", 1);

    const body = await (await pending).json();
    expect(body.status).toBe("degraded");
    expect(body.checks.ytdlp.status).toBe("unavailable");
    expect(body.checks.ytdlp.detail).toBe("yt-dlp --version did not succeed");
  });

  it("does not leak the configured binary path", async () => {
    vi.stubEnv("HEALTH_SECRET", "ops-secret");
    const proc = fakeProcess();
    stubProcess(proc);

    const pending = GET(makeRequest({ "x-health-token": "ops-secret" }));
    proc.stdout.write("2026.10.26\n");
    proc.emit("close", 0);

    const body = await (await pending).json();
    expect(body.checks.ytdlp.path).toBeUndefined();
  });

  it("degrades when temporary storage is not writable", async () => {
    vi.stubEnv("HEALTH_SECRET", "ops-secret");
    const proc = fakeProcess();
    stubProcess(proc);
    vi.spyOn(fs, "accessSync").mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });

    const pending = GET(makeRequest({ "x-health-token": "ops-secret" }));
    proc.stdout.write("2026.10.26\n");
    proc.emit("close", 0);

    const body = await (await pending).json();
    expect(body.status).toBe("degraded");
    expect(body.checks.storage).toEqual({
      status: "error",
      detail: "Cannot access temporary storage",
    });
  });

  it("reports the session as configured without disclosing its path", async () => {
    vi.stubEnv("HEALTH_SECRET", "ops-secret");
    const proc = fakeProcess();
    stubProcess(proc);
    const secret = path.join(os.tmpdir(), "snipvid-secret-instagram-cookies.txt");
    fs.writeFileSync(secret, "# Netscape HTTP Cookie File\n");
    vi.stubEnv("INSTAGRAM_COOKIES_FILE", secret);

    try {
      const pending = GET(makeRequest({ "x-health-token": "ops-secret" }));
      proc.stdout.write("2026.10.26\n");
      proc.emit("close", 0);

      const body = await (await pending).json();
      expect(body.checks.session.status).toBe("available");
      expect(JSON.stringify(body)).not.toContain(secret);
      expect(JSON.stringify(body)).not.toContain("snipvid-secret");
    } finally {
      fs.rmSync(secret, { force: true });
    }
  });

  it("degrades when a session is configured but its file is missing", async () => {
    vi.stubEnv("HEALTH_SECRET", "ops-secret");
    const proc = fakeProcess();
    stubProcess(proc);
    vi.stubEnv("INSTAGRAM_COOKIES_FILE", path.join(os.tmpdir(), "snipvid-absent-cookies.txt"));

    const pending = GET(makeRequest({ "x-health-token": "ops-secret" }));
    proc.stdout.write("2026.10.26\n");
    proc.emit("close", 0);

    const body = await (await pending).json();
    expect(body.checks.session.status).toBe("error");
    expect(body.checks.session.detail).toBe("INSTAGRAM_COOKIES_FILE is set but unreadable");
    expect(body.status).toBe("degraded");
  });

  it("rate limits excessive health checks", async () => {
    const proc = fakeProcess();
    stubProcess(proc);
    const ip = "10.10.99.2";
    const budget = rateLimiters.healthCheck.maxRequests;

    const first = GET(makeRequest({ "x-forwarded-for": ip }));
    proc.stdout.write("2026.10.26\n");
    proc.emit("close", 0);
    expect((await first).status).toBe(200);

    for (let i = 1; i < budget; i += 1) {
      const res = await GET(makeRequest({ "x-forwarded-for": ip }));
      expect(res.status).toBe(200);
    }

    const limited = await GET(makeRequest({ "x-forwarded-for": ip }));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
  });
});
