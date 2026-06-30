# syntax=docker/dockerfile:1

# ── Stage 1: install full dependencies & build ───────────────────────────────
# Debian-slim (glibc) so argon2's prebuilt binaries work without a toolchain.
FROM node:20-slim AS build
WORKDIR /app

# OpenSSL is required by Prisma's query engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: production dependencies only ────────────────────────────────────
FROM node:20-slim AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 3: minimal runtime image ───────────────────────────────────────────
FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Non-root user for least privilege.
RUN useradd --system --create-home --uid 1001 appuser

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma
COPY package.json ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && chown -R appuser:appuser /app

USER appuser
EXPOSE 4000

# Apply pending migrations, then start the API.
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
