import crypto from "crypto";
import fs from "fs";

import { cookieFileStatus } from "./cookies";
import { spawnYtDlp, TEMP_ROOT } from "./service";

const YTDLP_TIMEOUT_MS = 8000;
const YTDLP_CACHE_TTL_MS = 60_000;

export type HealthCheckItem = {
  status: "available" | "unavailable" | "error" | "anonymous";
  detail: string;
  version?: string;
};

export interface HealthSnapshot {
  degraded: boolean;
  checks: {
    ytdlp: HealthCheckItem;
    storage: HealthCheckItem;
    session: HealthCheckItem;
  };
}

let cachedYtDlp: { check: HealthCheckItem; expiresAt: number } | null = null;
let inFlightYtDlp: Promise<HealthCheckItem> | null = null;

/** Clear the cached yt-dlp probe (intended for isolated unit tests). */
export function resetHealthCheckCache(): void {
  cachedYtDlp = null;
  inFlightYtDlp = null;
}

function runYtDlpVersionProbe(): Promise<HealthCheckItem> {
  return new Promise((resolve) => {
    let version = "";
    const child = spawnYtDlp(["--version"]);

    const timer = setTimeout(() => {
      child.kill();
      resolve({ status: "unavailable", detail: "yt-dlp did not respond in time" });
    }, YTDLP_TIMEOUT_MS);

    child.stdout?.on("data", (chunk: Buffer | string) => {
      version += chunk.toString();
    });

    child.on("error", () => {
      clearTimeout(timer);
      resolve({ status: "unavailable", detail: "yt-dlp binary not found" });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const reported = version.trim();
      if (code === 0 && reported) {
        resolve({ status: "available", detail: "yt-dlp is installed", version: reported });
        return;
      }
      resolve({ status: "unavailable", detail: "yt-dlp --version did not succeed" });
    });
  });
}

/**
 * Probe yt-dlp with a short TTL cache and single-flight deduplication so
 * concurrent or repeated health checks cannot spawn redundant Python processes.
 */
async function checkYtDlp(): Promise<HealthCheckItem> {
  const now = Date.now();
  if (cachedYtDlp && now < cachedYtDlp.expiresAt) {
    return cachedYtDlp.check;
  }
  if (!inFlightYtDlp) {
    inFlightYtDlp = runYtDlpVersionProbe()
      .then((check) => {
        cachedYtDlp = { check, expiresAt: Date.now() + YTDLP_CACHE_TTL_MS };
        return check;
      })
      .finally(() => {
        inFlightYtDlp = null;
      });
  }
  return inFlightYtDlp;
}

function checkStorage(): HealthCheckItem {
  try {
    if (!fs.existsSync(TEMP_ROOT)) {
      fs.mkdirSync(TEMP_ROOT, { recursive: true });
    }
    fs.accessSync(TEMP_ROOT, fs.constants.W_OK);
    return { status: "available", detail: "Temporary storage is writable" };
  } catch {
    return { status: "error", detail: "Cannot access temporary storage" };
  }
}

function checkSession(): HealthCheckItem {
  const status = cookieFileStatus();
  if (status === "available") {
    return { status: "available", detail: "Instagram session configured" };
  }
  if (status === "missing") {
    return { status: "error", detail: "INSTAGRAM_COOKIES_FILE is set but unreadable" };
  }
  return { status: "anonymous", detail: "No Instagram session configured" };
}

/** Collect server readiness checks (with cached yt-dlp probing). */
export async function getHealthSnapshot(): Promise<HealthSnapshot> {
  const checks = {
    ytdlp: await checkYtDlp(),
    storage: checkStorage(),
    session: checkSession(),
  };
  const degraded =
    checks.ytdlp.status !== "available" ||
    checks.storage.status !== "available" ||
    checks.session.status === "error";

  return { degraded, checks };
}

/** Constant-time verification for operator diagnostics via `x-health-token`. */
export function isAuthorizedDiagnosticsRequest(request: Request): boolean {
  const secret = (process.env.HEALTH_SECRET || "").trim();
  const token = (request.headers.get("x-health-token") || "").trim();
  if (!secret || !token) return false;

  const expected = Buffer.from(secret);
  const actual = Buffer.from(token);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}
