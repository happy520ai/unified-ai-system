# syntax=docker/dockerfile:1

# Digest-pinned base image keeps builds reproducible; bump deliberately.
FROM node:22-bookworm-slim@sha256:a17d50af28002a160548bd4225b3cfcb12c5efcb171f79e68758f2885fb1b066 AS runtime

WORKDIR /app

ENV NODE_ENV=production

LABEL org.opencontainers.image.source="https://github.com/happy520ai/unified-ai-system"
LABEL org.opencontainers.image.licenses="Apache-2.0"

# 直接安装 pnpm（不经 corepack）：qemu 跨架构构建下 corepack 的 tarball
# 下载会确定性失败（exit 255），npm 的网络栈不受影响；同时运行时也
# 不再有 corepack 下载横幅污染 stdout。
RUN npm install -g pnpm@11.19.0

# pnpm 的 verify-deps-before-run 会在项目根（/app，root 属主、node 只读）
# 写 _tmp_* 哈希文件，非 root 运行 `pnpm gateway demo` 时偶发 EACCES。
# 容器内依赖由 --frozen-lockfile 在构建期锁定，运行期无需再校验。
ENV npm_config_verify_deps_before_run=false

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ai-gateway-service/package.json apps/ai-gateway-service/package.json
COPY apps/agent-console/package.json apps/agent-console/package.json
COPY packages packages

RUN pnpm install --frozen-lockfile \
  --filter @unified-ai-system/ai-gateway-service... \
  --filter @unified-ai-system/agent-console... \
  --filter @unified-ai-system/mcp-server...

COPY apps/ai-gateway-service apps/ai-gateway-service
COPY apps/agent-console apps/agent-console
COPY tools/terminal-demo.mjs tools/terminal-demo.mjs
COPY tools/mcp-smoke.mjs tools/mcp-smoke.mjs

# 运行时状态目录（审计日志、请求日志、企业存储）归 node 所有；
# 容器内进程以非 root 运行，缺这一步会在只读 /app 上 EACCES。
RUN mkdir -p .data/audit .data/request-logs .data/enterprise .data/knowledge apps/ai-gateway-service/.data \
  && chown -R node:node .data apps/ai-gateway-service/.data

# pnpm 11 默认开启 verify-deps-before-run，且镜像里没有仓库的 .npmrc。
# 依赖在构建期已由 --frozen-lockfile 锁定，运行期复核只会以非 root 身份
# 触发重装/清库。在镜像内的 .npmrc 显式关闭（pnpm 最权威的配置源）。
RUN printf 'verify-deps-before-run=false\n' > /app/.npmrc

# Runtime state is restricted to explicit node-owned mounts. The application
# root remains root-owned so deployments can enforce a read-only rootfs.
VOLUME ["/app/.data", "/app/apps/ai-gateway-service/.data"]

FROM runtime AS mcp

LABEL org.opencontainers.image.description="Credential-free Unified AI System MCP server"
LABEL io.modelcontextprotocol.server.name="io.github.happy520ai/unified-ai-system"

USER node
CMD ["node", "packages/mcp-server/src/index.js"]

FROM runtime AS gateway

ENV AI_GATEWAY_SERVICE_HOST=0.0.0.0
ENV AI_GATEWAY_SERVICE_PORT=3100
ENV PME_ENTERPRISE_AUTH_ENABLED=true

LABEL org.opencontainers.image.description="Terminal-first, self-hosted AI gateway"

USER node
EXPOSE 3100

CMD ["node", "apps/ai-gateway-service/src/index.js"]
