# Contributing to SnipVid

Thank you for contributing to SnipVid. Please follow these guidelines before opening a pull request.

## Prerequisites

- **Node.js** 22+
- **pnpm** 10+
- **`yt-dlp`** and **`ffmpeg`** on `PATH` (or `YTDLP_PATH` set in `.env.local`) for local end-to-end download testing

## Local Setup

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

## Quality Gates

Every change must satisfy all gates defined in [`CONSTRAINTS.md`](./CONSTRAINTS.md):

```bash
pnpm typecheck      # 0 TypeScript errors
pnpm lint           # 0 ESLint errors
pnpm test:coverage  # >= 80% line coverage across lib/instagram, lib/security, app/api
pnpm test:e2e       # Next.js production build + API E2E suite
```

## Branching & Pull Request Workflow

SnipVid follows **Trunk-Based Development** so `main` remains deployable at all times:

- **Branch from `main`** for every change and keep branches short-lived (1–3 days).
- **Use clear branch prefixes:**
  - `feat/<short-description>` — new features
  - `fix/<short-description>` — bug fixes
  - `chore/<short-description>` — tooling, dependencies, or CI configuration
  - `refactor/<short-description>` — internal cleanup without behavior change
  - `docs/<short-description>` — documentation updates
- **Keep commits atomic & scoped:** Use Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`) and avoid mixing formatting-only edits with behavior changes.
- **Target `main` via Pull Request:** Ensure both CI jobs (`verify` and `e2e`) pass before merging. Do not force-push shared branches (`main`).
- **Clean up after merge:** Remote PR branches are deleted automatically on merge (`delete_branch_on_merge`); run `git checkout main && git pull --prune` locally to drop stale remote tracking refs.

## Rules for Contributors

- Keep `child_process.spawn` calls strictly `shell: false` with argument arrays.
- Never commit `.env`, `.env.local`, credentials, or session cookie files.
- Never introduce `@ts-ignore`, `eslint-disable`, or skipped assertions without explicit maintainer review.
- Keep user-facing feature claims aligned with what works anonymously on public Instagram links.
