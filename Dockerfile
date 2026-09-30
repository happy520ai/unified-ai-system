# syntax=docker/dockerfile:1

# Digest-pinned base image keeps builds reproducible; bump deliberately.
# T-164 round 180: the previous pin (a17d50af…) had drifted a week behind its own tag
# `node:22-bookworm-slim`, which now points at 43ac6c60… (last_updated 2026-09-23). Measured, not
# assumed: the Debian tracker lists CVE-2026-86145 / -89157 / -89161 as resolved in bookworm with
# fixed_version 10.42-1+deb12u1 (bookworm-security), while this pin shipped libpcre2-8-0 10.42-1
# from the base repo — those three HIGH findings were a missing security update, not an unfixed
# upstream. Refreshing the pin is what picks the update up.
FROM node:22-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c AS runtime

WORKDIR /app

ENV NODE_ENV=production

LABEL org.opencontainers.image.source="https://github.com/happy520ai/unified-ai-system"
LABEL org.opencontainers.image.licenses="Apache-2.0"

# 直接安装 pnpm（不经 corepack）：qemu 跨架构构建下 corepack 的 tarball
# 下载会确定性失败（exit 255），npm 的网络栈不受影响；同时运行时也
# 不再有 corepack 下载横幅污染 stdout。
#
# T-164 round 180: pnpm is installed BY the image's bundled npm, so that npm's dependency tree is on
# the real build path -- which is why Trivy's `library` findings were not decorative. Measured against
# the registry rather than guessed: npm 10.9.9 already ships tar ^7.5.22 (clearing the one CRITICAL,
# CVE-2026-59873) but still pacote ^19.0.1, and CVE-2026-9496 is fixed only at pacote 21.5.1. 11.21.0
# is the smallest line that clears both (tar ^7.5.22, pacote ^21.5.1) and its engines range
# (^20.17.0 || >=22.9.0) covers the 22.23.x this base image ships. Pinned exactly, never @latest: a
# floating version would make the image non-reproducible, which is the property the digest pin above
# exists to keep.
RUN npm install -g npm@11.21.0
RUN npm install -g pnpm@11.19.0

# npm has now done the only job it has in this image. pnpm@11.19.0 declares no runtime
# dependencies at all (measured: `dependencies: {}` in its package.json), and neither runtime stage
# below invokes npm -- they run `node` against the built tree. So npm's vendored tree is carried for
# no reason, and it is the last thing Trivy was flagging: with npm 11.21.0 pinned above, brace-expansion
# 5.0.9 and undici 6.28.0 are the only HIGH/CRITICAL findings left, and BOTH npm lines that exist
# (11.21.0 and 12.2.0) bundle exactly those two versions, so no version bump can clear them. Removing
# the tool is the honest fix -- it is not a scanner workaround: the vulnerable code simply is not in
# the shipped artifact any more. If a future stage needs npm, re-add it deliberately.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

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
COPY tools/build-runtime-identity.mjs tools/build-runtime-identity.mjs

# This value is a build declaration, not proof of the source revision.
# The manifest separately fingerprints the source bytes shipped in this image.
# pnpm install artifacts can carry root-only permission bits; the shipped
# source tree must stay readable by the non-root runtime user so in-container
# verification can re-hash it. Read/execute bits only - file bytes unchanged.
RUN chmod -R a+rX apps packages tools package.json pnpm-lock.yaml pnpm-workspace.yaml
ARG UAI_DECLARED_REVISION=""
RUN node tools/build-runtime-identity.mjs --declared-revision "$UAI_DECLARED_REVISION"

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

LABEL org.opencontainers.image.description="Terminal-first, self-hosted AI gateway"

USER node
EXPOSE 3100

# Keep enterprise authentication enabled for a bare `docker run` without
# storing a secret-looking boolean in an ENV layer. An explicit runtime value
# (including `false`) wins, and `exec` preserves Node as the signal-receiving
# process.
CMD ["sh", "-c", "PME_ENTERPRISE_AUTH_ENABLED=${PME_ENTERPRISE_AUTH_ENABLED:-true} exec node apps/ai-gateway-service/src/index.js"]
