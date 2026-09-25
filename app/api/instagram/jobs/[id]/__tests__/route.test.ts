import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/instagram/service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/instagram/service")>();
  return {
    ...original,
    getDownloadJob: vi.fn(),
  };
});

import { getDownloadJob } from "@/lib/instagram/service";
import { GET } from "../route";
import type { DownloadJob } from "@/lib/instagram/types";

function job(overrides: Partial<DownloadJob> = {}): DownloadJob {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    url: "https://www.instagram.com/p/AbC/",
    mediaType: "post",
    status: "processing",
    progress: 42,
    files: [],
    createdAt: Date.now(),
    ...overrides,
  };
}

function get(id: string) {
  return GET(new Request(`http://localhost/api/instagram/jobs/${id}`), {
    params: Promise.resolve({ id }),
  });
}

describe("GET /api/instagram/jobs/[id]", () => {
  afterEach(() => {
    vi.mocked(getDownloadJob).mockReset();
  });

  it("returns job status and progress", async () => {
    vi.mocked(getDownloadJob).mockReturnValue(job({ status: "processing", progress: 42 }));
    const res = await get("11111111-2222-3333-4444-555555555555");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("processing");
    expect(body.progress).toBe(42);
  });

  it("returns 404 for unknown jobs", async () => {
    vi.mocked(getDownloadJob).mockReturnValue(undefined);
    const res = await get("11111111-2222-3333-4444-555555555555");
    expect(res.status).toBe(404);
  });

  it("rejects malformed job ids", async () => {
    const res = await get("not-a-uuid");
    expect(res.status).toBe(400);
  });

  it("exposes each produced file with a sanitized download URL", async () => {
    vi.mocked(getDownloadJob).mockReturnValue(
      job({ files: ["my pic.mp4", "clip[id].mp4"] })
    );
    const res = await get("11111111-2222-3333-4444-555555555555");
    const body = await res.json();
    expect(body.files).toEqual([
      { name: "my pic.mp4", url: "/api/download/11111111-2222-3333-4444-555555555555/my_pic.mp4" },
      { name: "clip[id].mp4", url: "/api/download/11111111-2222-3333-4444-555555555555/clip_id_.mp4" },
    ]);
  });

  it("does not expose the error stack", async () => {
    vi.mocked(getDownloadJob).mockReturnValue(
      job({ status: "failed", error: "Some content requires login." })
    );
    const res = await get("11111111-2222-3333-4444-555555555555");
    const body = await res.json();
    expect(body.error).toBe("Some content requires login.");
    expect(JSON.stringify(body)).not.toContain("at ");
  });
});