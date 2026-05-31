# Phase323CDE-3 Cleanup Execution Report

## 本轮范围

- Phase323C-3：scripts 可见入口收敛第一刀
- Phase323D-3：Diagnostics apiClient 生产接入第一刀
- Phase323E：保持冻结，不做生产 routeRegistry 接入

## Phase323C-3

### 已完成

- 新增只读工具 [tools/phase323c/print-phase323c-recommended-commands.mjs](/E:/AI-Data/AI网关系统/unified-ai-system/tools/phase323c/print-phase323c-recommended-commands.mjs)
- 在根 [package.json](/E:/AI-Data/AI网关系统/unified-ai-system/package.json) 新增 3 个不覆盖旧语义的 alias：
  - `inventory:phase323c`
  - `governance:phase323c`
  - `commands:phase323c`
- 重新生成 Phase323C inventory / governance 文档，确认 alias 可运行

### 未做

- 未删除任何 package scripts
- 未重命名任何既有 scripts
- 未修改任何既有 `verify:*` 命令语义
- 未删除或移动任何 entrypoints

## Phase323D-3

### 已完成

- 在 [apps/ai-gateway-service/src/ui/consolePage.js](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/src/ui/consolePage.js) 新增 diagnostics 局部 bridge
- 将 diagnostics 状态读取切换为 `workbenchApiClient.getDiagnosticsStatus()`
- 保持 Chat send、providerConfig、approvals、fileContext 页面逻辑不变

### 接入方式

- 方案 A：内联等价桥接
- 未在 `/ui` 运行时直接 import ESM 模块
- 未改变 `/ui` HTML 入口结构

### 明确保留

- `/chat-gateway/execute` 未修改
- Chat 请求 body 未修改
- `selectedModel` localStorage 语义未修改
- 5 个 Workbench 主模块未修改

## Phase323E

- 本轮冻结
- 未修改 `apps/ai-gateway-service/src/http/httpServer.js`
- 未迁移任何 route
- 未接入生产 `routeRegistry`

## 修改文件

- [tools/phase323c/print-phase323c-recommended-commands.mjs](/E:/AI-Data/AI网关系统/unified-ai-system/tools/phase323c/print-phase323c-recommended-commands.mjs)
- [package.json](/E:/AI-Data/AI网关系统/unified-ai-system/package.json)
- [apps/ai-gateway-service/src/ui/consolePage.js](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/src/ui/consolePage.js)
- [docs/phase323d-3-diagnostics-api-client-integration-report.md](/E:/AI-Data/AI网关系统/unified-ai-system/docs/phase323d-3-diagnostics-api-client-integration-report.md)
- [docs/phase323cde-3-cleanup-execution-report.md](/E:/AI-Data/AI网关系统/unified-ai-system/docs/phase323cde-3-cleanup-execution-report.md)

## 禁止区域确认

- 未修改 `legacy/`
- 未创建 `PROJECT_CONTEXT.md`
- 未修改 `httpServer.js`
- 未修改 `/chat-gateway/execute`
- 未修改 NVIDIA provider 主链
- 未修改既有 evidence 文件
- 未修改 `AGENTS.md`
- 未修改 `README.md`

## 验证命令

- `cmd /c node tools\phase323c\build-phase323c-inventory.mjs`
- `cmd /c node tools\phase323c\build-phase323c-script-governance.mjs`
- `cmd /c node tools\phase323c\print-phase323c-recommended-commands.mjs`
- `cmd /c pnpm run inventory:phase323c`
- `cmd /c pnpm run governance:phase323c`
- `cmd /c pnpm run commands:phase323c`
- `node --check tools/phase323c/print-phase323c-recommended-commands.mjs`
- `node --check apps/ai-gateway-service/src/ui/consolePage.js`
- `cmd /c pnpm run health:phase12a`
- `cmd /c pnpm run doctor:phase13a`
- `cmd /c pnpm run verify:phase321a-workbench-product-recovery`
- `cmd /c pnpm run verify:phase313a-model-usability-matrix`
- `cmd /c pnpm run verify:phase107a-secret-safety`
- `cmd /c pnpm -r --if-present check`
- `cmd /c pnpm run verify:phase322a-workbench-chat-gateway-real-nvidia`

## 验证结论

- Phase323C 新增工具与 alias 均可运行
- Product recovery 验证通过
- Phase322A 主链验证通过
- 未发现 diagnostics 接入导致的 Chat 主链回退

## verifier 副作用说明

- 当前 workspace 长期 dirty
- 多个 verifier 会刷新既有 evidence / docs / 工作区状态
- 本轮不把这些既有脏改动声称为本轮主动代码修改

## 风险与回滚

- 风险点主要在 `consolePage.js` 仍为大型单文件 UI
- 本轮通过“局部桥接”而不是“强行 ESM import”降低风险
- 如后续页面接入引发 product recovery 或 Phase322A 回退，应优先回退页面局部桥接，而不是扩大重构范围

## 是否建议封板

- 建议封板 Phase323D-3 + Phase323CDE-3
- 原因：本轮目标均已达成，且未触碰 Chat 主链、路由主链和禁改区域

## 下一阶段建议

- Phase323D-4：接入 providerConfig apiClient，继续沿用低风险局部桥接模式，仍不动 Chat send
- Phase323C-4：继续收敛 service package 推荐入口，但不删除 entrypoints
- Phase323E-3：单独执行 `/health/check` routeRegistry 生产接入，不与 UI 改动混合
