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

## Checkpoint D
- [ ] Instagram-only app, no dead code, all gates green
- [ ] Final human review