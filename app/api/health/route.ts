import { NextResponse } from "next/server";
import fs from "fs";

import { TEMP_ROOT, spawnYtDlp } from "@/lib/instagram/service";

export const runtime = "nodejs";

const YTDLP_TIMEOUT_MS = 3000;

type Check = {
  status: "available" | "unavailable" | "error";
  detail: string;
  version?: string;
};

function checkYtDlp(): Promise<Check> {
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

function checkStorage(): Check {
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

/**
 * GET /api/health
 * Reports whether the downloader can actually run: the yt-dlp binary and
 * the temporary output directory are both required, so both are surfaced here.
 */
export async function GET() {
  const checks: { ytdlp: Check; storage: Check } = {
    ytdlp: await checkYtDlp(),
    storage: checkStorage(),
  };

  const degraded = Object.values(checks).some((check) => check.status !== "available");

  return NextResponse.json({
    status: degraded ? "degraded" : "ok",
    timestamp: new Date().toISOString(),
    checks,
  });
}
