# SnipVid — Instagram Downloader Pivot — Task List

## Phase 0: Foundation
- [x] T0: CONSTRAINTS.md + `.env.example` boundary config
- [x] T1: `lib/instagram/` module (url / types / service) via TDD
- [x] T2: `/api/instagram/{analyze,download,jobs/[id]}` routes via TDD

## Checkpoint A
- [x] Tests + build green
- [x] curl end-to-end: public reel downloads
- [x] Human review

## Phase 1: v1 UI (posts / reels / photos)
- [x] T3: Homepage rewrite (`app/page.tsx`) — SnipVid IG downloader
- [x] T4: Carousel/photo posts — per-item download (`itemIndex` -> `--playlist-items`, per-item filename suffix, "Download all" button)

## Checkpoint B
- [x] Browser end-to-end v1 (reel live 13/13; carousel UI 14/14 with intercepted analyze; live carousel leg still unverified)
- [x] Coverage >= 80% changed lines (89.96%)
- [ ] Human review

## Phase 2: v2 (stories + highlights)
- [ ] T5: Stories (best-effort, graceful login errors)
- [ ] T6: Highlights

## Checkpoint C
- [ ] Stories/highlights verified, gates green

## Phase 3: v3 (profile bulk + retire)
- [x] T7: Profile bulk download (N<=20) — implemented with a 50 item hard cap, see below
- [x] T8: Retire video toolkit (ASK-FIRST; `pre-pivot-retire` tag; confirm delete list) — done, went beyond the plan list with session approval
- [ ] T9: Polish + SEO + full regression (robots/sitemap already pruned)

## P0 downloader review (completed)
- [x] Anonymous Instagram extraction fails; optional server-side cookie session added (`INSTAGRAM_COOKIES_FILE`), anonymous stays the default
- [x] Client-supplied rate limit headers were trusted without `TRUST_PROXY`
- [x] Job registry, disk and yt-dlp runtime were all unbounded
- [x] `void startDownloadJob(job)` could become an unhandled rejection
- [x] Download route buffered whole files, accepted loose job IDs, and had no rate limit
- [x] Colliding filenames silently dropped a file; nested output was unreachable
- [x] Security headers were only applied by the shared Instagram API helper, so every page was served without them
- [x] Dependency-free API E2E harness (`pnpm test:e2e`) and CI workflow

## Follow-ups (tracked, not blocking)
- [x] T9: temp-file retention — jobs pruned after 1h, orphan directories swept, registry capped
- [ ] T9: replace the `<img>` thumbnail with `next/image` after measuring the real Instagram CDN hosts for `remotePatterns`
- [ ] Audit decisions: dev `vitest@2.1.9` critical (GHSA-5xrq-8626-4rwp, fixed in 3.2.6 -> major bump), dev highs (`fast-uri`, `js-yaml`, `brace-expansion`, `vite@5.4.21`), prod moderate `qs@6.15.3` x2 (patched in 6.16.0)
- [ ] Rate limiting is per-process; a multi-instance deploy needs a shared store
- [ ] No authenticated download has been run end to end, because no cookie file was supplied for testing

## Checkpoint D
- [ ] Instagram-only app, no dead code, all gates green
- [ ] Final human review