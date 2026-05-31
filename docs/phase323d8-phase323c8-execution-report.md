# Phase323D-8 + Phase323C-8 Execution Report

Generated: 2026-05-06

---

## 1. 本轮合并执行范围

- **Phase323C-8**：Human review workflow 模板化
- **Phase323D-8**：Workbench bridge 稳定化
- **Phase323E**：保持冻结，不修改 httpServer.js，不接入 routeRegistry，不迁移任何 route

## 2. Phase323C-8 完成情况

- 新增 `tools/phase323c/build-phase323c-human-review-workflow.mjs` 工具
- 工具只读，不删除、不移动、不重命名任何文件
- 输出 `docs/phase323c-8-human-review-workflow-template.json`
- 输出 `docs/phase323c-8-human-review-workflow-template.md`
- 没有执行任何候选脚本
- 没有修改 package.json
- 没有修改 apps/ai-gateway-service/package.json
- 没有删除 scripts
- 没有删除或移动 entrypoints

## 3. Phase323D-8 完成情况

- 生成 `docs/phase323d-8-workbench-bridge-stability-report.md`
- 更新 `apps/ai-gateway-service/src/ui/workbench/README.md` 补充 bridge stability 边界
- 更新 `apps/ai-gateway-service/src/ui/workbench/apiClient.js` 注释整理
- 未修改 consolePage.js（逻辑不变，仅 apiClient 注释）
- 未接入新页面
- 未接入 Chat send
- 未接入 approvals / apply-approved
- diagnostics / providerConfig / fileContext 三个 bridge 行为保持不变

## 4. Phase323E 是否保持冻结

是。本轮不修改 httpServer.js，不接入 routeRegistry，不迁移任何 route，不迁移 /chat-gateway/execute。

## 5. 修改文件清单

| 文件路径 | 修改类型 | 修改目的 |
|---------|---------|---------|
| `tools/phase323c/build-phase323c-human-review-workflow.mjs` | 新增 | Phase323C-8 human review workflow 生成工具 |
| `docs/phase323c-8-human-review-workflow-template.json` | 新增 | human review workflow JSON 模板 |
| `docs/phase323c-8-human-review-workflow-template.md` | 新增 | human review workflow Markdown 模板 |
| `docs/phase323d-8-workbench-bridge-stability-report.md` | 新增 | bridge stability 边界报告 |
| `apps/ai-gateway-service/src/ui/workbench/README.md` | 修改 | 补充 bridge stability 边界说明 |
| `apps/ai-gateway-service/src/ui/workbench/apiClient.js` | 修改 | 仅注释整理，不改变方法语义 |

## 6. 是否修改 package.json

否。

## 7. 是否修改 apps/ai-gateway-service/package.json

否。

## 8. 是否修改 consolePage.js

否。本轮 consolePage.js 未修改。

## 9. 是否修改 apiClient.js

是。仅修改注释和方法分组，不改变方法行为，不新增 Chat send 或 approvals 方法。

## 10. 是否修改 httpServer.js

否。

## 11. 是否删除 scripts

否。

## 12. 是否移动 entrypoints

否。

## 13. 是否执行候选脚本

否。所有 build-phase323c-*.mjs 工具只做静态分析，不执行候选脚本。

## 14. Human Review Workflow 摘要

- 新增 `build-phase323c-human-review-workflow.mjs` 工具，只读，不执行候选脚本
- 输出 JSON 和 Markdown 模板
- 包含 batch review 模板（maxItemsPerBatch=20，每批必须包含 batchId/sourceCategory/reviewer/reviewDate/candidateItems/decisionSummary/requiredRegressionCommands/rollbackPlan）
- 包含单项人工复核字段（id/name/source/category/priority/currentCommand/humanDecision/riskLevel/futureAction/requiredEvidence/notes）
- humanDecision 只允许 6 种：keep / keep-historical-compatible / mark-deprecated-only / candidate-for-future-archive / forbidden-do-not-run / needs-more-context
- futureAction 只允许 6 种：no-op / document-only / deprecated-index-only / manual-review-again / future-archive-candidate / forbidden-do-not-run
- 包含 priority rules：P0 forbidden 只能 forbidden-do-not-run；P1 unknown 必须 needs-more-context 或 manual-review-again
- 包含 required regression commands（health + doctor + product recovery + model usability + secret safety + check）
- 包含 rollback plan（git revert，不 reset、不 clean、不 force push）
- 包含 4 个代表性 batch samples（P0/P1/P2/P3）

## 15. Bridge Stability 摘要

三个 bridge 当前状态：

| Bridge | 状态 | 说明 |
|--------|------|------|
| diagnostics | 保持 | `getDiagnosticsStatus()` -> `GET /workbench/diagnostics/status` |
| providerConfig | 保持 | `getProviderConfigStatus()`, `saveProviderConfig()`, `testProviderConfig()` |
| fileContext | 保持 | `selectFileContext()` -> `POST /file-context/select`，仍仅登记/预览 |

## 16. 是否接入新页面

否。

## 17. 是否接入 approvals

否。approvals 继续 bridge-later。

## 18. 是否接入 Chat send

否。Chat send intentionally not migrated。

## 19. 是否影响 /chat-gateway/execute

否。

## 20. 是否影响 5 个 Workbench 主模块

否。5 个模块（快速对话/模型配置/审批任务/添加文件/诊断中心）行为不变。

## 21. 是否改变 Chat 请求 body

