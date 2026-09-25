import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import { TEMP_ROOT } from "@/lib/instagram/service";
import { GET } from "../route";

const jobId = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

function get(filename: string, id: string = jobId) {
  const request = new Request(`http://localhost/api/download/${id}/${filename}`);
  return GET(request, { params: Promise.resolve({ jobId: id, filename }) });
}

function writeJobFile(name: string, data: string | Buffer) {
  const dir = path.join(TEMP_ROOT, jobId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), data);
}

describe("GET /api/download/[jobId]/[filename]", () => {
  afterEach(() => {
    fs.rmSync(path.join(TEMP_ROOT, jobId), { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("serves a produced file with download headers", async () => {
    writeJobFile("reel.mp4", Buffer.from([0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70]));

    const res = await get("reel.mp4");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("video/mp4");
    expect(res.headers.get("content-length")).toBe("8");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="reel.mp4"');
    expect(res.headers.get("cache-control")).toBe("private, max-age=60");
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.includes(Buffer.from("ftyp"))).toBe(true);
  });

  it("maps audio and image extensions to their MIME types", async () => {
    writeJobFile("audio.mp3", "id3");
    expect((await get("audio.mp3")).headers.get("content-type")).toBe("audio/mpeg");

    writeJobFile("clip.webm", "webm");
    expect((await get("clip.webm")).headers.get("content-type")).toBe("video/webm");

    writeJobFile("sticker.gif", "GIF89a");
    expect((await get("sticker.gif")).headers.get("content-type")).toBe("image/gif");
  });

  it("falls back to octet-stream for unknown extensions", async () => {
    writeJobFile("notes.txt", "hello");
    const res = await get("notes.txt");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
  });

  it("sanitizes unsafe characters in the served filename", async () => {
    writeJobFile("Video_by_jane.mp4", "data");
    const res = await get("Video by jane.mp4");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="Video_by_jane.mp4"');
  });

  it("rejects a malformed job ID", async () => {
    const res = await get("reel.mp4", "not-a-uuid");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid job ID");
  });

  it("rejects path traversal attempts in the filename", async () => {
    const res = await get("../../../../etc/passwd");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid filename");
  });

  it("returns 404 when the file does not exist", async () => {
    const res = await get("missing.mp4");
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("File not found");
  });

  it("refuses to serve a directory", async () => {
    fs.mkdirSync(path.join(TEMP_ROOT, jobId, "subdir"), { recursive: true });
    const res = await get("subdir");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Not a file");
  });

  it("returns 500 when the file cannot be read", async () => {
    writeJobFile("reel.mp4", "data");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(fs, "readFileSync").mockImplementationOnce(() => {
      throw new Error("EIO");
    });

    const res = await get("reel.mp4");
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Failed to download file");
  });
});
