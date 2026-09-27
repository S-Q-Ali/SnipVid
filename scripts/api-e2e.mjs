/**
 * End-to-end checks against a real running server.
 *
 * The unit suite mocks the child process and the filesystem, so it cannot
 * catch a route that is registered wrongly, a middleware that strips a header,
 * or a rate limit that is applied in the router but not in the module. This
 * harness boots the built app and talks HTTP to it.
 *
 * Deliberately uses only Node's built-in test runner and fetch, so it adds no
 * dependency. Run it with `pnpm test:e2e`; it builds and starts the server
 * itself, so a plain `node --test` on a cold checkout will not work.
 *
 * Nothing here touches Instagram. The download contract is exercised through
 * validation, rate limiting and file serving, which is what can be asserted
 * without a live account.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const NEXT_BIN = require.resolve("next/dist/bin/next");

const PORT = Number(process.env.E2E_PORT ?? 4319);
const BASE = `http://127.0.0.1:${PORT}`;
const STARTUP_TIMEOUT_MS = 90_000;

let server;

async function waitForServer() {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.status === 200) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server did not become ready on ${BASE}`);
}

before(async () => {
  // Spawn node against the Next CLI directly: on Windows a `.cmd` shim cannot
  // be spawned without a shell, and a shell would mangle the arguments.
  server = spawn(process.execPath, [NEXT_BIN, "start", "--port", String(PORT)], {
    env: { ...process.env, NODE_ENV: "production", INSTAGRAM_ENABLED: "true" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (c) => {
    if (process.env.E2E_VERBOSE) process.stdout.write(`[server] ${c}`);
  });
  server.stderr.on("data", (c) => {
    if (process.env.E2E_VERBOSE) process.stderr.write(`[server] ${c}`);
  });
  await waitForServer();
});

after(async () => {
  if (server && !server.killed) {
    server.kill();
    await once(server, "exit").catch(() => {});
  }
});

const VALID_UUID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

describe("GET /api/health", () => {
  it("reports the three readiness checks", async () => {
    const res = await fetch(`${BASE}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(["ok", "degraded"].includes(body.status));
    assert.ok(body.checks.ytdlp, "ytdlp check missing");
    assert.ok(body.checks.storage, "storage check missing");
    assert.ok(body.checks.session, "session check missing");
  });

  it("never leaks the configured cookie path", async () => {
    const text = await (await fetch(`${BASE}/api/health`)).text();
    assert.ok(!/INSTAGRAM_COOKIES_FILE\s*[:=]\s*\S/i.test(text), "cookie path leaked");
  });
});

describe("security headers", () => {
  it("are present on an API response", async () => {
    const res = await fetch(`${BASE}/api/health`);
    assert.ok(res.headers.get("x-content-type-options"), "x-content-type-options missing");
    assert.ok(res.headers.get("x-frame-options"), "x-frame-options missing");
    assert.ok(res.headers.get("referrer-policy"), "referrer-policy missing");
    assert.ok(res.headers.get("content-security-policy"), "API CSP missing");
  });

  it("are present on an HTML page", async () => {
    const res = await fetch(`${BASE}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/);
    for (const header of [
      "x-content-type-options",
      "x-frame-options",
      "referrer-policy",
      "content-security-policy",
    ]) {
      assert.ok(res.headers.get(header), `${header} missing from the page`);
    }
  });

  // A page CSP that forbids inline scripts would break hydration, and the
  // health route reports ready while the UI is dead on arrival.
  it("allows the inline scripts Next.js emits", async () => {
    const page = await (await fetch(`${BASE}/`)).text();
    assert.ok(/<script(?![^>]*\bsrc=)/i.test(page), "no inline script found to check against");
    const csp = (await (await fetch(`${BASE}/`)).headers.get("content-security-policy")) ?? "";
    assert.match(csp, /script-src[^;]*'unsafe-inline'/);
  });
});

describe("POST /api/instagram/analyze", () => {
  it("rejects a body that is not JSON", async () => {
    const res = await fetch(`${BASE}/api/instagram/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    assert.equal(res.status, 400);
  });

  it("rejects a missing url", async () => {
    const res = await fetch(`${BASE}/api/instagram/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  });

  it("rejects a url that is not Instagram before spawning anything", async () => {
    const res = await fetch(`${BASE}/api/instagram/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/not-instagram" }),
    });
    assert.ok([400, 422].includes(res.status), `unexpected status ${res.status}`);
  });

  it("answers 405 for a GET", async () => {
    const res = await fetch(`${BASE}/api/instagram/analyze`);
    assert.equal(res.status, 405);
  });

  it("rate limits repeated requests", async () => {
    const send = () =>
      fetch(`${BASE}/api/instagram/analyze`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/not-instagram" }),
      });

    let sawTooMany = false;
    for (let i = 0; i < 15 && !sawTooMany; i += 1) {
      const res = await send();
      if (res.status === 429) {
        sawTooMany = true;
        assert.ok(res.headers.get("retry-after"), "429 without Retry-After");
      }
    }
    assert.ok(sawTooMany, "analyze endpoint never rate limited 15 requests");
  });
});

describe("GET /api/download/[jobId]/[filename]", () => {
  it("rejects a job id that is not a UUID", async () => {
    const res = await fetch(`${BASE}/api/download/not-a-uuid/reel.mp4`);
    assert.equal(res.status, 400);
  });

  it("rejects 36 characters that are not a UUID", async () => {
    const res = await fetch(`${BASE}/api/download/${"-".repeat(36)}/reel.mp4`);
    assert.equal(res.status, 400);
  });

  it("rejects a traversal attempt", async () => {
    const res = await fetch(`${BASE}/api/download/${VALID_UUID}/..%2F..%2F..%2Fetc%2Fpasswd`);
    assert.equal(res.status, 400);
  });

  it("returns 404 for a well formed request with no such job", async () => {
    const res = await fetch(`${BASE}/api/download/${VALID_UUID}/missing.mp4`);
    assert.equal(res.status, 404);
  });
});

describe("GET /api/instagram/jobs/[id]", () => {
  it("rejects a job id that is not a UUID", async () => {
    const res = await fetch(`${BASE}/api/instagram/jobs/not-a-uuid`);
    assert.equal(res.status, 400);
  });

  it("returns 404 for a well formed unknown job", async () => {
    const res = await fetch(`${BASE}/api/instagram/jobs/${VALID_UUID}`);
    assert.equal(res.status, 404);
  });
});
