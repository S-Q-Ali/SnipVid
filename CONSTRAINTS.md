# CONSTRAINTS — Project Quality Bar

> Last reviewed: 2026-09-25. Any agent or engineer changing this codebase holds itself to the bar below. Numbers are enforced by the listed commands. Do not silently weaken a threshold — weakenings go through human review worklisted below.

## Product Boundary

- **SnipVid is an Instagram-only downloader.** The download feature accepts Instagram URLs only.
- Download engine is the `yt-dlp` binary present on the runtime environment (v2026.07.04 on this dev machine). Deployment environments must install it (see `.env.example` → `YTDLP_PATH`).
- Anonymous operation only. **No cookie/auth support is implemented** for Instagram login.
- Brand: **SnipVid**. Legacy "VideoToolkit" naming is retired.

## Quality Gates

| # | Constraint | Value | Command | Runs at |
|---|-----------|-------|---------|---------|
| G1 | Type errors | zero | `pnpm run typecheck` | after every increment |
| G2 | Line coverage of the app surface (`lib/instagram/**`, `lib/security/**`, `app/api/**`) | >= 80% | `pnpm run test:coverage` | end of each task |
| G3 | SSRF protection | Instagram-only hostname allowlist (`ALLOWED_HOSTS` in `lib/instagram/url.ts`) | unit tests on `url.ts` classification + route tests | T1/T2 and onward |
| G4 | Rate limiting | 5/min download, 10/min analyze per IP | route tests | T2 and onward |
| G5 | Command injection | spawn with arg arrays only, `shell:false`, user input never in argument position | unit tests + diff review | T1 and onward |
| G6 | Secrets | zero in source and history | `git diff --staged | grep -iE "password|secret|api_key|token"` | every commit |
| G7 | Stubs/suppressions | zero new (`@ts-ignore`, `eslint-disable`, `.only`/`.skip` tests, `throw "not implemented"`) | diff guard at review | end of each task |
| G8 | Destructive paths | output files confined under `storage/temp/<jobId>/`; sanitized filenames; no path traversal | service + route tests | T1/T2 and onward |
| G9 | Regression | existing suite + build stay green per increment | `pnpm run test`, `pnpm run build` | end of each task/phase |

## Floor (no exceptions)

- No `@ts-ignore`, `eslint-disable`, skipped/pending tests, or implement-me stubs in new/modified code.
- No secrets committed. `.env`/`.env.local` stay gitignored; only `.env.example` is tracked.
- No direct shell string building for `yt-dlp`. Every invocation is `spawn(bin, argsArray, { shell:false })`.
- No new runtime dependency without an explicit human "add it" (Ask-first tier). If one is added: `npm audit` must run and faults surfaced before commit.
- Client responses never leak stack traces or raw `yt-dlp` stderr; map to friendly generic messages and log detail server-side.
- Test state is isolated per test (temp sandbox dirs, no shared globals).

## Environment & Deployment

- `yt-dlp` (or `YTDLP_PATH`) must be present at runtime; surfaced in `/api/health`.
- Defense-in-depth: `INSTAGRAM_ENABLED` env flag gates download routes (`false` = disabled, safest default).
- Jobs store and rate limiter are in-memory → single-instance only. Multi-instance deployment is a documented limitation (requires Redis-backed store + limiter — out of current scope).

## Exemptions & Escalation

- A constraint can only be relaxed by explicit human approval in the session log (say the number being changed and the new value).
- If an increment cannot meet G2 coverage without contrived tests, escalate before shipping — do not silently lower the threshold.
- Destructive operations (T8 toolkit retirement) require a fresh confirmation of the delete list plus a `pre-pivot-retire` git tag before execution. Executed: the delete list was confirmed in-session and `pre-pivot-retire` marks the last commit holding the toolkit.

## Verification Commands

- `pnpm run test` — vitest
- `pnpm run test:coverage` — vitest with the coverage gate (G2)
- `pnpm run build` — next build (also runs ESLint and the type check)
- `pnpm run typecheck` — `tsc --noEmit`
- `pnpm run lint` — `eslint app components lib`