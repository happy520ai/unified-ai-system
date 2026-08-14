# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

LABEL org.opencontainers.image.source="https://github.com/happy520ai/unified-ai-system"
LABEL org.opencontainers.image.licenses="Apache-2.0"

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

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

FROM runtime AS mcp

LABEL org.opencontainers.image.description="Credential-free Unified AI System MCP server"
LABEL io.modelcontextprotocol.server.name="io.github.happy520ai/unified-ai-system"

CMD ["node", "packages/mcp-server/src/index.js"]

FROM runtime AS gateway

ENV AI_GATEWAY_SERVICE_HOST=0.0.0.0
ENV AI_GATEWAY_SERVICE_PORT=3100
ENV PME_ENTERPRISE_AUTH_ENABLED=true

LABEL org.opencontainers.image.description="Terminal-first, self-hosted AI gateway"

EXPOSE 3100

CMD ["pnpm", "--filter", "@unified-ai-system/ai-gateway-service", "start"]
