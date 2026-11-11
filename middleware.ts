import { NextResponse, type NextRequest } from "next/server";

import { SecurityHeaders } from "@/lib/security/service";

/**
 * Next.js inlines its bootstrap and hydration scripts into the HTML it
 * streams, so a page cannot be served under the API policy's `script-src
 * 'self'` without a per-request nonce. Pages therefore get the same headers
 * with inline scripts allowed, while API responses keep the strict policy.
 */
const PageHeaders = {
  ...SecurityHeaders,
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' blob:; connect-src 'self';",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

const REQUEST_ID_RE = /^[a-zA-Z0-9._-]{1,64}$/;

/**
 * Apply the security headers and request correlation ID to every response.
 *
 * They used to be set only by the helper the three Instagram API routes share,
 * so every HTML page and the health route were served with none of them.
 */
export function middleware(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  const incomingId = request.headers.get("x-request-id")?.trim();
  const requestId =
    incomingId && REQUEST_ID_RE.test(incomingId) ? incomingId : crypto.randomUUID();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  for (const [name, value] of Object.entries(isApi ? SecurityHeaders : PageHeaders)) {
    response.headers.set(name, value);
  }
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  // Static assets are immutable and served by the CDN path; there is nothing
  // to protect and skipping them keeps the middleware off the hot path.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
