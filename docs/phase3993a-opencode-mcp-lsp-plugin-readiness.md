# Phase3993A OpenCode MCP/LSP/Plugin Readiness

## 阶段目标

修复并验证当前项目的 OpenCode MCP、LSP、插件基础能力，使它们不再依赖人工猜测：

1. `opencode.json` 和 `opencode.jsonc` 必须无 UTF-8 BOM。
2. `opencode.json` 必须严格 JSON 可解析，并与 `opencode.jsonc` 的 MCP/LSP/plugin/agent/command/formatter 关键段保持一致。
3. 本地 MCP 命令必须存在，且 filesystem MCP 只指向本项目根目录。
4. 远程 MCP 只做 HTTPS 配置校验，本阶段不发起认证、不读取 token。
5. LSP 必须开启，并提供 `tools/phase3993a/start-opencode-with-lsp.cmd`，用于以 `OPENCODE_EXPERIMENTAL_LSP_TOOL=true` 启动 OpenCode Desktop。
6. 插件包和本地插件必须可导入，且插件配置不读取 secret、不调用 provider。

## 前置条件

- 项目根目录：`E:\AI-Data\AI网关系统\unified-ai-system`
- OpenCode Desktop 路径：`C:\Users\Administrator\AppData\Local\Programs\OpenCode\OpenCode.exe`
- 本阶段只做本地配置和 readiness 校验。

## 禁止事项

- 不修改 `legacy/`
- 不创建 `PROJECT_CONTEXT.md`
- 不读取或打印 `.env` / API Key / secret / token
- 不调用 MiMo / OpenAI / Claude / OpenRouter
- 不调用 paid API
- 不做 embedding 批量训练
- 不改默认 `/chat`，即 default /chat behavior unchanged
- 不 commit / push / deploy / release
- 不声称 workspace clean

## HTTP route

新增只读 route：

- `GET /opencode/tooling-readiness`

该 route 只读取 OpenCode 配置、检查本地命令和插件模块可导入状态，返回 `providerCalled=false`，不会触发真实 provider 调用。

## UI 变化

Workbench 隐藏兼容标记新增 `/opencode/tooling-readiness`，用于后续 UI/route smoke 检查。当前阶段不新增可执行按钮，避免把 OpenCode 工具启动伪装成 Workbench 内部自动能力。

## Evidence

阶段证据由 verifier 自动写入：

- `apps/ai-gateway-service/evidence/phase3993a-opencode-mcp-lsp-plugin-readiness/latest-readiness.json`
- `apps/ai-gateway-service/evidence/phase3993a-opencode-mcp-lsp-plugin-readiness/latest-readiness.md`

## Package scripts

- `smoke:phase3993a-opencode-mcp-lsp-plugin-readiness`
- `verify:phase3993a-opencode-mcp-lsp-plugin-readiness`

## 验证命令

```bash
node --check apps/ai-gateway-service/src/entrypoints/opencodeToolingReadinessCore.js
node --check apps/ai-gateway-service/src/entrypoints/runPhase3993AOpenCodeToolingReadiness.js
node --check apps/ai-gateway-service/src/entrypoints/verifyPhase3993AOpenCodeToolingReadiness.js
node --check apps/ai-gateway-service/src/http/httpServer.js
node --check apps/ai-gateway-service/src/ui/consolePage.js
node --test apps/ai-gateway-service/src/entrypoints/opencodeToolingReadinessCore.test.js
cmd /c pnpm run smoke:phase3993a-opencode-mcp-lsp-plugin-readiness
cmd /c pnpm run verify:phase3993a-opencode-mcp-lsp-plugin-readiness
```

## Sealed 判定

只有当 fresh readiness report 为 `passed`，且 docs/evidence/scripts/route/UI marker 全部存在时，Phase3993A 才可判定 sealed/pass。

## Blocker 判定

以下任一情况必须 blocker：

- `opencode.json` 或 `opencode.jsonc` 带 BOM
- `opencode.json` 与 `opencode.jsonc` 关键段不同步
- 本地 MCP 命令缺失
- LSP launcher 缺失
- formatter 缺少 `$FILE`
- configured plugin 或 local plugin 不可导入
- verifier 无法写入 evidence
