import { analyzeFromInput, YtDlpError } from "@/lib/instagram/service";
import { rateLimiters } from "@/lib/security/service";
import {
  clientIp,
  isInstagramEnabled,
  jsonResponse,
  logRouteError,
  parseUrlRequestBody,
} from "@/lib/instagram/http";

export const runtime = "nodejs";

function mapError(err: unknown, request: Request): ReturnType<typeof jsonResponse> {
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
  logRouteError("instagram_analyze_error", request, err);
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

  const parsed = await parseUrlRequestBody(request);
  if ("errorResponse" in parsed) {
    return parsed.errorResponse;
  }

  try {
    const result = await analyzeFromInput(parsed.url);
    return jsonResponse({ ...result }, 200);
  } catch (err) {
    return mapError(err, request);
  }
}