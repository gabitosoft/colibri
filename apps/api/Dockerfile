FROM node:22-alpine AS builder
WORKDIR /app

# Copy manifests first so this layer is cached until deps change
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN npm ci --ignore-scripts --audit=false

# Copy source and build
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/api

# ── Production image ──────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# Reinstall production-only deps (excludes devDependencies)
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN npm ci --omit=dev --ignore-scripts --audit=false

# Copy compiled shared so the node_modules/@colibri/shared symlink resolves
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Copy compiled API
COPY --from=builder /app/apps/api/dist ./apps/api/dist

WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main"]
