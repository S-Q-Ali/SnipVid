import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  parseProgressLine,
  mapYtDlpError,
  parseMetadata,
  sanitizeFilename,
  finalizeDownloadedFiles,
  getYtDlpPath,
  createDownloadJob,
} from "../service";
import type { InstagramUrlInfo } from "../url";

const postInfo: InstagramUrlInfo = {
  kind: "post",
  mediaType: "post",
  shortcode: "CxYz123AbcD",
  canonicalUrl: "https://www.instagram.com/p/CxYz123AbcD/",
};

describe("parseProgressLine", () => {
  it("extracts percentage from yt-dlp download lines", () => {
    expect(parseProgressLine("[download]  42.3% of 12.5MiB at  1.2MiB/s ETA 00:05")).toBeCloseTo(42.3);
  });

  it("caps at 100", () => {
    expect(parseProgressLine("[download] 100.0% of 1.0MiB")).toBe(100);
  });

  it("ignores non-progress lines", () => {
    expect(parseProgressLine("[download] Destination: foo.mp4")).toBeNull();
    expect(parseProgressLine("[instagram] Extracting URL: https://...")).toBeNull();
    expect(parseProgressLine("")).toBeNull();
  });
});

describe("mapYtDlpError", () => {
  it("maps login-required errors to a friendly message", () => {
    const text = "ERROR: Unable to download webpage: Instagram said: login_required";
    expect(mapYtDlpError(text)).toContain("login");
    expect(mapYtDlpError("Sign in to view this content on Instagram")).toContain("login");
  });

  it("maps private-account errors", () => {
    expect(
      mapYtDlpError("Instagram said: This account is private. We can't show this content.")
    ).toContain("private");
  });

  it("maps the anonymous-access wall message", () => {
    const text =
      "Instagram sent an empty media response. Check if this post is accessible in your browser without being logged-in. If it is not, then use --cookies";
    expect(mapYtDlpError(text)).toContain("not accessible anonymously");
  });

  it("maps anonymous rate-limiting", () => {
    expect(mapYtDlpError("You have exceeded the rate-limit for accessing posts anonymously")).toContain(
      "rate-limiting"
    );
  });

  it("falls back to a generic message otherwise", () => {
    expect(mapYtDlpError("Some unknown failure thaw")).toContain("Could not download");
  });

  it("returns a message even for empty stderr", () => {
    expect(mapYtDlpError("")).toBeTruthy();
  });

  it("does not blame the user's link when Instagram blocks extraction outright", () => {
    // Observed live from yt-dlp 2026.07.04 against a public profile.
    const text =
      "ERROR: [instagram:user] instagram: Unable to extract data; please report this issue on https://github.com/yt-dlp/yt-dlp/issues";

    const message = mapYtDlpError(text);

    expect(message).not.toContain("no longer available");
    expect(message).not.toContain("link may be invalid");
    expect(message).toMatch(/cookie|login/i);
  });

  it("points at the server session instead of the user's link when cookies are configured", () => {
    const message = mapYtDlpError("instagram: Unable to extract data", { hasCookies: true });

    expect(message).toMatch(/cookie/i);
    expect(message).toMatch(/expired|refresh|update/i);
  });

  it("recognises a deleted or unavailable post", () => {
    expect(
      mapYtDlpError("ERROR: [instagram] CxYz123AbcD: The requested URL is not available")
    ).toMatch(/unavailable|no longer available|deleted/i);
  });
});

describe("sanitizeFilename", () => {
  it("replaces unsafe characters with underscores, UTF-8 included", () => {
    expect(sanitizeFilename("Video by todoytoo [C59fbW7PFZn].mp4")).toBe(
      "Video_by_todoytoo__C59fbW7PFZn_.mp4"
    );
  });
  it("keeps safe characters intact", () => {
    expect(sanitizeFilename("a-b_c.d")).toBe("a-b_c.d");
  });
});

