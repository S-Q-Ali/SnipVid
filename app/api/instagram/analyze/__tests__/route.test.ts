import { describe, it, expect, vi, afterEach } from "vitest";
import { YtDlpError } from "@/lib/instagram/service";

vi.mock("@/lib/instagram/service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/instagram/service")>();
  return {
    ...original,
    analyzeFromInput: vi.fn(),
  };
});

import { analyzeFromInput } from "@/lib/instagram/service";
import { POST } from "../route";

function post(body: unknown, ip = "10.0.1.1") {
  return new Request("http://localhost/api/instagram/analyze", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("POST /api/instagram/analyze", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(analyzeFromInput).mockReset();
  });

  it("returns media info for a valid Instagram URL", async () => {
    vi.mocked(analyzeFromInput).mockResolvedValue({
      mediaType: "reel",
      title: "A reel",
      uploader: "jane.doe",
      thumbnail: "http://thumb/1.jpg",
      duration: 43,
      isCarousel: false,
      media: [{ id: "r1", kind: "video", title: "A reel", duration: 43 }],
    });

    const res = await POST(post({ url: "https://www.instagram.com/reel/CxYz123AbcD/" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mediaType).toBe("reel");
    expect(body.title).toBe("A reel");
    expect(body.isCarousel).toBe(false);
    expect(body.media).toHaveLength(1);
  });

  it("rejects non-Instagram URLs with a clear message", async () => {
    vi.mocked(analyzeFromInput).mockRejectedValue(
      new YtDlpError("Only Instagram post, reel, story, highlight, and profile links are supported.")
    );
    const res = await POST(post({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Instagram");
  });

  it("returns 502 when the yt-dlp binary cannot start", async () => {
    vi.mocked(analyzeFromInput).mockRejectedValue(
      new YtDlpError("yt-dlp could not be started (spawn ENOENT).")
    );
    const res = await POST(post({ url: "https://www.instagram.com/p/CxYz123AbcD/" }));
    expect(res.status).toBe(502);
  });

  it("maps content-level failures to a 422 with a friendly message", async () => {
    vi.mocked(analyzeFromInput).mockRejectedValue(
      new YtDlpError("This content requires an Instagram login. SnipVid works anonymously.")
    );
    const res = await POST(post({ url: "https://www.instagram.com/stories/jane.doe/1/" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toContain("login");
  });

  it("rejects invalid JSON bodies", async () => {
    const res = await POST(
      new Request("http://localhost/api/instagram/analyze", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.0.1.9" },
        body: "not json",
      })
    );
    expect(res.status).toBe(400);
  });

  it("rate limits analyze requests per client", async () => {
    vi.mocked(analyzeFromInput).mockResolvedValue({
      mediaType: "post",
      title: "x",
      isCarousel: false,
      media: [{ id: "a", kind: "image", title: "x" }],
    });
    const ip = "10.0.99.1";
    for (let i = 0; i < 10; i++) {
      const res = await POST(post({ url: "https://www.instagram.com/p/CxYz123AbcD/" }, ip));
      expect(res.status).toBe(200);
    }
    const res = await POST(post({ url: "https://www.instagram.com/p/CxYz123AbcD/" }, ip));
    expect(res.status).toBe(429);
  });

  it("refuses to serve when INSTAGRAM_ENABLED is false", async () => {
    vi.stubEnv("INSTAGRAM_ENABLED", "false");
    const res = await POST(post({ url: "https://www.instagram.com/p/CxYz123AbcD/" }));
    expect(res.status).toBe(503);
  });
});