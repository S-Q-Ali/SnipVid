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
- [ ] T7: Profile bulk download (N<=20)
- [ ] T8: Retire video toolkit (ASK-FIRST; `pre-pivot-retire` tag; confirm delete list)
- [ ] T9: Polish + SEO + full regression

## Follow-ups (tracked, not blocking)
- [ ] T8: drop the 3 `eslint.config.mjs` ignores and widen `lint` to `eslint app components lib` once the toolkit is deleted
- [ ] T9: replace the `<img>` thumbnail with `next/image` after measuring the real Instagram CDN hosts for `remotePatterns`
- [ ] Audit decisions: dev `vitest@2.1.9` critical (GHSA-5xrq-8626-4rwp, fixed in 3.2.6 -> major bump), dev highs (`fast-uri`, `js-yaml`, `brace-expansion`, `vite@5.4.21`), prod moderates (`uuid@10.0.0` -> 11.1.1, `qs@6.15.3` x2 -> 6.16.0)

## Checkpoint D
- [ ] Instagram-only app, no dead code, all gates green
- [ ] Final human review