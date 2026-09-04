# study-kit-mcp — viết sẵn cho phase deploy (P1 chạy localhost qua `pnpm --filter mcp dev`).
# Image có ffmpeg (apt) → dùng FFMPEG_PATH/FFPROBE_PATH thay ffmpeg-static.
FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV FFMPEG_PATH=/usr/bin/ffmpeg \
    FFPROBE_PATH=/usr/bin/ffprobe \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable

WORKDIR /app

# Cần context = root monorepo khi build (docker build -f apps/mcp/Dockerfile .)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/core/package.json packages/core/
COPY apps/mcp/package.json apps/mcp/
RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY packages/core packages/core
COPY apps/mcp apps/mcp

EXPOSE 8787
CMD ["pnpm", "--filter", "mcp", "start"]
