/**
 * Give every test file its own temporary output directory.
 *
 * The job registry is in memory and therefore per worker, but the directory it
 * manages is on disk. Vitest runs test files in parallel, so a job created in
 * one file can have its directory deleted by another file's eviction, TTL
 * sweep or orphan sweep, which surfaced as intermittent ENOENT failures while
 * serving a file. Pointing each file at its own directory removes the sharing
 * entirely, and mirrors how a real deployment has a private storage path.
 *
 * Setup files run before the test file's imports, so this is in place by the
 * time `@/lib/instagram/service` reads it.
 */
import { mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect } from "vitest";

const testFile = expect.getState().testPath ?? "unknown";
const slug = path
  .basename(testFile)
  .replace(/\.[^.]+$/, "")
  .replace(/[^a-zA-Z0-9._-]/g, "-");

const root = path.join(os.tmpdir(), "snipvid-tests", `${slug}-${process.pid}`);

rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });

process.env.STORAGE_TEMP_DIR = root;
