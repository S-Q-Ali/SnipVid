import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/instagram/service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/instagram/service")>();
  return {
    ...original,
    createDownloadJob: vi.fn(),
    startDownloadJob: vi.fn(),
  };
});

import { createDownloadJob, startDownloadJob } from "@/lib/instagram/service";
import { POST } from "../route";

function post(body: unknown, ip = "10.0.2.1") {
  return new Request("http://localhost/api/instagram/download", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("POST /api/instagram/download", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(createDownloadJob).mockReset();
    vi.mocked(startDownloadJob).mockReset();
  });

  it("creates a download job and starts it in the background", async () => {
    vi.mocked(createDownloadJob).mockImplementation((input, info) => ({
      id: "job-123",
      url: input,
      mediaType: info.mediaType || "post",
      status: "pending",
      progress: 0,
      files: [],
      createdAt: Date.now(),
    }));
    vi.mocked(startDownloadJob).mockImplementation(async (job) => ({
      ...job,
      status: "processing",
    }));

    const res = await POST(post({ url: "https://www.instagram.com/reel/CxYz123AbcD/" }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.jobId).toBe("job-123");
    expect(startDownloadJob).toHaveBeenCalledTimes(1);
  });

  it("rejects non-Instagram URLs", async () => {
    const res = await POST(post({ url: "https://www.tiktok.com/@x/video/1" }));
    expect(res.status).toBe(400);
  });

  it("rejects a missing URL", async () => {
    const res = await POST(post({}));
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON", async () => {
    const res = await POST(
      new Request("http://localhost/api/instagram/download", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.0.2.9" },
        body: "nope",
      })
    );
    expect(res.status).toBe(400);
  });

  it("rate limits downloads to 5 per minute", async () => {
    vi.mocked(createDownloadJob).mockImplementation((input) => ({
      id: "job-x",
      url: input,
      mediaType: "reel",
      status: "pending",
      progress: 0,
      files: [],
      createdAt: Date.now(),
    }));
    vi.mocked(startDownloadJob).mockImplementation(async (job) => ({ ...job, status: "processing" }));

    const ip = "10.0.99.2";
    for (let i = 0; i < 5; i++) {
      const res = await POST(post({ url: "https://www.instagram.com/reel/CxYz123AbcD/" }, ip));
      expect(res.status).toBe(202);
    }
    const res = await POST(post({ url: "https://www.instagram.com/reel/CxYz123AbcD/" }, ip));
    expect(res.status).toBe(429);
  });

  it("refuses to serve when INSTAGRAM_ENABLED is false", async () => {
    vi.stubEnv("INSTAGRAM_ENABLED", "false");
    const res = await POST(post({ url: "https://www.instagram.com/reel/CxYz123AbcD/" }));
    expect(res.status).toBe(503);
  });
});