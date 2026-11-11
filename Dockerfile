FROM node:22-slim

# Install ffmpeg for video/audio merging and standalone yt-dlp_linux binary
# (includes bundled curl_cffi and TLS certificates without needing system Python).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg curl ca-certificates \
    && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && rm -rf /var/lib/apt/lists/* \
    && yt-dlp --version \
    && ffmpeg -version >/dev/null

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG NEXT_PUBLIC_SITE_URL=https://snipvid.example.com
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}

RUN pnpm build

RUN mkdir -p /tmp/snipvid && chown -R node:node /app /tmp/snipvid
USER node

ENV NODE_ENV=production
ENV YTDLP_PATH=/usr/local/bin/yt-dlp
ENV STORAGE_TEMP_DIR=/tmp/snipvid
ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-c", "pnpm exec next start -H 0.0.0.0 -p ${PORT:-3000}"]
