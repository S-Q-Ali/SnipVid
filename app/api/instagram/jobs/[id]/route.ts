import { getDownloadJob } from "@/lib/instagram/service";
import { isInstagramEnabled, jsonResponse } from "@/lib/instagram/http";
import { isJobId } from "@/lib/security/identifiers";

export const runtime = "nodejs";

function downloadUrl(jobId: string, name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `/api/download/${jobId}/${safe}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isInstagramEnabled()) {
    return jsonResponse({ error: "Instagram downloads are currently disabled." }, 503);
  }

  const { id } = await params;
  if (!isJobId(id)) {
    return jsonResponse({ error: "Invalid job ID." }, 400);
  }

  const job = getDownloadJob(id);
  if (!job) {
    return jsonResponse({ error: "Job not found." }, 404);
  }

  return jsonResponse(
    {
      id: job.id,
      mediaType: job.mediaType,
      status: job.status,
      progress: job.progress,
      files: job.files.map((name) => ({ name, url: downloadUrl(job.id, name) })),
      // `error` is only meaningful for a failed job, and `diagnostics` (raw,
      // redacted yt-dlp stderr) is server-side only and never serialized here.
      error: job.status === "failed" ? (job.error ?? "The download failed unexpectedly.") : undefined,
    },
    200
  );
}