FROM node:22-slim

# Install ffmpeg for video/audio merging and yt-dlp via pip so it runs
# directly without PyInstaller per-invocation unpacking delays on Render.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg python3 python3-pip ca-certificates \
    && pip3 install --no-cache-dir --break-system-packages "yt-dlp[default,curl-cffi]" \
    && rm -rf /var/lib/apt/lists/* \
    && test -x /usr/local/bin/yt-dlp \
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
