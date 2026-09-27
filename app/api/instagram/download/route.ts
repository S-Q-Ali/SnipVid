import { createDownloadJob, startDownloadJob } from "@/lib/instagram/service";
import { classifyInstagramUrl } from "@/lib/instagram/url";
import { rateLimiters } from "@/lib/security/service";
import { clientIp, isInstagramEnabled, jsonResponse } from "@/lib/instagram/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isInstagramEnabled()) {
    return jsonResponse({ error: "Instagram downloads are currently disabled." }, 503);
  }

  const ip = clientIp(request);
  if (!rateLimiters.instagramDownload.isAllowed(ip).allowed) {
    return jsonResponse(
      { error: "Too many requests. Please try again in a minute." },
      429,
      { "Retry-After": "60" }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const url =
    typeof raw === "object" && raw !== null && typeof (raw as { url?: unknown }).url === "string"
      ? (raw as { url: string }).url.trim()
      : "";
  if (!url) {
    return jsonResponse({ error: "A URL is required." }, 400);
  }

  const rawItemIndex =
    typeof raw === "object" && raw !== null
      ? (raw as { itemIndex?: unknown }).itemIndex
      : undefined;
  let itemIndex: number | undefined;
  if (rawItemIndex !== undefined && rawItemIndex !== null) {
    if (
      typeof rawItemIndex !== "number" ||
      !Number.isInteger(rawItemIndex) ||
      rawItemIndex < 1 ||
      rawItemIndex > 50
    ) {
      return jsonResponse({ error: "Invalid item index." }, 400);
    }
    itemIndex = rawItemIndex;
  }

  const info = classifyInstagramUrl(url);
  if (info.kind === "unsupported") {
    return jsonResponse(
      { error: "Only Instagram post, reel, story, highlight, and profile links are supported." },
      400
    );
  }

  const job = createDownloadJob(url, info, itemIndex);
  // Fire and forget: the client polls the job. The guard is here so a runner
  // that rejects for any unforeseen reason cannot become an unhandled rejection
  // and take the process down with it.
  void startDownloadJob(job).catch((error: unknown) => {
    console.error("instagram download runner failed:", error);
    job.status = "failed";
    job.error = "The download could not be started. Please try again.";
  });

  return jsonResponse({ jobId: job.id, status: job.status }, 202);
}