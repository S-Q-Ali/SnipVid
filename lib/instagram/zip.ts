import fs from "fs";
import path from "path";
import zlib from "zlib";

const LOCAL_FILE_HEADER_SIG = 0x04034b50;
const CENTRAL_DIR_HEADER_SIG = 0x02014b50;
const END_OF_CENTRAL_DIR_SIG = 0x06054b50;

const VERSION_EXTRACT = 20;
const FLAG_UTF8 = 0x0800;
const METHOD_STORE = 0;
const MAX_ZIP32_BYTES = 0xffffffff;
const MAX_ZIP32_ENTRIES = 0xffff;
const CHUNK_BYTES = 64 * 1024;

interface CentralEntry {
  nameBuf: Buffer;
  dosTime: number;
  dosDate: number;
  crc: number;
  size: number;
  localOffset: number;
}

function toDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  return {
    dosTime: (hours << 11) | (minutes << 5) | seconds,
    dosDate: ((year - 1980) << 9) | (month << 5) | day,
  };
}

function assertSafeEntryName(dirRoot: string, entryName: string): string {
  if (
    !entryName ||
    entryName === "." ||
    entryName === ".." ||
    entryName.includes("/") ||
    entryName.includes("\\") ||
    entryName.includes("\0")
  ) {
    throw new Error(`Unsafe archive entry filename: ${entryName}`);
  }
  const full = path.resolve(dirRoot, entryName);
  if (!full.startsWith(dirRoot + path.sep)) {
    throw new Error(`Archive entry escapes job directory: ${entryName}`);
  }
  return full;
}

function buildLocalHeader(
  nameBuf: Buffer,
  dosTime: number,
  dosDate: number,
  crc = 0,
  size = 0
): Buffer {
  const header = Buffer.alloc(30 + nameBuf.length);
  header.writeUInt32LE(LOCAL_FILE_HEADER_SIG, 0);
  header.writeUInt16LE(VERSION_EXTRACT, 4);
  header.writeUInt16LE(FLAG_UTF8, 6);
  header.writeUInt16LE(METHOD_STORE, 8);
  header.writeUInt16LE(dosTime, 10);
  header.writeUInt16LE(dosDate, 12);
  header.writeUInt32LE(crc >>> 0, 14);
  header.writeUInt32LE(size >>> 0, 18);
  header.writeUInt32LE(size >>> 0, 22);
  header.writeUInt16LE(nameBuf.length, 26);
  header.writeUInt16LE(0, 28);
  nameBuf.copy(header, 30);
  return header;
}

