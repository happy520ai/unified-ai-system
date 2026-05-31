# Phase323D-5 Bridge Consolidation Report

## 范围

- 本轮只整理已存在的 diagnostics + providerConfig bridge。
- 不接入新页面。
- 不接入 Chat send。
- 不修改 `/chat-gateway/execute`。
- 不修改 `httpServer.js`。

## 整理方式

- 在 [apps/ai-gateway-service/src/ui/consolePage.js](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/src/ui/consolePage.js) 的 bridge zone 内补充极短边界注释：
  - Phase323D bridge zone
  - Chat send intentionally not migrated
  - Do not expose hidden modules
- 新增局部 helper：`postJsonViaBridge(path, body)`
- 将 providerConfig 的两个 `POST` bridge：
  - `saveProviderConfig(payload)`
  - `testProviderConfig(payload)`
  统一收敛到 `postJsonViaBridge(...)`

## 保持不变

- diagnostics 行为保持不变
- providerConfig status/save/test 的 path、method、body 语义保持不变
- Chat 请求 body 保持不变
- `selectedModel` localStorage 保持不变
- 5 个 Workbench 主模块保持不变
- `/ui` 入口保持不变
- 未引入前端框架
- 未引入构建链

## 安全说明

- providerConfig 未输出 Key 明文
- 未读取 `.env`
- 未新增任何非 NVIDIA provider 真实调用
- 本轮只是 bridge 结构整理，不是功能扩展

## 验证结果

- `node --check apps/ai-gateway-service/src/ui/consolePage.js`：通过
- `cmd /c pnpm run verify:phase321a-workbench-product-recovery`：通过
- `cmd /c pnpm run verify:phase322a-workbench-chat-gateway-real-nvidia`：通过
- `cmd /c pnpm run verify:phase107a-secret-safety`：通过
