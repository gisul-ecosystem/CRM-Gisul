FROM oven/bun:1.3.12 AS base
WORKDIR /app

FROM base AS deps
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/crm?schema=public
COPY package.json bun.lock turbo.json ./
COPY apps ./apps
COPY packages ./packages
RUN bun install --frozen-lockfile

FROM deps AS build-common
ARG API_URL=http://localhost:3001
ENV API_URL=${API_URL}
ENV NODE_ENV=production
COPY . .
RUN bun run --filter=@crm/db db:generate

FROM build-common AS build-api
RUN bunx turbo run build --filter=api

FROM build-common AS build-agent
RUN bunx turbo run build --filter=agent

FROM node:22-bookworm-slim AS build-app
ARG API_URL=http://localhost:3001
ENV API_URL=${API_URL}
ENV NODE_ENV=production
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/crm?schema=public
ENV BETTER_AUTH_SECRET=docker-build-placeholder-secret-min-32-chars
ENV ALLOWED_SIGN_IN=example.com
ENV AGENT_BRIDGE_SECRET=docker-build-bridge-secret-min-16
ENV AGENT_URL=http://agent:2000
WORKDIR /app
COPY --from=build-common /app/node_modules ./node_modules
COPY --from=build-common /app/package.json ./package.json
COPY --from=build-common /app/apps ./apps
COPY --from=build-common /app/packages ./packages
WORKDIR /app/apps/app
RUN node ./node_modules/next/dist/bin/next build --webpack

FROM base AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build-api /app/node_modules ./node_modules
COPY --from=build-api /app/package.json ./package.json
COPY --from=build-api /app/apps/api ./apps/api
COPY --from=build-api /app/packages ./packages
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["bun", "run", "start:prod"]

FROM node:22-bookworm-slim AS app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build-app /app/node_modules ./node_modules
COPY --from=build-app /app/package.json ./package.json
COPY --from=build-app /app/apps/app ./apps/app
COPY --from=build-app /app/packages ./packages
WORKDIR /app/apps/app
EXPOSE 3000
CMD ["node", "./node_modules/next/dist/bin/next", "start"]

FROM base AS agent
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build-agent /app/node_modules ./node_modules
COPY --from=build-agent /app/package.json ./package.json
COPY --from=build-agent /app/apps/agent ./apps/agent
COPY --from=build-agent /app/packages ./packages
WORKDIR /app/apps/agent
ENV AGENT_PORT=2000
EXPOSE 2000
CMD ["bun", "run", "start"]

FROM build-common AS build-migrate

FROM base AS migrate
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build-migrate /app/node_modules ./node_modules
COPY --from=build-migrate /app/package.json ./package.json
COPY --from=build-migrate /app/apps ./apps
COPY --from=build-migrate /app/packages ./packages
COPY --from=build-migrate /app/turbo.json ./turbo.json
CMD ["bun", "run", "db:deploy"]
