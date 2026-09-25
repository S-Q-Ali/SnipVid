# Implementation Plan: SnipVid — Instagram Downloader Pivot

> Approved 2026-09-25. Locked decisions from user interview are marked **[LOCKED]**.

## Overview

Pivot SnipVid from a general 17-page video toolkit into an **Instagram-only downloader**.
Download engine is the system `yt-dlp` binary (v2026.07.04 installed). Phased delivery:
v1 = posts/reels/photos, v2 = stories/highlights, v3 = profile bulk. Anonymous-only
(no cookie/auth support). Old video-conversion toolkit is retired at T8 (git-recoverable).

## Architecture Decisions

- **[LOCKED] Scope:** Instagram-only. All 16 other tool pages retired (T8).
- **[LOCKED] Engine:** `yt-dlp` via `child_process.spawn` with **arg arrays only** (`shell:false`).
  User input never forms an argument position; URL is passed as a positional value, `-o`
  template is built from server-side jobId, never user content.
- **Module:** new `lib/instagram/` with `url.ts` (classification), `types.ts` (contracts), `service.ts` (spawn orchestration, job store, progress). Replaces `lib/downloader/`.
- **API surface:** `POST /api/instagram/analyze` → `POST /api/instagram/download` (background job, returns jobId) → `GET /api/instagram/jobs/[id]`; files served via existing `GET /api/download/[jobId]/[filename]`.
- **Security:** Instagram-only hostname allowlist in `validateURL` (SSRF); rate limit 5/min download, 10/min analyze per IP; generic client errors; filenames sanitized with `sanitizeFilename`; outputs confined to `storage/temp/<jobId>/`.
- **[LOCKED] No ZIP in v1/v2:** carousel/multi-media served as individual files via the download route. ZIP deferred to "ask-first" polish (fflate, zero-dep) if the user requests single-file download.
- **Jobs store:** small in-memory job map keyed by UUID (single-instance OK; note in CONSTRAINTS for multi-instance deployments).

## Task List

### Phase 0: Foundation

- [ ] **T0. CONSTRAINTS.md + boundary config**
  - Acceptance: `CONSTRAINTS.md` records quality bar (table below), floor, verification commands; `.env.example` documents `YTDLP_PATH` (optional) + `INSTAGRAM_ENABLED`.
  - Verification: file review; `npm run typecheck`, `npm run test` still pass (no code changed).
  - Dependencies: none. Files: `CONSTRAINTS.md`, `.env.example`.

- [ ] **T1. `lib/instagram/` module (TDD)**
  - Acceptance: `url.ts` classifies post/reel/story/highlight/profile/user links (instagram.com + ig.gs + instagr.am forms, rooted at canonical `instagram.com`); `service.ts` runs `yt-dlp -J` for `analyze()` and `yt-dlp` download per types; safe spawn (arg arrays, no shell); delta progress parsed from `--progress` lines; job store in-memory. Failing tests written **first**; spawn mocked.
  - Verification: `npm run test` (vitest, `lib/instagram/**`), `npm run typecheck`.
  - Dependencies: T0. Files: `lib/instagram/{url,types,service}.ts`, `lib/instagram/__tests__/*`.

- [ ] **T2. Instagram API routes (TDD)**
  - Acceptance: `POST /api/instagram/analyze`, `POST /api/instagram/download`, `GET /api/instagram/jobs/[id]`; SSRF allowlist via `validateURL`; rate limit 5/min download / 10/min analyze; generic errors (no stack traces); download job background + jobId. Route tests pass.
  - Verification: `npm run test`, `npm run typecheck`.
  - Dependencies: T1. Files: `app/api/instagram/{analyze,download,jobs/[id]}/route.ts`.

### Checkpoint A
- [ ] Tests + build green (`npm run test`, `npx tsc --noEmit`)
- [ ] curl/end-to-end: one public reel downloads; files served under `storage/temp/<jobId>/`
- [ ] Human review before Phase 1

### Phase 1: v1 UI (posts/reels/photos)

- [ ] **T3. Homepage rewrite (`app/page.tsx` + layout/meta)**
  - Acceptance: SnipVid-branded single-purpose UI — URL input, analyze card, download start/progress via jobs poll, per-file download buttons; mobile-first; no dead toolkit links.
  - Verification: `npm run build`, browser check (webapp-testing/devtools), `npm run typecheck`.
  - Dependencies: T2. Files: `app/page.tsx`, `app/layout.tsx`, shared components.

