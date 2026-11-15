# syntax=docker/dockerfile:1

# Lokkhi API. Build from the repo root so the shared workspace packages are in
# the context:
#   docker build -f docker/lokkhi.Dockerfile -t ganesh-lokkhi-api .
FROM node:24-bookworm-slim AS build
WORKDIR /app

# Copy only the manifests first so `npm ci` is cached until a dependency changes.
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
COPY lokkhi/backend lokkhi/backend

RUN npm run build:packages \
 && npm run build -w lokkhi/backend

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/lokkhi/backend/package.json ./lokkhi/backend/package.json
COPY --from=build /app/lokkhi/backend/dist ./lokkhi/backend/dist

USER node
WORKDIR /app/lokkhi/backend

# The app reads PORT (default 8081) and binds 0.0.0.0, which is what Fly expects.
ENV PORT=8080
ENV HOST=0.0.0.0
EXPOSE 8080

CMD ["node", "dist/index.js"]
