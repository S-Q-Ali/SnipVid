import { NextResponse } from "next/server";
import { SecurityHeaders } from "@/lib/security/service";

export function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  extraHeaders: Record<string, string> = {}
) {
  return NextResponse.json(body, { status, headers: { ...SecurityHeaders, ...extraHeaders } });
}

export function isInstagramEnabled(): boolean {
  return process.env.INSTAGRAM_ENABLED !== "false";
}

/**
 * Fallback rate-limit bucket used whenever a trustworthy client address cannot
 * be established. Sharing one bucket is deliberately harsher on legitimate
 * traffic than trusting a spoofable header and guessing the client wrong.
 */
export const SHARED_BUCKET = "shared";

function isIpv4(value: string): boolean {
  const octets = value.split(".");
  if (octets.length !== 4) return false;
  return octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255);
}

function isPlausibleAddress(value: string): boolean {
  if (isIpv4(value)) return true;
  return value.includes(":") && /^[0-9a-f:.%]+$/i.test(value);
}

function trustsProxyHeaders(): boolean {
  return (process.env.TRUST_PROXY || "").trim().toLowerCase() === "true";
}

/**
 * Derive the rate-limit key for a request.
 *
 * `x-forwarded-for` is client-controlled, so it is ignored unless the operator
 * opts in with TRUST_PROXY=true after confirming the edge proxy overwrites (or
 * appends to) the header. When trusted, the *last* entry is used because that
 * is the hop the proxy itself appended.
 */
export function clientIp(request: Request): string {
  if (!trustsProxyHeaders()) return SHARED_BUCKET;

  const forwarded = request.headers.get("x-forwarded-for");
  const hops = forwarded
    ? forwarded
        .split(",")
        .map((hop) => hop.trim())
        .filter(Boolean)
    : [];
  const candidate = hops.length > 0 ? hops[hops.length - 1] : request.headers.get("x-real-ip")?.trim();

  if (!candidate) return SHARED_BUCKET;
  return isPlausibleAddress(candidate) ? candidate : SHARED_BUCKET;
}