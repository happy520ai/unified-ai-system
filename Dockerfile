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
COPY packages/forge-core/package.json packages/forge-core/
COPY packages/codex-context-gateway/package.json packages/codex-context-gateway/
COPY packages/context-codec-core/package.json packages/context-codec-core/
COPY packages/taiji-beidou-engine/package.json packages/taiji-beidou-engine/
COPY packages/im-connector-feishu/package.json packages/im-connector-feishu/
COPY packages/im-connector-wecom/package.json packages/im-connector-wecom/
COPY packages/workforce-scheduler/package.json packages/workforce-scheduler/
COPY packages/workforce-contracts/package.json packages/workforce-contracts/
COPY packages/employee-brain-adapter/package.json packages/employee-brain-adapter/
COPY packages/web-agent/package.json packages/web-agent/

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

# 提取前端资源（生产模式使用外部文件）
RUN node apps/ai-gateway-service/src/ui/buildFrontend.js || true

# ── 阶段 3: 生产运行（最小镜像）──
FROM node:22-alpine AS runner
WORKDIR /app

# 安全：非 root 用户
RUN addgroup -g 1001 -S gateway && \
    adduser -S gateway -u 1001 -G gateway && \
    mkdir -p /app/.data && chown -R gateway:gateway /app/.data

# 安全：移除不需要的工具
RUN rm -f /bin/su /usr/bin/wall 2>/dev/null || true

COPY --from=builder --chown=gateway:gateway /app .

USER gateway

# 生产环境变量
ENV NODE_ENV=production
ENV AI_GATEWAY_HOST=0.0.0.0
ENV AI_GATEWAY_PORT=3100
ENV AI_GATEWAY_PROVIDER_MODE=auto
ENV KNOWLEDGE_STORAGE_MODE=local
ENV KNOWLEDGE_INFRA_MODE=local-keyword
# 安全：生产环境强制认证（覆盖为 true 时启用）
# ENV PME_ENTERPRISE_AUTH_ENABLED=true
# ENV AUTH_TOKEN_SECRET=<set-in-compose>

EXPOSE 3100

# 启动探针：10s 内完成初始化
# 存活探针：30s 间隔，5s 超时
# 就绪探针：使用 /health/ready 检查依赖
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3100/health/live || exit 1

CMD ["node", "apps/ai-gateway-service/src/index.js"]