否。

## 22. 是否存在 Key / secret / path 明文泄露风险

否。providerConfig status 仍只返回 `apiKeyConfigured: true/false`，不回显明文 Key。fileContext 仍有敏感文件名/路径遮罩。

## 23. 是否新增外部 API 调用

否。

## 24. 是否读取或输出 secret

否。

## 25. 验证命令与结果

| 命令 | 结果 | 是否通过 |
|------|------|---------|
| `cmd /c pnpm run health:phase12a` | `status: "passed"`, serviceStatus: "ready" | 通过 |
| `cmd /c pnpm run doctor:phase13a` | running, ownerPid 31756 | 通过 |
| `cmd /c pnpm run verify:phase321a-workbench-product-recovery` | `status: "pass"`, checksFailed: 0 | 通过 |
| `cmd /c pnpm run verify:phase313a-model-usability-matrix` | `status: "pass"`, smokePassedModels: 2, selectableModels: 2 | 通过 |
| `cmd /c pnpm run verify:phase107a-secret-safety` | `status: "passed"`, conclusion: "secret-safety-ready" | 通过 |
| `cmd /c node tools\phase323c\build-phase323c-human-review-workflow.mjs` | JSON + Markdown 生成成功 | 通过 |
| `node --check apps\ai-gateway-service\src\ui\workbench\apiClient.js` | 语法正确 | 通过 |

## 26. Phase322A 主链验证说明

- 是否执行 `verify:phase322a-workbench-chat-gateway-real-nvidia`：**未执行**
- 原因：本轮未修改 consolePage.js、未修改 Chat send 行为、未修改 httpServer.js，因此 Phase322A 主链验证记录为非强制
- 环境确认：NVIDIA_API_KEY 已配置（Phase322A evidence 显示 hasRuntimeKey=true，providerCalled=true，completionVerified=true）
- 是否确认没有把 dry-run 当真实成功：是，所有 dry-run 返回 completionVerified=false，不会伪装成真实 Chat 成功

## 27. Bridge Stability 安全说明

- diagnostics 保持原语义（`GET /workbench/diagnostics/status`，只读）
- providerConfig status/save/test 保持原语义（status 不回显 Key 明文，save 清空输入框，test 可真实测试 NVIDIA 连接）
- fileContext 保持 `/file-context/select` 原语义（仍只登记/预览）
- fileContext 不读取真实文件内容
- 未新增知识库训练入口
- 未新增 approvals/apply-approved 入口
- 未接入 Chat send

## 28. Human Review Workflow 安全说明

- 没有删除 scripts
- 没有移动 entrypoints
- 没有执行候选脚本
- 只是人审流程模板
- forbidden-dangerous 仍 forbidden-do-not-run
- 未来真实归档必须另开独立阶段
- 所有 batch review 包含 requiredRegressionCommands 和 rollbackPlan

## 29. 风险与回滚说明

- 本轮未修改 `httpServer.js`、`/chat-gateway/execute`、`nvidiaUnifiedClient.js` 等核心模块
- 未改变任何 HTTP API 的 path/method/body 语义
- 未引入新页面、新功能、新 provider
- 回滚方式：回退 `apiClient.js` 和 `README.md` 修改，重新执行基线验证
- 不涉及 `git reset`、`git clean`、force push

## 30. 是否建议封板 Phase323D-8 + Phase323C-8

**是。**

所有 33 项成功标准全部满足：

1. Phase323C-8 human review workflow JSON/Markdown 生成成功
2. Phase323D-8 bridge stability report 生成成功
3. 没有删除 package scripts
4. 没有删除或移动 entrypoints
5. 没有执行 archive candidate 脚本
6. 没有覆盖既有核心 scripts
7. 没有修改 package.json
8. 没有修改 apps/ai-gateway-service/package.json
9. 没有修改 legacy/
10. 没有创建 PROJECT_CONTEXT.md
11. 没有 commit/push/deploy/release
12. 没有读取或输出 secret
13. 没有调用非 NVIDIA paid API
14. 没有做 embedding batch training
15. 没有修改 httpServer.js
16. 没有迁移任何 route
17. 没有修改 /chat-gateway/execute
18. 没有改变 Chat 请求 body
19. 没有默认暴露隐藏模块
20. 没有改变 5 个 Workbench 主模块
21. 没有接入新页面
22. 没有接入 approvals
23. 没有接入 apply-approved
24. 没有接入 Chat send
25. diagnostics bridge 保持
26. providerConfig bridge 保持
27. fileContext bridge 保持登记/预览边界
28. fileContext 不读取真实文件内容
29. fileContext 不触发 embedding/paid API
30. product recovery 验证通过
31. secret safety 验证通过
32. consolePage.js 未修改，Phase322A 非强制
33. 本轮执行报告已生成

## 31. 下一阶段建议

1. **Phase323D-9**：继续不接 Chat send；先做 approvals list/preview 与 approve/reject/apply-approved 的风险边界文档。
2. **Phase323C-9**：选择 10-20 个 low-risk candidate 做人工复核样板，但不删除、不移动、不改 scripts。
3. **Phase323E-3**：单独做 `/health/check` routeRegistry 生产接入第一刀，不与 UI 改动混合。
4. **Chat send apiClient 接入继续延后**：至少等 diagnostics / providerConfig / fileContext 三个低风险 bridge 稳定后，再做单独阶段评估，不要和 routeRegistry 或 approvals 混合。