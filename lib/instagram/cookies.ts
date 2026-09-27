import fs from "fs";

/**
 * Optional Instagram session support.
 *
 * Anonymous extraction is no longer reliable: Instagram serves login walls to
 * unsigned clients, and yt-dlp itself flags `instagram:user` as currently
 * broken. An operator can therefore point SnipVid at an exported Netscape
 * cookie file to make downloads work again.
 *
 * Hard rules for this module:
 *  - the path comes from server configuration only, never from a request;
 *  - the path and the cookie values are never returned to a client;
 *  - anonymous stays the default whenever no session is configured;
 *  - a configured-but-unreadable session fails safe back to anonymous.
 */

export type CookieStatus = "not-configured" | "missing" | "available";

const SECRET_COOKIE_PATTERN = /\b(sessionid|csrftoken|ds_user_id)\s*=\s*[^;\s]+/gi;

export function cookieFilePath(): string | null {
  const configured = (process.env.INSTAGRAM_COOKIES_FILE || "").trim();
  return configured.length > 0 ? configured : null;
}

export function cookieFileStatus(): CookieStatus {
  const file = cookieFilePath();
  if (!file) return "not-configured";
  try {
    fs.accessSync(file, fs.constants.R_OK);
    return "available";
  } catch {
    return "missing";
  }
}

export function hasCookieSession(): boolean {
  return cookieFileStatus() === "available";
}

/**
 * Extra yt-dlp arguments carrying the configured session.
 *
 * Returns nothing when no session is usable, so the default request stays
 * anonymous and a broken session degrades instead of failing the request.
 */
export function cookieArgs(): string[] {
  const file = cookieFilePath();
  if (!file || cookieFileStatus() !== "available") return [];
  return ["--cookies", file];
}

/** Replace the value of known session cookies while keeping the key visible. */
export function redactSecrets(text: string): string {
  return text.replace(SECRET_COOKIE_PATTERN, (_match, key: string) => `${key}=[redacted]`);
}
