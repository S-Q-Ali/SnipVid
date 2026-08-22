import { DLP } from "dlp";

import path from "path";
import os from "os";
import fs from "fs";

/** URL Validation - Prevent SSRF and dangerous URLs */
export interface URLValidationResult {
  valid: boolean;
  reason?: string;
  sanitizedUrl?: string;
}

/** File Security - Validate and sanitize uploaded files */
export interface FileSecurityResult {
  valid: boolean;
  sanitizedName: string;
  safeToProcess: boolean;
  warnings: string[];
}

/** Rate Limiting - Track and limit request frequencies */
export interface RateLimitRecord {
  key: string;
  count: number;
  firstRequest: Date;
  lastRequest: Date;
}

/** Security headers for API responses */
export const SecurityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src 'self';",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
};

/** Validate URL for safety */
export function validateURL(url: string): URLValidationResult {
  try {
    const parsed = new URL(url);

    // Block localhost and private IP ranges
    const hostname = parsed.hostname.toLowerCase();

    // Block localhost
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return { valid: false, reason: "Localhost addresses are not allowed" };
    }

    // Block private IP ranges (RFC 1918)
    const privateRanges = [
      "10.",
      "172.16.",
      "172.31.",
      "192.168.",
    ];

    for (const range of privateRanges) {
      if (hostname.startsWith(range)) {
        return {
          valid: false,
          reason: "Private IP addresses are not allowed",
        };
      }
    }

    // Block link-local addresses
    if (hostname.startsWith("169.254.")) {
      return {
        valid: false,
        reason: "Link-local addresses are not allowed",
      };
    }

    // Block loopback IPv6
    if (hostname === "::1" || hostname.startsWith("fe80:")) {
      return {
        valid: false,
        reason: "Loopback addresses are not allowed",
      };
    }

    // Block metadata services
    if (hostname.includes("metadata.") || hostname == "169.254.169.254") {
      return {
        valid: false,
        reason: "Metadata services are not allowed",
      };
    }

    // Allow only HTTP/HTTPS
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return {
        valid: false,
        reason: "Only HTTP/HTTPS URLs are allowed",
      };
    }

    // Return sanitized URL
    return {
      valid: true,
      sanitizedUrl: `${parsed.protocol}//${parsed.hostname}${parsed.pathname
        .split("/")
        .filter((segment) => segment && !segment.startsWith(".."))
        .join("/")}`,
    };
  } catch (error) {
    return { valid: false, reason: "Invalid URL format" };
  }
}

/** Sanitize filename */
export function sanitizeFilename(filename: string): FileSecurityResult {
  const warnings: string[] = [];
  let safeName = filename;

  // Remove path traversal attempts
  safeName = safeName.replace(/[\/\\]/g, "_");
  safeName = safeName.replace(/\.\./g, "");

  // Remove dangerous characters
  safeName = safeName.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");

  // Limit filename length
  const maxNameLength = 255;
  if (safeName.length > maxNameLength) {
    const namePart = safeName.slice(0, maxNameLength - 4);
    const ext = path.extname(safeName);
    safeName = namePart + ext;
    warnings.push("Filename truncated to maximum length");
  }

  // Ensure filename has content
  if (!safeName || safeName.trim() === "") {
    safeName = "unknown-file";
    warnings.push("Filename was invalid, using default");
  }

  // Ensure file extension is safe
  const extension = path.extname(safeName).toLowerCase();
  const safeExtensions = [
    ".mp4",
    ".mov",
    ".mkv",
    ".webm",
    ".avi",
    ".mp3",
    ".wav",
    ".jpg",
    ".png",
    ".gif",
  ];

  if (!safeExtensions.includes(extension)) {
    warnings.push(`File extension "${extension}" may not be processed`);
  }

  // Check for reserved Windows names
  const reservedNames = [
    "con",
    "prn",
    "nul",
    "aux",
    "com1",
    "com2",
    "com3",
    "lpt1",
    "lpt2",
    "lpt3",
  ];
  const nameWithoutExt = path.basename(safeName, extension).toLowerCase();
  if (reservedNames.includes(nameWithoutExt)) {
    safeName = "video-file" + extension;
    warnings.push("Filename was a reserved name, using default");
  }

  return {
    valid: warnings.length === 0,
    sanitizedName: safeName,
    safeToProcess: warnings.length <= 2, // Allow processing with minor warnings
    warnings,
  };
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

  /** Get rate limit info */
  getInfo(key: string): {
    limit: number;
    remaining: number;
    reset: Date;
    used: number;
  } {
    const record = this.limits.get(key);
    if (record) {
      return {
        limit: this.maxRequests,
        remaining: Math.max(0, this.maxRequests - record.count),
        reset: new Date(record.firstRequest.getTime() + this.timeWindow),
        used: record.count,
      };
    }
    return {
      limit: this.maxRequests,
      remaining: this.maxRequests,
      reset: new Date(),
      used: 0,
    };
  }
}

/** Pre-configured rate limiters for different operations */
export const rateLimiters = {
  /** Upload endpoint - stricter limits */
  upload: new RateLimiter(5, 60000), // 5 uploads per minute,

  /** Conversion endpoint - moderate limits */
  convert: new RateLimiter(3, 60000), // 3 conversions per minute,

  /** Download endpoint - moderate limits */
  download: new RateLimiter(10, 60000), // 10 downloads per minute,

  /** Health/status checks - generous limits */
  health: new RateLimiter(30, 60000), // 30 checks per minute,

  /** API general - standard limits */
  general: new RateLimiter(20, 60000), // 20 requests per minute,
};

/** File size limits */
export const MAX_FILE_SIZE = {
  upload: 1 * 1024 * 1024 * 1024, // 1GB
  conversion: 500 * 1024 * 1024, // 500MB
  download: Infinity,
};

/** Allowed file types */
export const ALLOWED_FILE_TYPES = [
  "video/mp4",
  "video/mpeg",
  "video/quicktime",
  "video/x-mkv",
  "video/webm",
  "video/x-msvideo",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
];

/** Allowed video codecs (for FFmpeg) */
export const ALLOWED_CODECS = new Set([
  "h264",
  "hevc",
  "mpeg4",
  "vp8",
  "vp9",
  "av1",
  "aac",
  "mp3",
  "mp2",
  "ac3",
  "eac3",
]);