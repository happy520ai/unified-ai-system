# Phase323D-9 Approvals Risk Boundary Document

Generated: 2026-05-06

## Scope

- 本轮只做 approvals 风险边界分析和文档化。
- 本轮不修改 consolePage.js、apiClient.js、httpServer.js。
- 本轮不接入 approvals 生产 UI。
- 本轮不触发 local operation。
- 本轮不新增 apiClient approvals 方法。

## Approvals 当前链路总览

基于 httpServer.js 和 agent-runner / approval / local-operation 模块分析：

| 能力 | HTTP 路由 | 方法 | 风险层级 |
|------|----------|------|---------|
| 列出所有审批 | `GET /approvals` | GET | Tier A: read-only |
| 生成意图预览 | `POST /local-agent/intent-preview` | POST | Tier B: preview-only |
| 生成操作计划 | `POST /local-agent/operation-plan` | POST | Tier B: preview-only |
| 生成补丁提案 | `POST /local-agent/patch-proposal` | POST | Tier C: proposal creation |
| 创建审批记录 | `POST /approvals/create` | POST | Tier C: proposal creation |
| 批准审批 | `POST /approvals/:id/approve` | POST | Tier D: state-changing |
| 拒绝审批 | `POST /approvals/:id/reject` | POST | Tier D: state-changing |
| 执行已批准操作 | `POST /local-operation/apply-approved` | POST | Tier E: execution |

## Risk Tier Analysis

### Tier A: Read-Only / List

**Route:** `GET /approvals`

**性质:** 只读，返回 approvalStore.list()，不改变任何状态。

**风险评估:**
- 是否只读：是
- 是否改变状态：否
- 是否可能生成 patch：否
- 是否可能写本地文件：否
- 是否可能触发 apply-approved：否
- 是否受 forbiddenPaths 保护：N/A（只读）
- 是否依赖人工确认：否
- 是否可能误触本地操作链：否
- 是否适合 bridge：是
- 是否需要额外 UI gate：否（只读安全）
- 是否需要单独验证命令：需要（product recovery）

**结论:** `future safe-to-bridge candidate`
**Bridge 建议:** 可在未来独立阶段安全接入 apiClient.listApprovals()。

---

### Tier B: Preview-Only

**Routes:**
- `POST /local-agent/intent-preview`
- `POST /local-agent/operation-plan`

**性质:** 生成预览数据，不创建审批记录，不执行操作。

**风险评估:**
- 是否只读：是（预览数据，不持久化）
- 是否改变状态：否
- 是否可能生成 patch：否
- 是否可能写本地文件：否
- 是否可能触发 apply-approved：否
- 是否受 forbiddenPaths 保护：N/A（不写入）
- 是否依赖人工确认：否
- 是否可能误触本地操作链：否
- 是否适合 bridge：是（但需要 UI gate 防止意外扩展到 Tier C）
- 是否需要额外 UI gate：需要（防止 preview 自动链接到 create）
- 是否需要单独验证命令：需要（product recovery + secret safety）

**结论:** `future bridge candidate with gate`
**Bridge 建议:** 可在未来独立阶段接入，但 UI 必须明确 preview ≠ approval，不得自动链接到 create。

---

### Tier C: Proposal Creation

**Routes:**
- `POST /local-agent/patch-proposal`
- `POST /approvals/create`

**性质:** 生成补丁提案并创建审批记录。不执行操作，但会持久化审批记录。

**风险评估:**
- 是否只读：否（创建审批记录）
- 是否改变状态：是（approvalStore.create）
- 是否可能生成 patch：是（patch-proposal 生成受限 no-op patch）
- 是否可能写本地文件：否（patch 只是预览，不写入）
- 是否可能触发 apply-approved：否（创建后仍需 approve + apply）
- 是否受 forbiddenPaths 保护：是（forbiddenPaths 包含 .env/.git/node_modules/legacy）
- 是否依赖人工确认：是（approvalRequired=true）
- 是否可能误触本地操作链：低风险（创建后仍需 approve + apply）
- 是否适合 bridge：暂时不适合
- 是否需要额外 UI gate：需要（必须明确展示审批流程）
- 是否需要单独验证命令：需要

**结论:** `bridge-later`
**Bridge 建议:** 不建议在当前阶段接入。如果未来接入，必须确保：
1. UI 清晰展示审批流程（创建 → 待批准 → 已批准 → 可执行）
2. 创建后不自动触发 approve
3. patch-proposal 的 allowedFiles / forbiddenPaths 必须被 UI 清晰展示

