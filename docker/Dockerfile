FROM oven/bun:1.3.12 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock turbo.json ./
COPY apps ./apps
COPY packages ./packages
RUN bun install --frozen-lockfile

FROM deps AS build
ARG API_URL=http://localhost:3001
ENV API_URL=${API_URL}
ENV NODE_ENV=production
COPY . .
RUN bun run --filter=@crm/db db:generate
RUN bunx turbo run build --filter=api --filter=app --filter=agent

FROM base AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/packages ./packages
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["bun", "run", "start:prod"]

FROM base AS app
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/app ./apps/app
COPY --from=build /app/packages ./packages
WORKDIR /app/apps/app
EXPOSE 3000
CMD ["bun", "run", "start"]

FROM base AS agent
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/agent ./apps/agent
COPY --from=build /app/packages ./packages
WORKDIR /app/apps/agent
ENV AGENT_PORT=2000
EXPOSE 2000
CMD ["bun", "run", "start"]

FROM base AS migrate
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps ./apps
COPY --from=build /app/packages ./packages
COPY --from=build /app/turbo.json ./turbo.json
CMD ["bun", "run", "db:deploy"]
