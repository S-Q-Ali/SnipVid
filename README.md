# SnipVid

[![CI](https://github.com/S-Q-Ali/SnipVid/actions/workflows/ci.yml/badge.svg)](https://github.com/S-Q-Ali/SnipVid/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Live Demo](https://img.shields.io/badge/Live-Render-46E3B7?logo=render&logoColor=white)](https://snipvid.onrender.com)

An anonymous Instagram media downloader built with Next.js 15, TypeScript, Tailwind CSS, and [`yt-dlp`](https://github.com/yt-dlp/yt-dlp).
Paste a public Instagram post, reel, photo, or carousel link, inspect its media items, and download them individually or together as a bounded bulk job.

**Live App:** <https://snipvid.onrender.com>

The app is a thin, honest wrapper around `yt-dlp` and `ffmpeg`. It does not attempt to bypass Instagram's authentication walls or reimplement Instagram's private API.

## Supported Features

- **Reels & Video Posts** (`/reel/...`, `/<user>/reel/...`, `/p/...`, `/tv/...`) — downloaded as iOS-compatible H.264 + AAC `.mp4` files.
- **Photo Posts & Images** (`/p/...`, `/<user>/p/...`) — extracted cleanly as `.jpg` images.
- **Carousels** — analyze multi-item posts (photos, videos, or mixed) and download individual items (`--playlist-items`) or bundle all items (up to 50) into a single `.zip` archive with automatic download.
- **100% Anonymous Default** — works without user logins or cookies for publicly accessible Instagram links.

## Requirements

- Node.js 22+
- pnpm 10+
- [`yt-dlp`](https://github.com/yt-dlp/yt-dlp/releases/latest) on `PATH` or configured via `YTDLP_PATH`
- `ffmpeg` on `PATH` (used by `yt-dlp` to merge video/audio streams and convert thumbnails)

## Local Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open `http://localhost:3000`. `GET /api/health` reports whether `yt-dlp`, temporary storage, and optional session configuration are ready.

## Deploy on Render (Docker)

This repository includes a production [`Dockerfile`](./Dockerfile), [`.dockerignore`](./.dockerignore), and [`render.yaml`](./render.yaml) blueprint with `ffmpeg` and `yt-dlp` pre-installed:

1. Create a **Blueprint** or **Web Service (Docker)** on Render connected to this repository.
2. Set `Health Check Path` to `/api/health`.
3. Configure environment variables:
   - `NODE_ENV=production`
   - `YTDLP_PATH=/usr/local/bin/yt-dlp`
   - `STORAGE_TEMP_DIR=/tmp/snipvid`
   - `INSTAGRAM_ENABLED=true`
   - `TRUST_PROXY=true`
   - `NEXT_PUBLIC_SITE_URL=https://your-service.onrender.com`

## Configuration

All configuration is server-side. Nothing is accepted from a client request.

| Variable | Default | Purpose |
| --- | --- | --- |
| `YTDLP_PATH` | `yt-dlp` | Path to the `yt-dlp` binary. |
| `INSTAGRAM_ENABLED` | `true` | Set to `false` to disable all Instagram endpoints (`503`). |
| `STORAGE_TEMP_DIR` | `./storage/temp` | Writable directory for temporary downloaded media. |
| `TRUST_PROXY` | `false` | Set to `true` behind a trusted reverse proxy (e.g. Render) so per-IP rate limiting reads `x-forwarded-for`. |
| `INSTAGRAM_COOKIES_FILE` | unset | Optional path to a Netscape-format cookies file for operator-authenticated sessions. |
| `HEALTH_SECRET` | unset | Optional secret header (`x-health-token`) to unlock detailed checks on `GET /api/health`. |
| `NEXT_PUBLIC_SITE_URL` | `https://snipvid.example.com` | Canonical base URL for `robots.txt` and `sitemap.xml`. |

## API Endpoints

| Method & Path | Purpose |
| --- | --- |
| `POST /api/instagram/analyze` | Validates an Instagram URL against an allowlist and fetches metadata via `yt-dlp -J` (up to 50 items reported, alongside the real total). |
| `POST /api/instagram/download` | Creates a download job and returns `202` immediately with a `jobId`. |
| `GET /api/instagram/jobs/[id]` | Reports job status, progress, produced filenames, and friendly errors. |
| `GET /api/download/[jobId]/[filename]` | Streams the downloaded `.mp4`, `.jpg`, or `.zip` file as an attachment. |
| `GET /api/health` | Returns minimal readiness (`{ status, timestamp }`) publicly; returns detailed `checks` only when `HEALTH_SECRET` matches `x-health-token`. |

## Limits & Security

Values live in [`lib/instagram/service.ts`](./lib/instagram/service.ts) and [`lib/security/service.ts`](./lib/security/service.ts):

- **50 items** max per analysis and per bulk download.
- **512 MB** max per downloaded file (`--max-filesize`).
- **3** concurrent `yt-dlp` processes (extra jobs wait as `pending`).
- **60s** timeout for analyze, **15 minutes** for download.
- **200** tracked jobs in memory; completed job files are cleaned up after 1 hour.
- **Rate limits:** 10 analyses, 5 downloads, 120 status polls, 30 file fetches, and 60 health checks per minute per client IP.
- Strict CSP, `X-Frame-Options: DENY`, `shell: false` spawn arrays, and path-traversal guards.

## Development

```bash
pnpm test           # unit and route tests
pnpm test:coverage  # unit and route tests with >= 80% coverage gate
pnpm test:e2e       # builds the app, starts Next.js, and verifies HTTP routes & headers
pnpm typecheck
pnpm lint
pnpm build
```

## Known Limitations

- **Stories, highlights, and profile bulk scraping:** Instagram requires authentication for stories and highlights, and `yt-dlp` currently marks profile extraction (`instagram:user`) as broken upstream. Public `/p/`, `/reel/`, and `/tv/` links work anonymously.
- **Single-instance in-memory state:** Job tracking and rate limiting live in memory; multi-instance deployments require a shared store (e.g. Redis) and per-instance `STORAGE_TEMP_DIR`.
- **No HTTP range requests:** Downloaded files are served as complete attachments.

## Layout

```text
app/api/instagram/     analyze, download, and job polling routes
app/api/download/      file streaming route
app/api/health/        readiness check (yt-dlp, storage, session)
lib/instagram/         URL classification, yt-dlp execution, job retention
lib/security/          rate limiting, security headers, UUID validation
middleware.ts          applies security headers across pages and API routes
Dockerfile             production container with Node 22, pnpm, ffmpeg, and yt-dlp
render.yaml            Render Blueprint deployment config
```

See [`CONSTRAINTS.md`](./CONSTRAINTS.md) for engineering quality gates, [`CONTRIBUTING.md`](./CONTRIBUTING.md) for contributor guidelines, [`SECURITY.md`](./SECURITY.md) for security policy, [`CHANGELOG.md`](./CHANGELOG.md) for release history, and [`LICENSE`](./LICENSE) for MIT license terms.
