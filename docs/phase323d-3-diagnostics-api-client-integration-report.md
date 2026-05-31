# Phase323D-3 Diagnostics apiClient 集成报告

## 范围

- 本轮仅处理 Diagnostics 页面相关请求语义对齐。
- 未接入 Chat send。
- 未接入 providerConfig、approvals、fileContext 页面生产 fetch。
- 未修改 `httpServer.js`。
- 未修改 `/chat-gateway/execute`。

## 接入方式

- 采用方案 A：内联等价桥接。
- 原因：`/ui` 当前仍是 inline HTML + inline script，直接引入 ESM `apiClient.js` 会增加运行时加载风险，不符合本轮“只允许一个生产接入变量”的边界。
- 做法：在 [apps/ai-gateway-service/src/ui/consolePage.js](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/src/ui/consolePage.js) 内新增 `createWorkbenchApiBridge()`，只暴露 `getDiagnosticsStatus()`。
- `loadDiagnostics()` 从直接调用 `requestJson("/workbench/diagnostics/status")` 改为调用 `workbenchApiClient.getDiagnosticsStatus()`。

## 保持不变的事项

- `/ui` 入口保持不变。
- 5 个 Workbench 主模块保持不变。
- Chat send 仍走原有逻辑。
- Chat 请求 body 未修改。
- `selectedModel` localStorage 行为未修改。
- Diagnostics 页面原有 render、loading、错误处理语义保持不变。
- 未新增隐藏模块入口。
- 未引入 React / Vue / Angular。
- 未引入构建链。

## 代码改动摘要

- [apps/ai-gateway-service/src/ui/consolePage.js](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/src/ui/consolePage.js)
  - 新增 `createWorkbenchApiBridge()`
  - 新增 `workbenchApiClient`
  - `loadDiagnostics()` 改为通过 bridge 获取 diagnostics 数据

## 验证结果

- `node --check apps/ai-gateway-service/src/ui/consolePage.js`：通过
- `cmd /c pnpm run verify:phase321a-workbench-product-recovery`：通过
- `cmd /c pnpm run verify:phase322a-workbench-chat-gateway-real-nvidia`：通过

## 风险说明

- 当前不是原生 ESM 直连 `apiClient.js`，而是先完成函数签名与调用边界对齐。
- 这一步的目标是为后续 `providerConfig` 页面同类接入建立低风险模式，而不是在本轮强行模块化整个 `/ui`。
