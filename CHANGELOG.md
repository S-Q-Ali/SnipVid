# Changelog

All notable changes to SnipVid are documented in this file.

## [Unreleased]

### Security & Hardening
- Restricted `GET /api/health` public responses to `{ status, timestamp }` (gating detailed diagnostic `checks` behind optional `HEALTH_SECRET`), added 60s single-flight caching for the `yt-dlp` probe (8s timeout), and enforced per-IP rate limiting (`60/min`).
- Added a `16 MB` stdout cap (`MAX_ANALYZE_JSON_BYTES`) and bounded stderr collection in `yt-dlp -J` analysis.
- Added `.github/dependabot.yml` for automated weekly dependency updates across npm, Docker, and GitHub Actions.
- Upgraded `next` and `eslint-config-next` from `15.5.26` to `15.5.29` (patching Image Optimization RCE `GHSA-2464-fhr4-w9xw`, Server Actions DoS `GHSA-p3m5-59mp-jv5r`, and cache-poisoning advisories).
- Configured `images: { unoptimized: true }` in `next.config.ts`.
- Added rate limiting (`120/min`) and `Retry-After: 60` headers to `GET /api/instagram/jobs/[id]` and `Retry-After: 60` to `GET /api/download/[jobId]/[filename]`.
- Added `MAX_URL_LENGTH` (`2048`) request body validation, `x-request-id` correlation headers in `middleware.ts`, and structured JSON error logging (`logRouteError`).
- Enabled `ignore-scripts=true` in `.npmrc` and added a container `HEALTHCHECK` in `Dockerfile`.

### Fixed
- Handled non-OK job polling responses (`404`/`429`/`503`) cleanly in the downloader form instead of polling indefinitely, and prevented native form submits when pressing Enter while a request is running.
- Aligned unsupported-URL API errors across `/api/instagram/analyze` and `/api/instagram/download` with the supported feature scope.

### Added
- Full SEO foundation: `lib/site.ts` canonical configuration, OpenGraph & Twitter Card metadata, dynamic `opengraph-image.tsx`, SVG brand `icon.svg`, `manifest.ts`, `robots.ts` host/sitemap directives, and `WebApplication` + `FAQPage` JSON-LD structured data.
- Polished UI/UX styling: mapped semantic theme CSS variables into `tailwind.config.ts`, refined WCAG AA+ color contrast, added `Plus Jakarta Sans` + `Inter` display/body typography, clipboard Paste and Clear buttons, broken-thumbnail fallback, accessible progressbar (`role="progressbar"`), How-it-works section, and interactive FAQ accordion.
- Production GitHub documentation (`LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, and `.github` issue/PR templates).
- Support for extracting single photo posts and mixed carousels as `.jpg` images via `yt-dlp` thumbnail flags (`--ignore-no-formats-error`, `--write-thumbnail`, `--convert-thumbnails jpg`), with automatic pruning of redundant video thumbnails.
- MIME type mappings for `.jpg`, `.jpeg`, `.png`, and `.webp` in `/api/download/[jobId]/[filename]`.
- Classification support for profile-prefixed Instagram media links (`/<username>/reel/<id>/`, `/<username>/p/<id>/`, `/<username>/tv/<id>/`).

### Changed
- Migrated production hosting from Vercel to full-stack Docker deployment on Render (`Dockerfile`, `.dockerignore`, `render.yaml`, `yt-dlp[default,curl-cffi]` + `ffmpeg`).
- Aligned homepage copy, metadata, and form hints honestly to supported anonymous features (Posts, Reels, Photos, and Carousels).
- Updated `README.md` with production setup, deployment instructions, API flow, limits, and known limitations.

## [0.1.0] - 2026-09-29

### Added
- Focused Instagram downloader built on Next.js 15 App Router, TypeScript, Tailwind CSS, and `yt-dlp`.
- API endpoints: `POST /api/instagram/analyze`, `POST /api/instagram/download`, `GET /api/instagram/jobs/[id]`, `GET /api/download/[jobId]/[filename]`, and `GET /api/health`.
- Security hardening: SSRF allowlist, per-IP rate limiting, strict CSP and security headers via `middleware.ts`, bounded job registry with 1-hour cleanup, and secret redaction.
- Automated Vitest coverage suite, dependency-free API E2E suite (`scripts/api-e2e.mjs`), and GitHub Actions CI workflow.
