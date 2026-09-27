import { describe, it, expect, vi } from "vitest";

import { RateLimiter, rateLimiters } from "../service";

describe("RateLimiter", () => {
  it("allows a first request and reports the remaining allowance", () => {
    const limiter = new RateLimiter(3, 60_000);

    const result = limiter.isAllowed("client-a");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("blocks requests past the limit inside the window", () => {
    const limiter = new RateLimiter(2, 60_000);

    expect(limiter.isAllowed("client-a").allowed).toBe(true);
    expect(limiter.isAllowed("client-a").allowed).toBe(true);
    expect(limiter.isAllowed("client-a").allowed).toBe(false);
  });

  it("tracks buckets per key so one client cannot exhaust another", () => {
    const limiter = new RateLimiter(1, 60_000);

    expect(limiter.isAllowed("client-a").allowed).toBe(true);
    expect(limiter.isAllowed("client-a").allowed).toBe(false);
    expect(limiter.isAllowed("client-b").allowed).toBe(true);
  });

  it("resets the counter once the time window has elapsed", () => {
    vi.useFakeTimers();
    try {
      const limiter = new RateLimiter(1, 1_000);

      expect(limiter.isAllowed("client-a").allowed).toBe(true);
      expect(limiter.isAllowed("client-a").allowed).toBe(false);

      vi.advanceTimersByTime(1_500);

      expect(limiter.isAllowed("client-a").allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("never tracks more buckets than the cap, even under key flooding", () => {
    const limiter = new RateLimiter(5, 60_000);

    for (let i = 0; i < 5_000; i += 1) {
      limiter.isAllowed(`flood-${i}`);
    }

    expect(limiter.size).toBeLessThanOrEqual(limiter.maxBuckets);
  });

  it("gives an evicted key a fresh window instead of stranding it as blocked", () => {
    const limiter = new RateLimiter(1, 60_000);

    expect(limiter.isAllowed("victim").allowed).toBe(true);
    expect(limiter.isAllowed("victim").allowed).toBe(false);

    for (let i = 0; i < limiter.maxBuckets + 10; i += 1) {
      limiter.isAllowed(`flood-${i}`);
    }

    expect(limiter.isAllowed("victim").allowed).toBe(true);
  });
});

describe("pre-configured rate limiters", () => {
  it("limits analyze more loosely than download", () => {
    expect(rateLimiters.instagramAnalyze.maxRequests).toBeGreaterThan(
      rateLimiters.instagramDownload.maxRequests
    );
  });

  it("enforces the documented per-minute budgets", () => {
    expect(rateLimiters.instagramAnalyze.maxRequests).toBe(10);
    expect(rateLimiters.instagramDownload.maxRequests).toBe(5);
    expect(rateLimiters.instagramAnalyze.timeWindow).toBe(60_000);
    expect(rateLimiters.instagramDownload.timeWindow).toBe(60_000);
  });
});
