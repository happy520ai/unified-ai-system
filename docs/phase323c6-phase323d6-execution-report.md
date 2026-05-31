# Phase323C-6 + Phase323D-6 Execution Report

## 本轮合并执行范围

- Phase323C-6：新增 archive plan / deprecated index 只读生成工具，输出长期归档规划与弃用索引。
- Phase323D-6：完成 approvals / fileContext bridge suitability review，仅做评估，不接入生产 UI。
- Phase323E：继续冻结，未接入 routeRegistry，未修改 `httpServer.js`。

## 完成情况

### Phase323C-6

- 已新增只读工具：
  - [build-phase323c-archive-plan.mjs](/E:/AI-Data/AI网关系统/unified-ai-system/tools/phase323c/build-phase323c-archive-plan.mjs)
  - [build-phase323c-deprecated-index.mjs](/E:/AI-Data/AI网关系统/unified-ai-system/tools/phase323c/build-phase323c-deprecated-index.mjs)
- 已生成：
  - [phase323c-6-archive-plan.md](/E:/AI-Data/AI网关系统/unified-ai-system/docs/phase323c-6-archive-plan.md)
  - [phase323c-6-deprecated-index.json](/E:/AI-Data/AI网关系统/unified-ai-system/docs/phase323c-6-deprecated-index.json)
  - [phase323c-6-deprecated-index.md](/E:/AI-Data/AI网关系统/unified-ai-system/docs/phase323c-6-deprecated-index.md)
- 全程静态分析，未执行任何 archive candidate 脚本。

### Phase323D-6

- 已生成：
  - [phase323d-6-bridge-suitability-review.md](/E:/AI-Data/AI网关系统/unified-ai-system/docs/phase323d-6-bridge-suitability-review.md)
- 结论：
  - approvals：`bridge-later`
  - fileContext：`safe-to-bridge`
- 未修改 `consolePage.js`，未接入任何新页面。
- 未修改 `apiClient.js`，因为本轮评估所需方法已具备，继续保持最小变化。

### Phase323E

- 保持冻结。
- 未修改 `httpServer.js`。
- 未迁移任何 route。

## 修改文件清单

- 新增 [build-phase323c-archive-plan.mjs](/E:/AI-Data/AI网关系统/unified-ai-system/tools/phase323c/build-phase323c-archive-plan.mjs)：生成 Phase323C-6 archive plan。
- 新增 [build-phase323c-deprecated-index.mjs](/E:/AI-Data/AI网关系统/unified-ai-system/tools/phase323c/build-phase323c-deprecated-index.mjs)：生成 Phase323C-6 deprecated index JSON / Markdown。
- 新增 [phase323c-6-archive-plan.md](/E:/AI-Data/AI网关系统/unified-ai-system/docs/phase323c-6-archive-plan.md)：沉淀未来归档流程和门槛。
- 新增 [phase323c-6-deprecated-index.json](/E:/AI-Data/AI网关系统/unified-ai-system/docs/phase323c-6-deprecated-index.json)：沉淀只读弃用索引。
- 新增 [phase323c-6-deprecated-index.md](/E:/AI-Data/AI网关系统/unified-ai-system/docs/phase323c-6-deprecated-index.md)：提供可读摘要。
- 新增 [phase323d-6-bridge-suitability-review.md](/E:/AI-Data/AI网关系统/unified-ai-system/docs/phase323d-6-bridge-suitability-review.md)：记录 approvals / fileContext bridge 适配性结论。
- 新增 [phase323c6-phase323d6-execution-report.md](/E:/AI-Data/AI网关系统/unified-ai-system/docs/phase323c6-phase323d6-execution-report.md)：汇总本轮执行结果。

## 关键边界结论

- 未修改 `package.json`。
- 未修改 `apps/ai-gateway-service/package.json`。
- 未修改 `consolePage.js`。
- 未修改 `apiClient.js`。
- 未修改 `httpServer.js`。
- 未删除 scripts。
- 未移动 entrypoints。
- 未执行候选脚本。
- 未影响 `/chat-gateway/execute`。
- 未影响 5 个 Workbench 主模块。
- 未改变 Chat 请求 body。
- 未引入任何外部 paid API 调用。
- 未读取或输出 `.env` / API Key / secret。

## Archive Plan 摘要

- 建立了从 Stage A 到 Stage G 的长期归档流程建议。
- 明确规定 forbidden-dangerous 类入口只能保留为历史资产和只读索引，不能加入推荐命令集。
- 明确 archive 候选进入下一阶段前，必须通过“非 protected-core、非主链、非 5 模块影响、非 secret safety 影响、至少一轮人工复核”门槛。

## Deprecated Index 摘要

- `protectedCore`: 25
- `historicalCompatible`: 253
- `archiveCandidateLowRisk`: 87
- `archiveCandidateNeedsManualReview`: 257
- `forbiddenDangerous`: 106
- `unknownReviewRequired`: 481
- `futureAction` 仅使用：
  - `keep`
  - `deprecate-index-only`
  - `manual-review`
  - `forbidden-do-not-run`
  - `unknown-review-required`

## Bridge Suitability 摘要

- approvals：
  - 当前页面直接串联 create / approve / reject / apply。
  - 整体不适合按 diagnostics/providerConfig 的低风险 bridge 模式直接搬运。
  - 结论：`bridge-later`
- fileContext：
  - 当前只做受限文件元数据登记，服务端明确 `providerCalled=false`、`secretContentStored=false`。
  - 已有 `selectFileContext(body)` 客户端方法。
  - 结论：`safe-to-bridge`

## 风险与回滚说明

- 本轮未修改生产 UI 和主链代码，因此没有新增运行时回滚动作。
- 生成工具最初并行执行时出现过时序性读文件失败，已通过顺序执行修正；这是工具运行顺序问题，不影响业务主链。
- 保持既有 dirty 状态，未清理。

## 是否建议封板

- 建议：是
- 原因：
  - 本轮目标是只读规划与可行性评估，已按边界完成。
  - 未触碰 `consolePage.js`、`httpServer.js`、`/chat-gateway/execute`。
  - archive plan / deprecated index / suitability review 已生成，且回归验证通过。
