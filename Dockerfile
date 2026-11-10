# 一个镜像同时跑 API 和打包好的编辑台：后端发现 apps/web/dist 就会一起托管
FROM node:22-slim

# Prisma 的查询引擎依赖 openssl
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

WORKDIR /app

# 先只拷依赖清单，源码改动时不用重新装依赖
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY apps/mcp/package.json apps/mcp/
RUN pnpm install --frozen-lockfile

COPY packages packages
COPY apps apps
RUN pnpm --filter @rcs/shared build \
  && pnpm --filter @rcs/server exec prisma generate \
  && pnpm --filter @rcs/server build \
  && pnpm --filter @rcs/web build

# 转存的配图按相对路径 ./storage 存放，工作目录必须是 apps/server
WORKDIR /app/apps/server
ENV NODE_ENV=production \
    PORT=18472 \
    STORAGE_DIR=/app/apps/server/storage
EXPOSE 18472

# 没有迁移文件，启动前把表结构同步到数据库
CMD ["sh", "-c", "pnpm exec prisma db push --skip-generate && node dist/main.js"]
