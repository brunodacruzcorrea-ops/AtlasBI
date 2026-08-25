# syntax=docker/dockerfile:1.7
#
# Build context is the repo root (not artifacts/api-server/), because the
# pnpm workspace needs to resolve @workspace/api-zod and @workspace/db,
# which are workspace:* deps that export raw TypeScript source directly.

FROM node:24-slim AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter @workspace/api-server...
RUN pnpm --filter @workspace/api-server run build

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=build /repo/artifacts/api-server/dist ./dist
EXPOSE 8080
HEALTHCHECK CMD node -e "fetch('http://localhost:8080/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
