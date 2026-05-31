# Phase323D-4 ProviderConfig apiClient 集成报告

## 范围

- 本轮仅处理 ProviderConfig 页面相关请求语义对齐。
- 未接入 Chat send。
- 未接入 diagnostics、approvals、fileContext 页面新的生产 bridge。
- 未修改 `httpServer.js`。
- 未修改 `/chat-gateway/execute`。

## 接入方式

- 采用方案 A：内联等价 bridge。
- 原因：`/ui` 仍是 inline HTML + inline script，本轮继续优先保证运行时稳定，不强行引入 ESM 模块加载。
- 做法：在 [apps/ai-gateway-service/src/ui/consolePage.js](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/src/ui/consolePage.js) 的现有 `workbenchApiClient` bridge 上补充：
  - `getProviderConfigStatus()`
  - `saveProviderConfig(payload)`
  - `testProviderConfig(payload)`
- `loadProviderStatus()`、`saveProviderConfig()`、`testProviderConfig()` 改为调用上述 bridge。

## 保持不变的事项

- `/ui` 入口保持不变。
- 5 个 Workbench 主模块保持不变。
- Chat send 逻辑保持不变。
- Chat 请求 body 未修改。
- `selectedModel` localStorage 行为未修改。
- providerConfig 的字段语义未修改。
- providerConfig 的路径、method、body 语义未修改。
- API Key 不回显明文。
- 当前产品口径仍为 NVIDIA-only。
- 未新增任何非 NVIDIA provider 真实调用。

## ProviderConfig 安全说明

- `status` 页面只展示配置状态与测试摘要，不展示 Key 明文。
- `save` 仍在保存后清空输入框，不回显明文 Key。
- `test` 仍走原有真实测试路径，不把 dry-run 包装成真实测试成功。
- 本轮未读取 `.env`，未修改 key redact / runtime credential 安全逻辑。

## 验证结果

- `node --check apps/ai-gateway-service/src/ui/consolePage.js`：通过
- `cmd /c pnpm run verify:phase321a-workbench-product-recovery`：通过
- `cmd /c pnpm run verify:phase322a-workbench-chat-gateway-real-nvidia`：通过
- `cmd /c pnpm run verify:phase107a-secret-safety`：通过

## 风险说明

- 当前仍不是原生 ESM import，而是先完成 ProviderConfig 请求层语义对齐。
- 这样可以在不碰 Chat send 的前提下，为后续 UI 重复逻辑收敛建立稳定模式。
