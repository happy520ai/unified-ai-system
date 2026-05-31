# Phase323D-9 + Phase323C-9 Execution Report

Generated: 2026-05-06

---

## 1. 本轮合并执行范围

- **Phase323C-9**：Low-risk candidate 人工复核样板批次，从 87 个 low-risk candidate 中选择 20 个生成样板
- **Phase323D-9**：Approvals 风险边界文档，拆分 list/preview/proposal/approve-reject/apply-approved 五层风险
- **Phase323E**：保持冻结，不修改 httpServer.js，不接入 routeRegistry

## 2. Phase323C-9 完成情况

- 新增 `tools/phase323c/build-phase323c-human-review-sample-batch.mjs` 工具
- 工具只读，不删除、不移动、不重命名任何文件
- 输出 `docs/phase323c-9-human-review-sample-batch.json`
- 输出 `docs/phase323c-9-human-review-sample-batch.md`
- 从 87 个 low-risk candidate 中选择 20 个样板
- 没有执行任何候选脚本
- 没有修改 package.json / apps/ai-gateway-service/package.json
- 没有删除 scripts / 移动 entrypoints

## 3. Phase323D-9 完成情况

- 输出 `docs/phase323d-9-approvals-risk-boundary.md`
- 明确拆分 5 层风险：Tier A list / Tier B preview / Tier C proposal / Tier D approve-reject / Tier E apply-approved
- 未修改 consolePage.js / apiClient.js / httpServer.js
- 未接入 approvals 生产 UI
- 未触发 local operation

## 4. Phase323E 是否保持冻结

是。本轮不修改 httpServer.js，不接入 routeRegistry，不迁移任何 route。

## 5. 修改文件清单

| 文件路径 | 修改类型 | 修改目的 |
|---------|---------|---------|
| `tools/phase323c/build-phase323c-human-review-sample-batch.mjs` | 新增 | Phase323C-9 sample batch 生成工具 |
| `docs/phase323c-9-human-review-sample-batch.json` | 新增 | sample batch JSON（20 个 low-risk 样板） |
| `docs/phase323c-9-human-review-sample-batch.md` | 新增 | sample batch Markdown（含操作步骤、回滚方案） |
| `docs/phase323d-9-approvals-risk-boundary.md` | 新增 | approvals 五层风险边界文档 |
| `docs/phase323d9-phase323c9-execution-report.md` | 新增 | 本轮执行报告 |

## 6. 是否修改 package.json

否。

## 7. 是否修改 apps/ai-gateway-service/package.json

否。

## 8. 是否修改 consolePage.js

否。

## 9. 是否修改 apiClient.js

否。

## 10. 是否修改 httpServer.js

否。

## 11. 是否删除 scripts

否。

## 12. 是否移动 entrypoints

否。

## 13. 是否执行候选脚本

否。所有 build-phase323c-*.mjs 工具只做静态分析，不执行候选脚本。

## 14. Low-risk Sample Batch 摘要

- 总 low-risk candidates: 87
- 本次选择: 20
- 选择范围: 只选 Priority 3 low-risk，不选 protected-core / forbidden / unknown / manual-review
- proposedHumanDecision 分布:
  - candidate-for-future-archive: 根据 name 特征分配
  - mark-deprecated-only: 含 legacy/deprecated 的候选
  - keep-historical-compatible: 含 benchmark/demo/example 的候选
- 每个 item 包含: id / name / source / currentCategory / priority / reason / proposedHumanDecision / proposedFutureAction / requiredManualChecks / requiredRegressionCommands / rollbackNotes / riskNotes
- 声明: 本轮不删除 scripts，不移动 entrypoints，不改 package scripts，不执行候选脚本，不做真实归档

## 15. Approvals Risk Boundary 摘要

| Tier | 能力 | 结论 | Bridge 建议 |
|------|------|------|------------|
| A | list approvals | future safe-to-bridge candidate | 可安全接入 |
| B | intent-preview / operation-plan | future bridge candidate with gate | 可接入但需 UI gate |
| C | patch-proposal / create | bridge-later | 暂不接入 |
| D | approve / reject | do-not-bridge-now | 不建议近期接入 |
| E | apply-approved | do-not-bridge-now / forbidden-by-default | 不建议任何近期阶段接入 |

## 16. Approvals 各 Tier 结论

- **Tier A (list):** future safe-to-bridge candidate。只读安全，可在未来独立阶段接入。
- **Tier B (preview):** future bridge candidate with gate。预览安全但需 UI gate 防止意外扩展。
- **Tier C (proposal):** bridge-later。创建审批记录，暂不接入。
- **Tier D (approve/reject):** do-not-bridge-now。改变审批状态，不建议近期接入。
- **Tier E (apply-approved):** do-not-bridge-now / forbidden-by-default。可能写入本地文件，不建议任何近期阶段接入。

## 17. 是否接入 approvals

否。

## 18. 是否接入 approve/reject/apply-approved

否。

## 19. 是否触发 local operation

否。

## 20. 是否影响 /chat-gateway/execute

否。

## 21. 是否影响 5 个 Workbench 主模块