---

### Tier D: State-Changing Approval

**Routes:**
- `POST /approvals/:id/approve`
- `POST /approvals/:id/reject`

**性质:** 改变审批状态。approve 后审批进入"已批准"状态，reject 后进入"已拒绝"状态。

**风险评估:**
- 是否只读：否（改变审批状态）
- 是否改变状态：是（approvalStore.approve / .reject）
- 是否可能生成 patch：否
- 是否可能写本地文件：否（只改变审批状态）
- 是否可能触发 apply-approved：否（approve 后仍需单独调用 apply-approved）
- 是否受 forbiddenPaths 保护：N/A（不写文件）
- 是否依赖人工确认：是（人工点击 approve/reject）
- 是否可能误触本地操作链：中等风险（approve 是 apply-approved 的前置条件）
- 是否适合 bridge：不适合
- 是否需要额外 UI gate：需要（必须明确 approve ≠ apply）
- 是否需要单独验证命令：需要

**结论:** `do-not-bridge-now`
**Bridge 建议:** 不建议在当前阶段接入。approve 后审批进入"可执行"状态，如果 UI 不清晰，用户可能误以为 approve 已执行操作。必须在 UI 明确区分 approve（批准）和 apply（执行）后才能考虑 bridge。

---

### Tier E: Execution / Dangerous

**Route:** `POST /local-operation/apply-approved`

**性质:** 执行已批准的操作。这是整个审批链中唯一可能写入本地文件的步骤。

**风险评估:**
- 是否只读：否（可能写入本地文件）
- 是否改变状态：是（执行操作 + 更新审批状态）
- 是否可能生成 patch：N/A（执行已生成的 patch）
- 是否可能写本地文件：是（在 allowedFiles 范围内）
- 是否可能触发 apply-approved：N/A（这就是 apply-approved 本身）
- 是否受 forbiddenPaths 保护：是（forbiddenPaths 包含 .env/.git/node_modules/legacy/PROJECT_CONTEXT.md）
- 是否依赖人工确认：是（需要已批准的 approvalId）
- 是否可能误触本地操作链：高风险（这是本地操作链的执行入口）
- 是否适合 bridge：不适合
- 是否需要额外 UI gate：需要（必须二次确认）
- 是否需要单独验证命令：需要（完整回归 + 额外的安全验证）

**结论:** `do-not-bridge-now / forbidden-by-default`
**Bridge 建议:** 不建议在任何近期阶段接入。apply-approved 是整个审批链中最危险的步骤，即使有 forbiddenPaths 保护，仍然可能在 allowedFiles 范围内写入文件。必须在以下条件全部满足后才能考虑：
1. UI 有明确的二次确认机制
2. forbiddenPaths 被 UI 清晰展示
3. allowedFiles 被 UI 清晰展示
4. 执行结果被 UI 完整展示
5. 有独立的安全验证命令
6. 有完整的回滚方案

## Risk Tier Summary

| Tier | 能力 | 结论 | Bridge 建议 |
|------|------|------|------------|
| A | list approvals | future safe-to-bridge candidate | 可安全接入 |
| B | intent-preview / operation-plan | future bridge candidate with gate | 可接入但需 UI gate |
| C | patch-proposal / create | bridge-later | 暂不接入 |
| D | approve / reject | do-not-bridge-now | 不建议近期接入 |
| E | apply-approved | do-not-bridge-now / forbidden-by-default | 不建议任何近期阶段接入 |

## 下一阶段建议

1. **Phase323D-10:** 只考虑 Tier A list-only bridge。不得接 approve/reject/apply-approved。
2. **Phase323D-11:** 如 Tier A 稳定，可考虑 Tier B preview-only bridge。必须有 UI gate。
3. **Tier C/D/E:** 至少在 Tier A + B 稳定后，再做独立评估。不得同阶段接 approve/reject/apply-approved。
4. **apply-approved:** 必须保持人工确认 + 强 gate + 独立验证。不得将 apply-approved bridge 与 Chat send / routeRegistry 混在同一阶段。

## 本轮未做事项

- 未修改 consolePage.js
- 未修改 apiClient.js
- 未修改 httpServer.js
- 未接入 approvals 生产 UI
- 未触发 local operation
- 未新增危险 API client 方法
- 未调用 approvals 相关接口
- 未创建 approval
- 未 approve / reject
- 未 apply-approved
- 未触发 patch proposal
- 未写本地文件