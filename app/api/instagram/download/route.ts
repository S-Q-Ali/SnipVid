import { createDownloadJob, startDownloadJob } from "@/lib/instagram/service";
import { classifyInstagramUrl } from "@/lib/instagram/url";
import { rateLimiters } from "@/lib/security/service";
import {
  clientIp,
  isInstagramEnabled,
  jsonResponse,
  logRouteError,
  parseUrlRequestBody,
} from "@/lib/instagram/http";

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

  const parsed = await parseUrlRequestBody(request);
  if ("errorResponse" in parsed) {
    return parsed.errorResponse;
  }

  const rawItemIndex = parsed.raw.itemIndex;
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

  const info = classifyInstagramUrl(parsed.url);
  if (info.kind === "unsupported") {
    return jsonResponse(
      { error: "Only Instagram links (posts, reels, photos, and carousels) are supported." },
      400
    );
  }

  const job = createDownloadJob(parsed.url, info, itemIndex);
  // Fire and forget: the client polls the job. The guard is here so a runner
  // that rejects for any unforeseen reason cannot become an unhandled rejection
  // and take the process down with it.
  void startDownloadJob(job).catch((error: unknown) => {
    logRouteError("instagram_download_runner_failed", request, error);
    job.status = "failed";
    job.error = "The download could not be started. Please try again.";
  });

  return jsonResponse({ jobId: job.id, status: job.status }, 202);
}