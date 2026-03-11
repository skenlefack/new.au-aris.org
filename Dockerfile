# ARIS 4.0 — Multi-stage Dockerfile for NestJS services
# Usage: docker build --build-arg SERVICE=tenant -t aris-tenant .

# ═══════════════════════════════════════════════
# Stage 1: Base — install pnpm + dependencies
# ═══════════════════════════════════════════════
FROM node:20-alpine AS base

RUN corepack enable && corepack prepare pnpm@9 --activate
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./

# ═══════════════════════════════════════════════
# Stage 2: Pruned — turbo prune for target service
# ═══════════════════════════════════════════════
FROM base AS pruned

ARG SERVICE
RUN test -n "$SERVICE" || (echo "ERROR: SERVICE build arg is required" && exit 1)

# Install turbo globally for prune
RUN pnpm add -g turbo

# Copy full source for pruning
COPY . .

# Prune to only the target service and its dependencies
RUN turbo prune @aris/${SERVICE}-service --docker

# ═══════════════════════════════════════════════
# Stage 3: Installer — install pruned dependencies
# ═══════════════════════════════════════════════
FROM base AS installer

# Copy pruned package.json files
COPY --from=pruned /app/out/json/ .

# Install dependencies (production only)
RUN pnpm install --frozen-lockfile

# Copy pruned source code
COPY --from=pruned /app/out/full/ .

# Generate Prisma client if schema exists
RUN if ls packages/db-schemas/prisma/*.prisma 1>/dev/null 2>&1; then \
      cd packages/db-schemas && npx prisma generate; \
    fi

# Build
RUN pnpm turbo build --filter=@aris/${SERVICE}-service

# ═══════════════════════════════════════════════
# Stage 4: Runner — minimal production image
# ═══════════════════════════════════════════════
FROM node:20-alpine AS runner

RUN addgroup --system --gid 1001 aris && \
    adduser --system --uid 1001 aris

WORKDIR /app

ARG SERVICE

# Copy built output
COPY --from=installer --chown=aris:aris /app/node_modules ./node_modules
COPY --from=installer --chown=aris:aris /app/packages ./packages
COPY --from=installer --chown=aris:aris /app/services/${SERVICE}/dist ./services/${SERVICE}/dist
COPY --from=installer --chown=aris:aris /app/services/${SERVICE}/node_modules ./services/${SERVICE}/node_modules
COPY --from=installer --chown=aris:aris /app/services/${SERVICE}/package.json ./services/${SERVICE}/package.json

USER aris

ENV NODE_ENV=production
ENV SERVICE_NAME=${SERVICE}

WORKDIR /app/services/${SERVICE}

EXPOSE 3000

CMD ["node", "dist/main.js"]
