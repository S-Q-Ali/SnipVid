/** Security headers for API responses */
export const SecurityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src 'self';",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
};

/** Rate limiting - Track and limit request frequencies */
interface RateLimitRecord {
  key: string;
  count: number;
  firstRequest: Date;
  lastRequest: Date;
}

/** Rate limiter using in-memory store (use Redis in production) */
export class RateLimiter {
  private limits: Map<string, RateLimitRecord> = new Map();
  private maxRequests: number;
  private timeWindow: number; // in milliseconds

  constructor(maxRequests: number = 10, timeWindow: number = 60000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
  }

  /** Check if request is allowed */
  isAllowed(key: string): {
    allowed: boolean;
    remaining: number;
    resetTime: Date;
  } {
    const now = new Date();
    const record = this.limits.get(key);

    if (!record) {
      // First request from this key
      this.limits.set(key, {
        key,
        count: 1,
        firstRequest: now,
        lastRequest: now,
      });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetTime: new Date(now.getTime() + this.timeWindow),
      };
    }

    // Check if outside time window
    if (now.getTime() - record.firstRequest.getTime() > this.timeWindow) {
      // Reset the counter
      this.limits.set(key, {
        key,
        count: 1,
        firstRequest: now,
        lastRequest: now,
      });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetTime: new Date(now.getTime() + this.timeWindow),
      };
    }

    // Check if under limit
    if (record.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.lastRequest,
      };
    }

    // Increment counter
    record.count++;
    record.lastRequest = now;
    this.limits.set(key, record);

    return {
      allowed: true,
      remaining: this.maxRequests - record.count,
      resetTime: new Date(record.firstRequest.getTime() + this.timeWindow),
    };
  }
}

/** Pre-configured rate limiters for the Instagram endpoints */
export const rateLimiters = {
  /** Instagram analyze - moderate limits */
  instagramAnalyze: new RateLimiter(10, 60000), // 10 analyzes per minute,

  /** Instagram download - stricter limits */
  instagramDownload: new RateLimiter(5, 60000), // 5 downloads per minute,
};