describe("finalizeDownloadedFiles", () => {
  it("renames raw yt-dlp titles to sanitized names and returns relative paths", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "snipvid-finalize-"));
    try {
      fs.writeFileSync(path.join(dir, "Video by todoytoo [C59fbW7PFZn].mp4"), "data");
      const files = finalizeDownloadedFiles(dir);
      expect(files).toEqual(["Video_by_todoytoo__C59fbW7PFZn_.mp4"]);
      expect(
        fs.existsSync(path.join(dir, "Video_by_todoytoo__C59fbW7PFZn_.mp4"))
      ).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // A title containing a separator makes yt-dlp write a subdirectory, and the
  // download route only serves flat names, so nested output has to be lifted
  // back into the job directory.
  it("flattens a nested file into the job directory and drops the empty folder", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "snipvid-nested-"));
    try {
      fs.mkdirSync(path.join(dir, "artist", "song"), { recursive: true });
      fs.writeFileSync(path.join(dir, "artist", "song", "track one.mp4"), "audio");

      const files = finalizeDownloadedFiles(dir);

      expect(files).toEqual(["track_one.mp4"]);
      expect(fs.existsSync(path.join(dir, "track_one.mp4"))).toBe(true);
      expect(fs.existsSync(path.join(dir, "artist"))).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // Two distinct raw names can sanitize to the same name, and renaming them
  // onto each other silently dropped one of the user's files.
  it("keeps both files when two raw names sanitize to the same name", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "snipvid-collide-"));
    try {
      fs.writeFileSync(path.join(dir, "my clip.mp4"), "first");
      fs.writeFileSync(path.join(dir, "my#clip.mp4"), "second");

      const files = finalizeDownloadedFiles(dir).sort();

      expect(files).toEqual(["my_clip-1.mp4", "my_clip.mp4"]);
      expect(fs.readFileSync(path.join(dir, "my_clip.mp4"), "utf8")).toBe("first");
      expect(fs.readFileSync(path.join(dir, "my_clip-1.mp4"), "utf8")).toBe("second");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps same-named files that came from different subdirectories", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "snipvid-collide-2-"));
    try {
      fs.mkdirSync(path.join(dir, "a"), { recursive: true });
      fs.mkdirSync(path.join(dir, "b"), { recursive: true });
      fs.writeFileSync(path.join(dir, "a", "reel.mp4"), "one");
      fs.writeFileSync(path.join(dir, "b", "reel.mp4"), "two");

      const files = finalizeDownloadedFiles(dir).sort();

      expect(files).toEqual(["reel-1.mp4", "reel.mp4"]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("gives up after a collision search limit instead of looping forever", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "snipvid-collide-3-"));
    try {
      fs.writeFileSync(path.join(dir, "clip.mp4"), "zero");
      // Occupy the first many candidate names so the search has to give up.
      for (let i = 0; i < 400; i += 1) {
        fs.writeFileSync(path.join(dir, `clip-${i}.mp4`), String(i));
      }

      const files = finalizeDownloadedFiles(dir);

      expect(files).toHaveLength(401);
      expect(files).toContain("clip.mp4");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ignores entries that are neither files nor directories", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "snipvid-weird-"));
    const spy = vi
      .spyOn(fs, "readdirSync")
      .mockReturnValueOnce([
        { name: "socket", isDirectory: () => false, isFile: () => false },
      ] as unknown as ReturnType<typeof fs.readdirSync>);
    try {
      expect(finalizeDownloadedFiles(dir)).toEqual([]);
    } finally {
      spy.mockRestore();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("parseMetadata", () => {
  it("flattens a carousel/playlist into media items", () => {
    const result = parseMetadata(
      {
        _type: "playlist",
        title: "Jane's post",
        uploader: "jane.doe",
        entries: [
          { id: "a1", title: "photo 1", vcodec: "none", acodec: "none", url: "http://x/1.jpg", ext: "jpg" },
          { id: "a2", title: "pic 2", vcodec: "none", acodec: "none", url: "http://x/2.jpg", ext: "jpg" },
        ],
      },
      postInfo
    );
    expect(result.isCarousel).toBe(true);
    expect(result.media).toHaveLength(2);
    expect(result.media[0].kind).toBe("image");
    expect(result.media[1].index).toBe(2);
  });

  it("treats a single post as a one-item result", () => {
    const result = parseMetadata(
      {
        id: "r1",
        title: "A reel",
        uploader: "jane.doe",
        duration: 43,
        thumbnail: "http://thumb/1.jpg",
        vcodec: "h264",
        acodec: "aac",
        url: "http://x/1.mp4",
        ext: "mp4",
      },
      {
        kind: "reel",
        mediaType: "reel",
        shortcode: "CxYz123AbcD",
        canonicalUrl: "https://www.instagram.com/reel/CxYz123AbcD/",
      }
    );
    expect(result.isCarousel).toBe(false);
    expect(result.media).toHaveLength(1);
    expect(result.media[0].kind).toBe("video");
    expect(result.title).toBe("A reel");
    expect(result.uploader).toBe("jane.doe");
    expect(result.duration).toBe(43);
    expect(result.thumbnail).toBe("http://thumb/1.jpg");
  });

  it("falls back to a generic title and the first entry thumbnail", () => {
    const result = parseMetadata(
      {
        entries: [
          { id: "a1", thumbnail: "http://thumb/first.jpg", url: "http://x/1.mp4" },
          { id: "a2", url: "http://x/2.jpg" },
        ],
      },
      postInfo
    );
    expect(result.title).toBe("Instagram media");
    expect(result.thumbnail).toBe("http://thumb/first.jpg");
    expect(result.media[0].title).toBe("Instagram media");
    expect(result.media[1].kind).toBe("image");
  });

  it("treats an audio-only entry as video", () => {
    const result = parseMetadata(
      { entries: [{ id: "a1", vcodec: "none", acodec: "mp4a", url: "http://x/1.m4a" }] },
      postInfo
    );
    expect(result.media[0].kind).toBe("video");
  });
});

describe("getYtDlpPath", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers YTDLP_PATH and falls back to the system binary", () => {
    vi.stubEnv("YTDLP_PATH", "C:/tools/yt-dlp.exe");
    expect(getYtDlpPath()).toBe("C:/tools/yt-dlp.exe");
    vi.stubEnv("YTDLP_PATH", "");
    expect(getYtDlpPath()).toBe("yt-dlp");
  });
});

describe("createDownloadJob", () => {
  it("defaults to the post media type and a pending state", () => {
    const job = createDownloadJob("https://www.instagram.com/p/CxYz123AbcD/", {
      kind: "post",
      shortcode: "CxYz123AbcD",
      canonicalUrl: "https://www.instagram.com/p/CxYz123AbcD/",
    });
    expect(job.mediaType).toBe("post");
    expect(job.status).toBe("pending");
    expect(job.progress).toBe(0);
    expect(job.files).toEqual([]);
    expect(job.createdAt).toBeGreaterThan(0);
    expect(job.itemIndex).toBeUndefined();
  });

  it("records a requested carousel item index", () => {
    const job = createDownloadJob(
      "https://www.instagram.com/p/CxYz123AbcD/",
      {
        kind: "post",
        shortcode: "CxYz123AbcD",
        canonicalUrl: "https://www.instagram.com/p/CxYz123AbcD/",
      },
      4
    );
    expect(job.itemIndex).toBe(4);
  });
});