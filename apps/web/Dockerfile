FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN npm ci --ignore-scripts --audit=false

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Build-time variables — set these as Build Args in Dokploy
ARG VITE_PORTAL_URL=https://portal.gabitosoft.cloud
ARG VITE_PORTAL_COOKIE_NAME=token
ARG VITE_APP_SLUG=colibri
ENV VITE_PORTAL_URL=$VITE_PORTAL_URL \
    VITE_PORTAL_COOKIE_NAME=$VITE_PORTAL_COOKIE_NAME \
    VITE_APP_SLUG=$VITE_APP_SLUG

RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/web

# ── Production image ──────────────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