否。

## 22. 是否改变 Chat 请求 body

否。

## 23. 是否存在 Key / secret / path 明文泄露风险

否。本轮只生成文档，不涉及 secret 处理。

## 24. 是否新增外部 API 调用

否。

## 25. 是否读取或输出 secret

否。

## 26. 验证命令与结果

| 命令 | 结果 | 是否通过 |
|------|------|---------|
| `cmd /c pnpm run health:phase12a` | `status: "passed"`, serviceStatus: "ready" | 通过 |
| `cmd /c pnpm run verify:phase321a-workbench-product-recovery` | `status: "pass"`, checksFailed: 0 | 通过 |
| `cmd /c pnpm run verify:phase313a-model-usability-matrix` | `status: "pass"`, smokePassedModels: 2 | 通过 |
| `cmd /c pnpm run verify:phase107a-secret-safety` | `status: "passed"`, conclusion: "secret-safety-ready" | 通过 |
| `cmd /c pnpm -r --if-present check` | 564 files checked, all passed | 通过 |
| `node --check tools\phase323c\build-phase323c-human-review-sample-batch.mjs` | 语法正确 | 通过 |
| `cmd /c node tools\phase323c\build-phase323c-human-review-sample-batch.mjs` | 20 low-risk selected (of 87) | 通过 |
| 9x build-phase323c-*.mjs tools | 全部 pass | 通过 |

## 27. Phase322A 主链验证说明

- 是否执行 verify:phase322a-workbench-chat-gateway-real-nvidia：未执行
- 如未执行，原因：本轮未修改 consolePage.js / apiClient.js / httpServer.js / Chat send，Phase322A 主链验证记录为非强制
- 环境确认：NVIDIA_API_KEY 已配置（Phase322A evidence 显示 hasRuntimeKey=true，providerCalled=true，completionVerified=true）
- 是否确认未输出 secret：是，未读取或输出任何 API Key
- 是否确认没有把 dry-run 当真实成功：是

## 28. Approvals 安全说明

- 是否调用 approvals 接口：否
- 是否创建 approval：否
- 是否 approve / reject：否
- 是否 apply-approved：否
- 是否触发本地文件写入：否
- 是否需要 future gate：是（Tier B/C/D/E 都需要）
- Tier A 可以未来考虑 bridge：是
- Tier B 可以未来考虑 bridge（with gate）：是
- Tier C/D/E 必须 do-not-bridge-now：是

## 29. Human Review Sample 安全说明

- 是否删除 scripts：否
- 是否移动 entrypoints：否
- 是否执行候选脚本：否
- 是否只是人审样板：是
- 是否只包含 low-risk：是（20 个，全部 Priority 3）
- 未来真实处理是否需要另开阶段：是

## 30. 风险与回滚说明

- 本轮未修改任何生产代码
- 未改变任何 HTTP API 的 path/method/body 语义
- 未引入新页面、新功能、新 provider
- 回滚方式：删除本轮新增的 docs 和 tools 文件
- 不涉及 git reset / git clean / force push

## 31. 是否建议封板 Phase323D-9 + Phase323C-9

**是。**

所有 30 项成功标准全部满足：

1. Phase323C-9 sample batch JSON/Markdown 生成成功
2. sample batch 只包含 20 个 low-risk candidate（of 87 total）
3. Phase323D-9 approvals risk boundary 文档生成成功
4. 明确拆分 list/preview/proposal/approve-reject/apply-approved 五层风险
5. 没有删除 package scripts
6. 没有删除或移动 entrypoints
7. 没有执行 archive candidate 脚本
8. 没有覆盖既有核心 scripts
9. 没有修改 package.json
10. 没有修改 apps/ai-gateway-service/package.json
11. 没有修改 consolePage.js
12. 没有修改 apiClient.js
13. 没有修改 httpServer.js
14. 没有修改 legacy/
15. 没有创建 PROJECT_CONTEXT.md
16. 没有 commit/push/deploy/release
17. 没有读取或输出 secret
18. 没有调用非 NVIDIA paid API
19. 没有做 embedding batch training
20. 没有迁移任何 route
21. 没有修改 /chat-gateway/execute
22. 没有改变 Chat 请求 body
23. 没有默认暴露隐藏模块
24. 没有改变 5 个 Workbench 主模块
25. 没有接入 approvals 生产 UI
26. 没有接入 approve/reject/apply-approved
27. 没有触发 local operation
28. product recovery 验证通过
29. secret safety 验证通过
30. 本轮执行报告已生成

## 32. 下一阶段建议

1. **Phase323D-10**：只考虑 Tier A list-only bridge（`GET /approvals`）。不得接 approve/reject/apply-approved。
2. **Phase323C-10**：对 20 个样板做人工结论记录，但仍不删除、不移动、不改 scripts。
3. **Phase323E-3**：单独做 `/health/check` routeRegistry 生产接入第一刀，不与 UI / approvals / Chat send 混合。
4. **Chat send apiClient 接入继续延后**：不要和 approvals 或 routeRegistry 混合；只能单独阶段评估。