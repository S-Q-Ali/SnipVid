# Changelog

All notable changes to SnipVid are documented in this file.

## [Unreleased]

### Added
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
