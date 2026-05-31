# Phase323CDE-1 Cleanup Execution Report

## 1. 本轮合并执行范围

- Phase323C-1：执行
- Phase323D-1：仅新增低风险 UI 模块骨架，不接入生产 UI
- Phase323E-1：仅新增低风险 route registry / route module 骨架，不接入生产主链

## 2. Phase323C-1 完成情况

- 新增只读 inventory 构建脚本
- 生成 scripts / entrypoints 分层 JSON 清单
- 生成 Markdown 清单
- 未删除 scripts
- 未移动 entrypoints

## 3. Phase323D-1 完成情况

- 新增 `ui/workbench/` 模块骨架
- 提供 `apiClient` / `renderUtils` / `stateStore`
- 未接入 `consolePage.js`
- 未改变 `/ui` 入口
- 未改变 5 模块结构
- 未改变 Chat 请求体

## 4. Phase323E-1 完成情况

- 新增 `routes/` 目录与 `routeRegistry.js`
- 新增 `healthRoutes.js` / `uiRoutes.js`
- 仅提供拆分骨架
- 未接入 `httpServer.js`
- 未迁移 `/chat-gateway/execute`
- 未改变任何路由路径和 schema

## 5. 修改文件清单

- `tools/phase323c/build-phase323c-inventory.mjs`
- `docs/phase323c-script-entrypoint-inventory.json`
- `docs/phase323c-script-entrypoint-inventory.md`
- `apps/ai-gateway-service/src/ui/workbench/README.md`
- `apps/ai-gateway-service/src/ui/workbench/apiClient.js`
- `apps/ai-gateway-service/src/ui/workbench/renderUtils.js`
- `apps/ai-gateway-service/src/ui/workbench/stateStore.js`
- `apps/ai-gateway-service/src/routes/README.md`
- `apps/ai-gateway-service/src/routes/healthRoutes.js`
- `apps/ai-gateway-service/src/routes/uiRoutes.js`
- `apps/ai-gateway-service/src/routeRegistry.js`
- `docs/phase323cde-1-cleanup-execution-report.md`

## 6. 未修改的禁止区域

- `legacy/`
- `PROJECT_CONTEXT.md`
- `README.md`
- `AGENTS.md`
- 既有 `evidence/`
- `/chat-gateway/execute`
- NVIDIA key / redact / runtime credential store
- approval protection chain

## 7. 是否影响 `/chat-gateway/execute`

- 否

## 8. 是否影响 5 个 Workbench 主模块

- 否

## 9. 是否新增外部 API 调用

- 否

## 10. 是否读取或输出 secret

- 否

## 11. 验证命令与结果

- `cmd /c pnpm run health:phase12a`
- `cmd /c pnpm run doctor:phase13a`
- `cmd /c pnpm run verify:phase321a-workbench-product-recovery`
- `cmd /c pnpm run verify:phase313a-model-usability-matrix`
- `cmd /c pnpm run verify:phase107a-secret-safety`
- `cmd /c pnpm -r --if-present check`
- `cmd /c node tools\\phase323c\\build-phase323c-inventory.mjs`
- 如果本轮未接入 `/ui` 或 `httpServer.js`，则不强制增加 322A verifier 作为门槛

## 12. 风险与回滚说明

- 本轮 D/E 只新增骨架，不接入生产路径，回滚成本低。
- C 仅做只读 inventory 生成，不触发业务副作用。
- 若后续 Phase323D-2 / E-2 要接入生产路径，必须重新跑主链回归。

## 13. 是否建议封板 Phase323CDE-1

- 建议：是
- 原因：已完成 inventory 与低风险骨架搭建，且未触碰主链

## 14. 下一阶段建议

- Phase323CDE-2：基于 inventory 开始 package scripts 分层瘦身，不删除 entrypoints，只收敛可见脚本入口
- Phase323D-2：继续拆分 providerConfig / diagnostics 页面模块
- Phase323E-2：继续迁移 diagnosticsRoutes / providerConfigRoutes，但仍不动 `/chat-gateway/execute`
