# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV AI_GATEWAY_SERVICE_HOST=0.0.0.0
ENV AI_GATEWAY_SERVICE_PORT=3100

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ai-gateway-service/package.json apps/ai-gateway-service/package.json
COPY apps/agent-console/package.json apps/agent-console/package.json
COPY packages packages

RUN pnpm install --frozen-lockfile --filter @unified-ai-system/ai-gateway-service...

COPY apps/ai-gateway-service apps/ai-gateway-service

EXPOSE 3100

CMD ["pnpm", "--filter", "@unified-ai-system/ai-gateway-service", "start"]
