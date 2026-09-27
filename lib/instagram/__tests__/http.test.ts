import { describe, it, expect, afterEach, vi } from "vitest";

import { clientIp, isInstagramEnabled } from "../http";

function requestWith(headers: Record<string, string>): Request {
  return new Request("https://snipvid.example/api/instagram/analyze", { headers });
}

describe("clientIp (rate-limit key derivation)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ignores a spoofed x-forwarded-for when proxy trust is not enabled", () => {
    vi.stubEnv("TRUST_PROXY", "");
    const req = requestWith({ "x-forwarded-for": "1.2.3.4" });

    expect(clientIp(req)).toBe("shared");
  });

  it("uses the last x-forwarded-for entry when proxy trust is enabled", () => {
    vi.stubEnv("TRUST_PROXY", "true");
    const req = requestWith({ "x-forwarded-for": "9.9.9.9, 203.0.113.7" });

    expect(clientIp(req)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent and trust is enabled", () => {
    vi.stubEnv("TRUST_PROXY", "true");
    const req = requestWith({ "x-real-ip": "198.51.100.22" });

    expect(clientIp(req)).toBe("198.51.100.22");
  });

  it("returns the shared bucket when trust is enabled but no client header exists", () => {
    vi.stubEnv("TRUST_PROXY", "true");

    expect(clientIp(requestWith({}))).toBe("shared");
  });

  it("rejects a non-IP forwarded value instead of creating a fresh rate-limit bucket", () => {
    vi.stubEnv("TRUST_PROXY", "true");
    const req = requestWith({ "x-forwarded-for": "not-an-ip-at-all" });

    expect(clientIp(req)).toBe("shared");
  });

  it("rejects an out-of-range IPv4 octet", () => {
    vi.stubEnv("TRUST_PROXY", "true");
    const req = requestWith({ "x-forwarded-for": "999.1.1.1" });

    expect(clientIp(req)).toBe("shared");
  });

  it("keeps distinct buckets for two genuinely different client addresses", () => {
    vi.stubEnv("TRUST_PROXY", "true");

    expect(clientIp(requestWith({ "x-forwarded-for": "203.0.113.7" }))).not.toBe(
      clientIp(requestWith({ "x-forwarded-for": "203.0.113.8" }))
    );
  });

  it("accepts an IPv6 client address", () => {
    vi.stubEnv("TRUST_PROXY", "true");
    const req = requestWith({ "x-forwarded-for": "2001:db8::1" });

    expect(clientIp(req)).toBe("2001:db8::1");
  });
});

describe("isInstagramEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is on unless explicitly disabled", () => {
    vi.stubEnv("INSTAGRAM_ENABLED", "");
    expect(isInstagramEnabled()).toBe(true);
  });

  it("is off when set to false", () => {
    vi.stubEnv("INSTAGRAM_ENABLED", "false");
    expect(isInstagramEnabled()).toBe(false);
  });
});
