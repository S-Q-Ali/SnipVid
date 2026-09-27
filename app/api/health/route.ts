import { NextResponse } from "next/server";
import fs from "fs";

import { TEMP_ROOT, spawnYtDlp } from "@/lib/instagram/service";
import { cookieFileStatus } from "@/lib/instagram/cookies";

export const runtime = "nodejs";

const YTDLP_TIMEOUT_MS = 3000;

type Check = {
  status: "available" | "unavailable" | "error" | "anonymous";
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
 * Report whether an Instagram session is configured. Only the status is
 * returned - never the configured path, which is server infrastructure.
 *
 * Running anonymously is a supported mode, so it is reported as `anonymous`
 * rather than degrading health. A session that is configured but unreadable is
 * a real misconfiguration and does degrade, because the operator believes
 * downloads are authenticated when they are not.
 */
function checkSession(): Check {
  const status = cookieFileStatus();
  if (status === "available") {
    return { status: "available", detail: "Instagram session configured" };
  }
  if (status === "missing") {
    return { status: "error", detail: "INSTAGRAM_COOKIES_FILE is set but unreadable" };
  }
  return { status: "anonymous", detail: "No Instagram session configured" };
}

/**
 * GET /api/health
 * Reports whether the downloader can actually run: the yt-dlp binary and
 * the temporary output directory are both required, so both are surfaced here.
 */
export async function GET() {
  const checks: { ytdlp: Check; storage: Check; session: Check } = {
    ytdlp: await checkYtDlp(),
    storage: checkStorage(),
    session: checkSession(),
  };

  const degraded =
    checks.ytdlp.status !== "available" ||
    checks.storage.status !== "available" ||
    checks.session.status === "error";

  return NextResponse.json({
    status: degraded ? "degraded" : "ok",
    timestamp: new Date().toISOString(),
    checks,
  });
}
