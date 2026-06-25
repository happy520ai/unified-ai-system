# =============================================================================
# Dockerfile — AI Gateway Service 多阶段构建（生产优化）
# =============================================================================

# ── 阶段 1: 依赖安装（缓存层）──
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/ai-gateway-service/package.json apps/ai-gateway-service/
COPY packages/shared-utils/package.json packages/shared-utils/
COPY packages/shared-config/package.json packages/shared-config/
COPY packages/shared-contracts/package.json packages/shared-contracts/
COPY packages/shared-sdk/package.json packages/shared-sdk/

RUN pnpm install --frozen-lockfile --filter @unified-ai-system/ai-gateway-service...

# ── 阶段 2: 构建验证 ──
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/ai-gateway-service/node_modules apps/ai-gateway-service/node_modules
COPY . .

# 语法检查
RUN node --check apps/ai-gateway-service/src/index.js

# ── 阶段 3: 生产运行（最小镜像）──
FROM node:22-alpine AS runner
WORKDIR /app

# 安全：非 root 用户
RUN addgroup -g 1001 -S gateway && \
    adduser -S gateway -u 1001 -G gateway && \
    mkdir -p /app/.data && chown -R gateway:gateway /app/.data

COPY --from=builder --chown=gateway:gateway /app .

USER gateway

ENV NODE_ENV=production
ENV AI_GATEWAY_HOST=0.0.0.0
ENV AI_GATEWAY_PORT=3100
ENV AI_GATEWAY_PROVIDER_MODE=auto
ENV KNOWLEDGE_STORAGE_MODE=local
ENV KNOWLEDGE_INFRA_MODE=local-keyword

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3100/health/check || exit 1

CMD ["node", "apps/ai-gateway-service/src/index.js"]
