import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

import {
  cookieFilePath,
  cookieFileStatus,
  cookieArgs,
  hasCookieSession,
  redactSecrets,
} from "../cookies";

let workDir: string;

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "snipvid-cookies-"));
});

afterEach(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("cookieFilePath", () => {
  it("is null when the operator has not configured a session", () => {
    vi.stubEnv("INSTAGRAM_COOKIES_FILE", "");
    expect(cookieFilePath()).toBeNull();
  });

  it("is null when the setting is only whitespace", () => {
    vi.stubEnv("INSTAGRAM_COOKIES_FILE", "   ");
    expect(cookieFilePath()).toBeNull();
  });

  it("trims surrounding whitespace from the configured path", () => {
    vi.stubEnv("INSTAGRAM_COOKIES_FILE", "  /secrets/instagram.txt \n");
    expect(cookieFilePath()).toBe("/secrets/instagram.txt");
  });
});

describe("cookieFileStatus", () => {
  it("reports not-configured when no session is set up", () => {
    vi.stubEnv("INSTAGRAM_COOKIES_FILE", "");
    expect(cookieFileStatus()).toBe("not-configured");
  });

  it("reports missing when the configured file does not exist", () => {
    vi.stubEnv("INSTAGRAM_COOKIES_FILE", path.join(workDir, "absent.txt"));
    expect(cookieFileStatus()).toBe("missing");
  });

  it("reports available for a readable cookie file", () => {
    const file = path.join(workDir, "instagram.txt");
    fs.writeFileSync(file, "# Netscape HTTP Cookie File\n");
    vi.stubEnv("INSTAGRAM_COOKIES_FILE", file);
    expect(cookieFileStatus()).toBe("available");
  });
});

describe("cookieArgs", () => {
  it("passes no cookie flag by default so anonymous mode stays the default", () => {
    vi.stubEnv("INSTAGRAM_COOKIES_FILE", "");
    expect(cookieArgs()).toEqual([]);
  });

  it("falls back to anonymous when the configured file is missing", () => {
    vi.stubEnv("INSTAGRAM_COOKIES_FILE", path.join(workDir, "absent.txt"));
    expect(cookieArgs()).toEqual([]);
  });

  it("adds the cookies flag when a readable session file exists", () => {
    const file = path.join(workDir, "instagram.txt");
    fs.writeFileSync(file, "# Netscape HTTP Cookie File\n");
    vi.stubEnv("INSTAGRAM_COOKIES_FILE", file);
    expect(cookieArgs()).toEqual(["--cookies", file]);
  });
});

describe("hasCookieSession", () => {
  it("is false when unset and true when a readable session exists", () => {
    vi.stubEnv("INSTAGRAM_COOKIES_FILE", "");
    expect(hasCookieSession()).toBe(false);

    const file = path.join(workDir, "instagram.txt");
    fs.writeFileSync(file, "# Netscape HTTP Cookie File\n");
    vi.stubEnv("INSTAGRAM_COOKIES_FILE", file);
    expect(hasCookieSession()).toBe(true);
  });
});

describe("redactSecrets", () => {
  it("masks the value of known Instagram session cookies but keeps the key", () => {
    const text = "ERROR: login failed sessionid=6%3Aabc123; csrftoken=zzz999; ds_user_id=42";

    const redacted = redactSecrets(text);

    expect(redacted).not.toContain("abc123");
    expect(redacted).not.toContain("zzz999");
    expect(redacted).toContain("sessionid=");
  });

  it("leaves ordinary diagnostics untouched", () => {
    expect(redactSecrets("ERROR: unable to extract data")).toBe("ERROR: unable to extract data");
  });
});
