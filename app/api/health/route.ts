import { getHealthSnapshot, isAuthorizedDiagnosticsRequest } from "@/lib/instagram/health";
import { clientIp, jsonResponse } from "@/lib/instagram/http";
import { rateLimiters } from "@/lib/security/service";

export const runtime = "nodejs";

/**
 * GET /api/health
 * Returns minimal readiness (`status` and `timestamp`) for public callers so
 * internal binary versions, storage paths, and session details stay hidden.
 * Full diagnostic checks are returned only when `HEALTH_SECRET` matches `x-health-token`.
 */
export async function GET(request: Request) {
  const ip = clientIp(request);
  if (!rateLimiters.healthCheck.isAllowed(ip).allowed) {
    return jsonResponse(
      { error: "Too many requests. Please try again in a minute." },
      429,
      { "Retry-After": "60", "Cache-Control": "no-store" }
    );
  }

  const { degraded, checks } = await getHealthSnapshot();
  const payload: Record<string, unknown> = {
    status: degraded ? "degraded" : "ok",
    timestamp: new Date().toISOString(),
  };

  if (isAuthorizedDiagnosticsRequest(request)) {
    payload.checks = checks;
  }

  return jsonResponse(payload, 200, { "Cache-Control": "no-store" });
}
