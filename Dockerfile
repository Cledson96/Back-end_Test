FROM node:23-bookworm-slim AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@10.7.0 --activate

WORKDIR /app

COPY server/package.json server/pnpm-lock.yaml ./server/
COPY client/package.json client/pnpm-lock.yaml ./client/

RUN cd server && pnpm install --frozen-lockfile
RUN cd client && pnpm install --frozen-lockfile

COPY shared ./shared
COPY server ./server
COPY client ./client

RUN cd client && pnpm build
RUN cd server && pnpm build
RUN mkdir -p server/dist/public && cp -r client/dist/* server/dist/public/
RUN cd server && pnpm prune --prod

FROM node:23-bookworm-slim AS runtime

ENV NODE_ENV="production"
ENV HOST="0.0.0.0"
ENV PORT="8080"
ENV DATABASE_URL="file:/data/prod.db"
ENV CORS_ORIGIN="https://sqrt.cledson.com.br"
ENV COMMON_RATE_LIMIT_WINDOW_MS="1000"
ENV COMMON_RATE_LIMIT_MAX_REQUESTS="100"

WORKDIR /app/server

COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/package.json ./package.json
COPY --from=build /app/server/prisma ./prisma
COPY --from=build /app/server/scripts ./scripts

RUN mkdir -p /data

EXPOSE 8080

CMD ["sh", "-c", "node scripts/apply-sqlite-migrations.mjs && node dist/index.js"]