- [ ] **T4. Carousel/photo posts — per-item download**
  - Acceptance: analyze returns multiple media entries; UI lists each with its own download; filenames sanitized; all served via download route.
  - Verification: `npm run test` (contribute case), `npm run build`, browser check.
  - Dependencies: T3. Files: `lib/instagram/service.ts`, `app/page.tsx`, components.

### Checkpoint B
- [ ] Browser end-to-end v1 (posts, reels, photo carousel)
- [ ] Coverage >= 80% changed lines (`vitest run --coverage` or diff review)
- [ ] Human review before Phase 2

### Phase 2: v2 (stories + highlights)

- [ ] **T5. Stories** — anonymous best-effort; login-required → mapped friendly error (repro-test for yt-dlp message).
- [ ] **T6. Highlights** — shortcode style URLs; same error mapping.
- Dependencies: T4. Files: `lib/instagram/url.ts`, `lib/instagram/service.ts`, tests.

### Checkpoint C
- [ ] Stories/highlights verified; clear errors where auth required; all gates green

### Phase 3: v3 (profile bulk + retire toolkit)

- [ ] **T7. Profile bulk** — `--flat-playlist` count, batch queue, N<=20 cap, DoS-safe pacing.
  - Files: `lib/instagram/service.ts`, `app/page.tsx`, tests.

- [ ] **T8. Retire video toolkit (ASK-FIRST, destructive)** — **exact list:**
  - Pages (16): `app/{video-converter, video-to-mp4, mpeg-4-to-mp4, mov-to-mp4, mkv-to-mp4, webm-to-mp4, avi-to-mp4, video-to-mp3, video-compressor, video-resizer, video-trimmer, video-cropper, video-to-gif, rotate-video, social-video-converter, video-downloader}/`
  - APIs: `app/api/upload/route.ts`, `app/api/convert/route.ts` (keep `download/`, `health/`)
  - lib: `lib/ffmpeg/`, `lib/downloader/` (→ `lib/instagram/`), `lib/seo/tool-seo.ts`, `lib/jobs/queue.ts` (keep if reused by IG)
  - Components: `components/converter/*`, `components/upload/`, `components/jobs/` (keep `header/`, `footer/`)
  - Inspect then decide: `scripts/` (hello.ts demo), `validation/`, `lib/security` dead exports; `artifacts/` untouched.
  - Safety: git tag `pre-pivot-retire` created first; confirm delete list with human before executing.

- [ ] **T9. Polish + SEO + full regression** — brand meta/structured data, `robots.ts`, `sitemap.ts` prune; final `npm run build`/`test`/`typecheck`/`lint`; console clean.

### Checkpoint D
- [ ] Instagram-only app, no dead code, all quality gates green
- [ ] Final human review

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| yt-dlp not present on deploy env | High | `.env.example` `YTDLP_PATH`; `/api/health` reports engine presence; CONSTRAINTS documents deploy requirement |
| IG changes DOM/extractor breaks yt-dlp | Med | Engine version pinned in health + docs; friendly generic errors |
| Command injection via URL | High | spawn arg arrays only; URL as positional value; never user-flag passing |
| SSRF via URL | High | Instagram-only hostname allowlist + existing private-IP checks |
| Temp-dir inconsistency (serving route uses `os.tmpdir()/videotoolkit`, downloader uses `storage/temp`) | Med | Standardize on `storage/temp/<jobId>`; single constant; fix in T3 |
| Carousel output naming collision | Low | `sanitizeFilename` + per-item index suffix |
| Stories/highlights need auth | Med | Graceful "login required" mapping; feature stays best-effort |
| Bulk profile abuse | Med | N<=20 cap + rate limit pacing |
| Multi-instance in-memory jobs/rate store | Low | Documented limitation in CONSTRAINTS |
| Regression during retire | Med | Tag before deletion; git-recoverable; delete confirmed in increments |

## Constraints (locked numbers — T0 writes CONSTRAINTS.md)

| Constraint | Value | Command | Runs at |
|---|---|---|---|
| Types | zero errors | `npx tsc --noEmit` | after each increment |
| Coverage (changed lines) | >= 80% | `npm run test` + diff | task end |
| SSRF | Instagram-only allowlist | route tests | task end (routes) |
| Rate limit | 5/min download, 10/min analyze | route tests | task end |
| Secrets | zero in source | diff grep | commit |
| Stubs/suppressions | zero (`@ts-ignore`, `eslint-disable`, skipped tests) | diff guard | review |

Test framework: vitest (`npm run test`). Build: `npm run build`. Typecheck: `npm run typecheck`. Lint: `npm run lint`.