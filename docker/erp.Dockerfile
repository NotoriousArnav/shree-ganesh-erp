# syntax=docker/dockerfile:1

# The whole ERP in one container: both SPAs, both Fastify APIs and a Caddy edge
# that separates them by path prefix (`/mushak/...`, `/lokkhi/...`).
#
# Build from the repo root so the shared workspace packages are in the context:
#   docker build -f docker/erp.Dockerfile -t ganesh-erp .
#
# Public surface (Caddy, port 8080):
#   /                              -> redirect to /mushak/
#   /mushak/, /lokkhi/             -> SPA builds
#   /mushak/api/*, /lokkhi/api/*   -> the matching Fastify backend
#   /health                        -> container health

# ---- Build ---------------------------------------------------------------
FROM node:24-bookworm-slim AS build
WORKDIR /app

# Manifests first so `npm ci` is cached until a dependency actually changes.
COPY package.json package-lock.json ./
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY mushak/backend/package.json mushak/backend/
COPY mushak/frontend/package.json mushak/frontend/
COPY lokkhi/backend/package.json lokkhi/backend/
COPY lokkhi/frontend/package.json lokkhi/frontend/

RUN npm ci --workspaces --include-workspace-root --no-audit --no-fund

COPY packages packages
COPY mushak mushak
COPY lokkhi lokkhi

# `build:packages` first: every app resolves @ganesh/* from dist/, not src/.
# Each frontend is compiled with its public mount point baked in, so router
# basenames and asset URLs point at /mushak/ and /lokkhi/.
RUN npm run build:packages \
 && npm run build -w mushak/backend \
 && npm run build -w lokkhi/backend \
 && MUSHAK_BASE_PATH=/mushak/ npm run build -w mushak/frontend \
 && LOKKHI_BASE_PATH=/lokkhi/ npm run build -w lokkhi/frontend

# ---- Runtime -------------------------------------------------------------
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Caddy ships as a statically linked binary, so the Alpine image only supplies
# the executable.
COPY --from=caddy:2-alpine /usr/bin/caddy /usr/local/bin/caddy

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages

COPY --from=build /app/mushak/backend/package.json ./mushak/backend/package.json
COPY --from=build /app/mushak/backend/dist ./mushak/backend/dist
COPY --from=build /app/lokkhi/backend/package.json ./lokkhi/backend/package.json
COPY --from=build /app/lokkhi/backend/dist ./lokkhi/backend/dist

COPY --from=build /app/mushak/frontend/dist /srv/mushak
COPY --from=build /app/lokkhi/frontend/dist /srv/lokkhi

COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
 && mkdir -p /tmp/caddy/config /tmp/caddy/data \
 && chown -R node:node /app /srv /tmp/caddy

USER node
# Caddy keeps its (tiny) state under /tmp; nothing else needs a writable root.
ENV HOME=/tmp \
    XDG_CONFIG_HOME=/tmp/caddy/config \
    XDG_DATA_HOME=/tmp/caddy/data \
    PORT=8080

EXPOSE 8080

# Bash is PID 1 here: it reaps children and forwards SIGTERM to all three
# processes, so no extra init binary is needed.
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
