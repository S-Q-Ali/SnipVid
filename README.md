# SnipVid

An Instagram downloader. Paste a public post, reel, carousel, or profile link,
analyze it, and download the media as separate files or as a bounded bulk job.

The app is a thin, honest wrapper around [yt-dlp](https://github.com/yt-dlp/yt-dlp).
It does not attempt to reimplement Instagram's API, and it does not work
around the access limits Instagram applies to unauthenticated clients.

## Requirements

- Node.js 22+
- pnpm 10+
- [`yt-dlp`](https://github.com/yt-dlp/yt-dlp/releases/latest) on `PATH`, or
  `YTDLP_PATH` pointing at it

## Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Then open http://localhost:3000. `GET /api/health` reports whether the binary
and the temporary directory are actually usable, and whether a session is
configured.

## Configuration

All configuration is server-side. Nothing here is read from a request.

| Variable | Default | Purpose |
| --- | --- | --- |
| `YTDLP_PATH` | `yt-dlp` | Path to the yt-dlp binary. |
| `INSTAGRAM_ENABLED` | `true` | Set to `false` to return 503 from every Instagram endpoint. |
| `TRUST_PROXY` | `false` | Set to `true` only when a proxy in front of the app overwrites `x-forwarded-for`. See below. |
| `INSTAGRAM_COOKIES_FILE` | unset | Path to a Netscape-format cookies file, used as an authenticated session. |

### `TRUST_PROXY`

`x-forwarded-for` is set by the client, so by default it is ignored and every
visitor shares one rate-limit bucket. Set `TRUST_PROXY=true` only once you have
confirmed the edge proxy replaces (or appends to) the header, otherwise anyone
can rotate the value and bypass the limits.

### Instagram sessions

Anonymous access is the default and stays supported. Instagram increasingly
answers unauthenticated requests with a login wall, so a persistent session can
be supplied out of band:

```bash
export INSTAGRAM_COOKIES_FILE=/absolute/path/cookies.txt
```

The file is read by yt-dlp and never by the app. It is not accepted from a
request body, and its path is not returned by any endpoint, including
`/api/health`, which reports only `available`, `anonymous` or `error`.

## How a download works

1. `POST /api/instagram/analyze` validates the link, then asks yt-dlp for
   metadata. At most 50 items are reported, along with the real total.
2. `POST /api/instagram/download` creates a job and returns `202` immediately
   with a job ID. The run itself happens in the background.
3. `GET /api/instagram/jobs/[id]` reports progress, produced files, and — for a
   failed job — a message the operator can act on.
4. `GET /api/download/[jobId]/[filename]` streams a produced file.

Failures are reported honestly. When Instagram refuses the request, the app
says so instead of suggesting the user check their link.

## Limits

These are deliberate, and the values live in `lib/instagram/service.ts`:

- **50 items** reported per analysis, and per bulk download.
- **512 MB** per file, passed to yt-dlp as `--max-filesize`.
- **3** concurrent yt-dlp processes. A job that has to wait stays `pending`
  rather than being rejected.
- **60s** for an analysis, **15 minutes** for a download. Both kill the child
  process on expiry.
- **200** tracked jobs, each removed with its files an hour after it finishes.
  Directories left behind by a previous process are swept on startup of the next
  job.
- Rate limits: 10 analyses and 5 job creations per minute, 30 file fetches per
  minute, per client address.

`/api/health` covers which of these are in effect for the running instance.

## Development

```bash
pnpm test           # unit and route tests
pnpm test:coverage  # same, with the 80% coverage gate
pnpm test:e2e       # builds, starts the server, drives it over HTTP
pnpm typecheck
pnpm lint
pnpm build
```

`pnpm test:e2e` needs no extra dependency: it uses Node's built-in test runner
and `fetch`. It asserts on routing, validation, rate limiting, and security
headers, and deliberately does not contact Instagram.

## Known limitations

- **Authenticated downloads are untested end to end.** No cookie file was
  available while this was built, so the session path is covered by unit tests
  and a health check, not a real download.
- **Rate limits are per process.** A multi-instance deployment needs a shared
  store such as Redis.
- **No HTTP range requests.** Produced files are served as a single attachment;
  seeking inside a video in the browser is not supported.
- **Stories and highlights are not implemented.** They are the remaining work
  in `tasks/plan.md`.

## Layout

```
app/api/instagram/     analyze, download, and job polling routes
app/api/download/      file serving
app/api/health/        readiness, including yt-dlp and session state
lib/instagram/         url parsing, yt-dlp execution, job registry
lib/security/          rate limiting, security headers, shared validation
middleware.ts          applies the security headers to every response
```

`CONSTRAINTS.md` records the rules this code is held to, and why.