function buildCentralHeader(entry: CentralEntry): Buffer {
  const header = Buffer.alloc(46 + entry.nameBuf.length);
  header.writeUInt32LE(CENTRAL_DIR_HEADER_SIG, 0);
  header.writeUInt16LE(VERSION_EXTRACT, 4);
  header.writeUInt16LE(VERSION_EXTRACT, 6);
  header.writeUInt16LE(FLAG_UTF8, 8);
  header.writeUInt16LE(METHOD_STORE, 10);
  header.writeUInt16LE(entry.dosTime, 12);
  header.writeUInt16LE(entry.dosDate, 14);
  header.writeUInt32LE(entry.crc >>> 0, 16);
  header.writeUInt32LE(entry.size >>> 0, 20);
  header.writeUInt32LE(entry.size >>> 0, 24);
  header.writeUInt16LE(entry.nameBuf.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(entry.localOffset >>> 0, 42);
  entry.nameBuf.copy(header, 46);
  return header;
}

function buildEndOfCentralDir(entryCount: number, centralSize: number, centralOffset: number): Buffer {
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(END_OF_CENTRAL_DIR_SIG, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entryCount, 8);
  eocd.writeUInt16LE(entryCount, 10);
  eocd.writeUInt32LE(centralSize >>> 0, 12);
  eocd.writeUInt32LE(centralOffset >>> 0, 16);
  eocd.writeUInt16LE(0, 20);
  return eocd;
}

function writeAll(fd: number, buf: Buffer, offset: number, length: number, position: number): void {
  let written = 0;
  while (written < length) {
    written += fs.writeSync(fd, buf, offset + written, length - written, position + written);
  }
}

/**
 * Bundles multiple files inside `dir` into a single uncompressed (Store-mode)
 * PKZIP archive using only Node's built-in `fs` and `zlib.crc32`.
 *
 * Store mode avoids wasting CPU re-compressing already compressed JPEGs/MP4s
 * and streams each source file in fixed 64 KiB chunks so memory stays flat.
 */
export function createZipArchive(dir: string, filenames: string[], zipFilename: string): string {
  if (filenames.length === 0) {
    throw new Error("Cannot create a zip archive with zero files.");
  }
  if (filenames.length > MAX_ZIP32_ENTRIES) {
    throw new Error("Too many files for a single zip archive.");
  }

  const dirRoot = path.resolve(dir);
  const finalPath = assertSafeEntryName(dirRoot, zipFilename);
  const tmpName = `.${zipFilename}.tmp-${process.pid}-${Date.now()}`;
  const tmpPath = path.resolve(dirRoot, tmpName);

  let outFd: number | null = null;
  const chunk = Buffer.allocUnsafe(CHUNK_BYTES);
  const centralEntries: CentralEntry[] = [];
  let cursor = 0;

  try {
    outFd = fs.openSync(tmpPath, "w+");

    for (const filename of filenames) {
      const filePath = assertSafeEntryName(dirRoot, filename);
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) {
        throw new Error(`Archive entry is not a regular file: ${filename}`);
      }
      if (stat.size > MAX_ZIP32_BYTES) {
        throw new Error(`File exceeds ZIP32 size limit: ${filename}`);
      }

      const nameBuf = Buffer.from(filename, "utf8");
      if (nameBuf.length > 0xffff) {
        throw new Error(`Archive entry filename is too long: ${filename}`);
      }

      const localOffset = cursor;
      const { dosTime, dosDate } = toDosDateTime(stat.mtime);
      const header = buildLocalHeader(nameBuf, dosTime, dosDate);
      if (cursor + header.length + stat.size > MAX_ZIP32_BYTES) {
        throw new Error("Archive exceeds 4 GiB ZIP32 limit.");
      }

      writeAll(outFd, header, 0, header.length, cursor);
      cursor += header.length;

      let crc = 0;
      let totalRead = 0;
      const inFd = fs.openSync(filePath, "r");
      try {
        while (true) {
          const bytesRead = fs.readSync(inFd, chunk, 0, CHUNK_BYTES, null);
          if (bytesRead === 0) break;
          const slice = chunk.subarray(0, bytesRead);
          crc = zlib.crc32(slice, crc);
          writeAll(outFd, slice, 0, bytesRead, cursor);
          cursor += bytesRead;
          totalRead += bytesRead;
        }
      } finally {
        fs.closeSync(inFd);
      }

      const patch = Buffer.alloc(12);
      patch.writeUInt32LE(crc >>> 0, 0);
      patch.writeUInt32LE(totalRead >>> 0, 4);
      patch.writeUInt32LE(totalRead >>> 0, 8);
      writeAll(outFd, patch, 0, 12, localOffset + 14);

      centralEntries.push({
        nameBuf,
        dosTime,
        dosDate,
        crc,
        size: totalRead,
        localOffset,
      });
    }

    const centralOffset = cursor;
    let centralSize = 0;
    for (const entry of centralEntries) {
      const central = buildCentralHeader(entry);
      if (cursor + central.length > MAX_ZIP32_BYTES) {
        throw new Error("Archive central directory exceeds 4 GiB ZIP32 limit.");
      }
      writeAll(outFd, central, 0, central.length, cursor);
      cursor += central.length;
      centralSize += central.length;
    }

    const eocd = buildEndOfCentralDir(centralEntries.length, centralSize, centralOffset);
    writeAll(outFd, eocd, 0, eocd.length, cursor);

    fs.closeSync(outFd);
    outFd = null;
    fs.renameSync(tmpPath, finalPath);
    return zipFilename;
  } catch (err) {
    if (outFd !== null) {
      try {
        fs.closeSync(outFd);
      } catch {
        // Ignore cleanup close errors when surfacing original failure.
      }
    }
    fs.rmSync(tmpPath, { force: true });
    throw err;
  }
}
