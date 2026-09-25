# SnipVid — Instagram Downloader Pivot — Task List

## Phase 0: Foundation
- [ ] T0: CONSTRAINTS.md + `.env.example` boundary config
- [ ] T1: `lib/instagram/` module (url / types / service) via TDD
- [ ] T2: `/api/instagram/{analyze,download,jobs/[id]}` routes via TDD

## Checkpoint A
- [ ] Tests + build green
- [ ] curl end-to-end: public reel downloads
- [ ] Human review

## Phase 1: v1 UI (posts / reels / photos)
- [ ] T3: Homepage rewrite (`app/page.tsx`) — SnipVid IG downloader
- [ ] T4: Carousel/photo posts — per-item download

## Checkpoint B
- [ ] Browser end-to-end v1
- [ ] Coverage >= 80% changed lines
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