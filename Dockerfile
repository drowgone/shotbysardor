# syntax=docker/dockerfile:1
# ============================================================
# shot by sardor — production Docker image
# Debian slim asosida (Alpine musl'da Prisma OpenSSL bilan muammo)
# ============================================================

FROM node:20-slim AS base
# ffmpeg — video quvuri (preview/thumb)
# openssl + ca-certificates — Prisma schema engine talab qiladi
# libjemalloc2 (optional) — sharp memory
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      openssl \
      ca-certificates \
      dumb-init \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- Bog'liqliklar ----
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# ---- Build ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Build vaqti env: real qiymatlar runtime'da (docker-compose orqali) beriladi.
# "Collecting page data" bosqichi route modullarni yuklaydi — SESSION_SECRET
# runtime'ga defer qilingan, lekin dummy qo'yish qo'shimcha xavfsizlik.
ENV SESSION_SECRET="build-time-dummy-not-used-at-runtime-xxxxxxxxx"
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate && npm run build

# ---- Runtime ----
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Xavfsizlik — non-root user ostida ishga tushirish.
# UID/GID build ARG orqali sozlanadi — bind mount qilingan host `./storage`
# papkasi bilan ownership mos bo'lishi uchun (default 1000 — ko'pchilik
# Linux tizimlarida birinchi user UID).
ARG APP_UID=1000
ARG APP_GID=1000
# node:20-slim image-da mavjud `node` user (UID/GID 1000) bilan to'qnashuvni oldini olish
RUN userdel -f node 2>/dev/null; groupdel node 2>/dev/null; \
    groupadd --gid ${APP_GID} nodejs \
 && useradd --uid ${APP_UID} --gid nodejs --home-dir /app --shell /bin/sh nextjs

COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.mjs ./next.config.mjs
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh \
 && mkdir -p storage/private storage/public storage/tmp \
 && chown -R nextjs:nodejs storage

USER nextjs
EXPOSE 3000

# `dumb-init` — PID 1 signal handling (Ctrl+C, docker stop) to'g'ri ishlashi uchun
ENTRYPOINT ["dumb-init", "--"]
CMD ["./docker-entrypoint.sh"]
