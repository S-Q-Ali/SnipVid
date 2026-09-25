import { analyzeFromInput, YtDlpError } from "@/lib/instagram/service";
import { rateLimiters } from "@/lib/security/service";
import { clientIp, isInstagramEnabled, jsonResponse } from "@/lib/instagram/http";

export const runtime = "nodejs";

function mapError(err: unknown): ReturnType<typeof jsonResponse> {
  if (err instanceof YtDlpError) {
    const message = err.message;
    if (message.includes("Only Instagram")) {
      return jsonResponse({ error: message }, 400);
    }
    if (message.includes("could not be started")) {
      return jsonResponse({ error: message }, 502);
    }
    return jsonResponse({ error: message }, 422);
  }
  console.error("instagram analyze error:", err);
  return jsonResponse({ error: "Something went wrong. Please try again." }, 500);
}

export async function POST(request: Request) {
  if (!isInstagramEnabled()) {
    return jsonResponse({ error: "Instagram downloads are currently disabled." }, 503);
  }

  const ip = clientIp(request);
  if (!rateLimiters.instagramAnalyze.isAllowed(ip).allowed) {
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

  try {
    const result = await analyzeFromInput(url);
    return jsonResponse({ ...result }, 200);
  } catch (err) {
    return mapError(err);
  }
}