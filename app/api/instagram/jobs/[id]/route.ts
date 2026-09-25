import { getDownloadJob } from "@/lib/instagram/service";
import { isInstagramEnabled, jsonResponse } from "@/lib/instagram/http";

export const runtime = "nodejs";

const JOB_ID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

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
  if (!JOB_ID_PATTERN.test(id)) {
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
      error: job.error ?? undefined,
    },
    200
  );
}