# syntax=docker/dockerfile:1
# ============================================================
# shot by sardor — production Docker image
# Multi-stage build. Runtime'da ffmpeg + Node.js + Prisma bor.
# ============================================================

FROM node:20-alpine AS base
# ffmpeg — video quvurini ishlatish uchun (video preview/thumb generatsiyasi).
# libc6-compat — sharp'ning glibc'ga bog'liq binarylari uchun.
RUN apk add --no-cache ffmpeg libc6-compat
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

# Xavfsizlik — non-root user ostida ishga tushirish
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

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

CMD ["./docker-entrypoint.sh"]
