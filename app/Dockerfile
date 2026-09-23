FROM node:20-bookworm-slim AS dependencies

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.17.1 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .
ARG VITE_KIMI_AUTH_URL=https://auth.kimi.com
ARG VITE_APP_ID=tdg-cloud
ENV VITE_KIMI_AUTH_URL=$VITE_KIMI_AUTH_URL
ENV VITE_APP_ID=$VITE_APP_ID
RUN pnpm build

FROM node:20-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
# 保留 schema 与 drizzle 配置，便于在同一镜像中执行一次性迁移命令；
# 服务启动本身不会自动改库。
COPY --from=build /app/db ./db
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts

EXPOSE 8080
CMD ["node", "dist/boot.js"]
