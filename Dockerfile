# syntax=docker/dockerfile:1

# Digest-pinned base image keeps builds reproducible; bump deliberately.
FROM node:22-bookworm-slim@sha256:a17d50af28002a160548bd4225b3cfcb12c5efcb171f79e68758f2885fb1b066 AS runtime

WORKDIR /app

ENV NODE_ENV=production

LABEL org.opencontainers.image.source="https://github.com/happy520ai/unified-ai-system"
LABEL org.opencontainers.image.licenses="Apache-2.0"

RUN corepack enable && corepack prepare pnpm@11.19.0 --activate

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
