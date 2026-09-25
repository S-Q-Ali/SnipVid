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

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}