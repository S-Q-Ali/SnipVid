# Security Policy

## Reporting a Vulnerability

Please do not disclose security vulnerabilities in public issues before a fix is available.

To report a vulnerability privately, open a **Security Advisory** in the repository's **Security** tab on GitHub:
<https://github.com/S-Q-Ali/SnipVid/security/advisories/new>

Include steps to reproduce, affected routes or files, and potential impact so the issue can be triaged quickly.

## Security Architecture

SnipVid enforces defense-in-depth controls documented in [`CONSTRAINTS.md`](./CONSTRAINTS.md):

- **SSRF Allowlist:** Requests only accept canonical Instagram hostnames validated in [`lib/instagram/url.ts`](./lib/instagram/url.ts).
- **Safe Process Execution:** `yt-dlp` is invoked via `child_process.spawn` with explicit argument arrays and `shell: false`; user input is never interpolated into a shell command.
- **Path Confinement:** Temporary downloads are isolated inside per-UUID directories under `STORAGE_TEMP_DIR`, validated with UUID checks, and filenames are sanitized before streaming.
- **Rate Limiting:** Per-IP sliding limits (10 analyze requests/min, 5 download jobs/min, 30 file fetches/min), respecting proxy headers only when `TRUST_PROXY=true`.
- **HTTP Security Headers:** [`middleware.ts`](./middleware.ts) applies strict `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Strict-Transport-Security`.
- **Log Hygiene:** Diagnostics redact sensitive cookie fields and never expose stack traces or binary filesystem paths in client responses.
