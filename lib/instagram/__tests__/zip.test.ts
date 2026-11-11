import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";
import { createZipArchive } from "../zip";

interface ParsedEntry {
  filename: string;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  method: number;
  data: Buffer;
}

/**
 * Minimal strict PKZIP parser used in tests so we validate offsets, CRC32,
 * central directory entries, and payload bytes independently of the writer.
 */
function parseStoreZip(zipBuffer: Buffer): ParsedEntry[] {
  const eocdOffset = zipBuffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  expect(eocdOffset).toBeGreaterThanOrEqual(0);

  const entryCount = zipBuffer.readUInt16LE(eocdOffset + 10);
  const centralOffset = zipBuffer.readUInt32LE(eocdOffset + 16);
  const entries: ParsedEntry[] = [];

  let ptr = centralOffset;
  for (let i = 0; i < entryCount; i += 1) {
    expect(zipBuffer.readUInt32LE(ptr)).toBe(0x02014b50);
    const method = zipBuffer.readUInt16LE(ptr + 10);
    const crc32 = zipBuffer.readUInt32LE(ptr + 16);
    const compressedSize = zipBuffer.readUInt32LE(ptr + 20);
    const uncompressedSize = zipBuffer.readUInt32LE(ptr + 24);
    const nameLen = zipBuffer.readUInt16LE(ptr + 28);
    const extraLen = zipBuffer.readUInt16LE(ptr + 30);
    const commentLen = zipBuffer.readUInt16LE(ptr + 32);
    const localOffset = zipBuffer.readUInt32LE(ptr + 42);
    const filename = zipBuffer.subarray(ptr + 46, ptr + 46 + nameLen).toString("utf8");

    expect(zipBuffer.readUInt32LE(localOffset)).toBe(0x04034b50);
    const localNameLen = zipBuffer.readUInt16LE(localOffset + 26);
    const localExtraLen = zipBuffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const data = zipBuffer.subarray(dataStart, dataStart + compressedSize);

    entries.push({ filename, crc32, compressedSize, uncompressedSize, method, data });
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

describe("createZipArchive", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "snipvids-zip-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("bundles multiple files into a valid Store PKZIP archive with exact CRC32 and contents", () => {
    const photo1 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const photo2 = Buffer.alloc(140_000, 0xab); // spans multiple 64 KiB read chunks
    const emptyFile = Buffer.alloc(0);

    fs.writeFileSync(path.join(tmpDir, "photo_1.jpg"), photo1);
    fs.writeFileSync(path.join(tmpDir, "photo_2.jpg"), photo2);
    fs.writeFileSync(path.join(tmpDir, "empty.bin"), emptyFile);

    const outName = createZipArchive(
      tmpDir,
      ["photo_1.jpg", "photo_2.jpg", "empty.bin"],
      "SnipVid_album.zip"
    );

    expect(outName).toBe("SnipVid_album.zip");
    const zipBytes = fs.readFileSync(path.join(tmpDir, "SnipVid_album.zip"));
    const entries = parseStoreZip(zipBytes);

    expect(entries.map((e) => e.filename)).toEqual(["photo_1.jpg", "photo_2.jpg", "empty.bin"]);
    expect(entries[0].method).toBe(0);
    expect(entries[0].crc32).toBe(zlib.crc32(photo1) >>> 0);
    expect(entries[0].data.equals(photo1)).toBe(true);
    expect(entries[1].compressedSize).toBe(photo2.length);
    expect(entries[1].crc32).toBe(zlib.crc32(photo2) >>> 0);
    expect(entries[1].data.equals(photo2)).toBe(true);
    expect(entries[2].compressedSize).toBe(0);
    expect(entries[2].crc32).toBe(0);
  });

  it("rejects empty file lists and cleans up no temp artifacts", () => {
    expect(() => createZipArchive(tmpDir, [], "out.zip")).toThrow(/zero files/i);
    expect(fs.readdirSync(tmpDir)).toEqual([]);
  });

  it("rejects path traversal entries", () => {
    expect(() => createZipArchive(tmpDir, ["../secret.txt"], "out.zip")).toThrow(/unsafe/i);
    expect(() => createZipArchive(tmpDir, ["photo.jpg"], "../out.zip")).toThrow(/unsafe/i);
    expect(fs.readdirSync(tmpDir)).toEqual([]);
  });

  it("removes any temporary zip artifact if reading a listed file fails", () => {
    fs.writeFileSync(path.join(tmpDir, "photo_1.jpg"), "ok");
    expect(() => createZipArchive(tmpDir, ["photo_1.jpg", "missing.jpg"], "out.zip")).toThrow();
    expect(fs.readdirSync(tmpDir)).toEqual(["photo_1.jpg"]);
  });
});
