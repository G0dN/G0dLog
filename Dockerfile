FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV BLOG_DATA_DIR=/var/lib/g0dlog/data
ENV BLOG_MEDIA_DIR=/var/lib/g0dlog/media
ENV BLOG_BACKUP_DIR=/var/lib/g0dlog/backups
RUN mkdir -p /var/lib/g0dlog/data /var/lib/g0dlog/media /var/lib/g0dlog/backups && chown -R node:node /var/lib/g0dlog
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts
RUN node --input-type=module -e "import sharp from 'sharp'; const input = { create: { width: 1, height: 1, channels: 3, background: '#ffffff' } }; await sharp(input).webp().toBuffer(); await sharp(input).avif().toBuffer();"
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["sh", "-c", "node scripts/validate-production-config.mjs && node server.js"]
