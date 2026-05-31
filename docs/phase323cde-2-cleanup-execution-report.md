# Phase323CDE-2 Cleanup Execution Report

## 1. 本轮合并执行范围

- Phase323C-2：scripts 可见入口治理
- Phase323D-2：增强 `apiClient` 能力，但不接入生产 UI
- Phase323E-2：增强 `routeRegistry` 匹配能力，但不接入 `httpServer.js`

## 2. Phase323C-2 完成情况

- 新增 governance 工具：
  - `tools/phase323c/build-phase323c-script-governance.mjs`
- 生成治理与入口文档：
  - `docs/phase323c-script-governance-policy.md`
  - `docs/phase323c-recommended-command-index.md`
  - `docs/phase323c-archive-candidate-scripts.json`
- 未删除 package scripts
- 未删除或移动 entrypoints
- 未改变核心验证命令语义

## 3. Phase323D-2 完成情况

- 增强了 `apps/ai-gateway-service/src/ui/workbench/apiClient.js`
- 新增能力：
  - `getDiagnosticsStatus()`
  - `getProviderConfigStatus()`
  - `saveProviderConfig()`
  - `testProviderConfig()`
  - `selectFileContext()`
  - `listApprovals()`
- 未修改 `consolePage.js`
- 未接入生产 UI
- 未改变 `/ui` 入口
- 未改变 5 个 Workbench 主模块
- 未改变 Chat 请求 body

## 4. Phase323E-2 完成情况

- 增强了 `apps/ai-gateway-service/src/routeRegistry.js`
- 增强了：
  - `apps/ai-gateway-service/src/routes/healthRoutes.js`
  - `apps/ai-gateway-service/src/routes/uiRoutes.js`
- 新增 `match()` / `list()` 能力
- 仍未接入 `httpServer.js`
- 未迁移 `/chat-gateway/execute`
- 未改变任何现有路径和响应 schema

## 5. 修改文件清单

- `tools/phase323c/build-phase323c-script-governance.mjs`
- `docs/phase323c-script-governance-policy.md`
- `docs/phase323c-recommended-command-index.md`
- `docs/phase323c-archive-candidate-scripts.json`
- `apps/ai-gateway-service/src/ui/workbench/apiClient.js`
- `apps/ai-gateway-service/src/routes/healthRoutes.js`
- `apps/ai-gateway-service/src/routes/uiRoutes.js`
- `apps/ai-gateway-service/src/routeRegistry.js`
- `docs/phase323cde-2-cleanup-execution-report.md`

## 6. 是否修改 `consolePage.js`

- 否

## 7. 是否修改 `httpServer.js`

- 否

## 8. 是否影响 `/chat-gateway/execute`

- 否

## 9. 是否影响 5 个 Workbench 主模块

- 否

## 10. 是否新增外部 API 调用

- 否

## 11. 是否读取或输出 secret

- 否

## 12. package scripts 是否删除

- 否

## 13. entrypoints 是否删除或移动

- 否

## 14. 验证命令与结果

- `cmd /c pnpm run health:phase12a`
- `cmd /c pnpm run doctor:phase13a`
- `cmd /c pnpm run verify:phase321a-workbench-product-recovery`
- `cmd /c pnpm run verify:phase313a-model-usability-matrix`
- `cmd /c pnpm run verify:phase107a-secret-safety`
- `cmd /c pnpm -r --if-present check`
- `cmd /c node tools\\phase323c\\build-phase323c-inventory.mjs`
- `cmd /c node tools\\phase323c\\build-phase323c-script-governance.mjs`

## 15. 风险与回滚说明

- 本轮未接入 `consolePage.js`，因此没有把 UI 骨架改动带入生产页面。
- 本轮未接入 `httpServer.js`，因此没有把 route registry 改动带入生产路径。
- 如需回滚，本轮主要是删除新增治理文档和撤回骨架增强，不涉及主链回退。

## 16. 是否建议封板 Phase323CDE-2

- 建议：是
- 原因：已完成 scripts 治理层与低风险接入预备增强，且未触碰 Phase322A 主链

## 17. 下一阶段建议

- Phase323CDE-3：继续 scripts 可见入口瘦身，并开始 package scripts alias 收敛
- 如优先前端：
  - 继续 Phase323D-3，先接入 diagnostics 的 `apiClient`
- 如优先路由：
  - 继续 Phase323E-3，优先把 `/health/check` 或 `/ui` 做真实 routeRegistry 接入，但仍不动 `/chat-gateway/execute`
