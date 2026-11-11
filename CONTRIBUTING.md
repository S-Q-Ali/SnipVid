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

## Rules for Contributors

- Keep `child_process.spawn` calls strictly `shell: false` with argument arrays.
- Never commit `.env`, `.env.local`, credentials, or session cookie files.
- Never introduce `@ts-ignore`, `eslint-disable`, or skipped assertions without explicit maintainer review.
- Keep user-facing feature claims aligned with what works anonymously on public Instagram links.
