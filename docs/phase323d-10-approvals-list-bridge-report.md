# Phase323D-10 Approvals List-Only Bridge Report

Generated: 2026-05-06

## Scope

- 本轮只接入 approvals 的 list-only bridge。
- 本轮只允许 `GET /approvals`。
- 本轮不接入 `create / approve / reject / apply-approved`。
- 本轮不修改 `httpServer.js`。
- 本轮不修改 `/chat-gateway/execute`。
- 本轮不修改 Chat send 请求 body。

## Implementation

- `apps/ai-gateway-service/src/ui/workbench/apiClient.js`
  - 已存在 `listApprovals()`，本轮未修改。
- `apps/ai-gateway-service/src/ui/consolePage.js`
  - 将 approvals 列表加载从 `requestJson("/approvals")` 切换为 `workbenchApiClient.listApprovals()`。
  - 仅替换列表读取入口。
  - 未改按钮事件、未改审批动作、未改本地执行链。

## Request Boundary

- method: `GET`
- path: `/approvals`
- body: none
- content-type / headers: 保持既有语义
- error handling: 保持既有 `workbenchFetchJson()` / `requestJson()` 错误抛出风格

## Explicit Non-Goals

- 不接入 `POST /approvals/create`
- 不接入 `POST /approvals/:id/approve`
- 不接入 `POST /approvals/:id/reject`
- 不接入 `POST /local-agent/intent-preview`
- 不接入 `POST /local-agent/patch-proposal`
- 不接入 `POST /local-operation/apply-approved`
- 不触发 local operation
- 不改变审批任务人工确认语义

## Verification

- `node --check apps\ai-gateway-service\src\ui\consolePage.js`
- `cmd /c pnpm run verify:phase321a-workbench-product-recovery`
- `cmd /c pnpm run verify:phase322a-workbench-chat-gateway-real-nvidia`
- `cmd /c pnpm run verify:phase107a-secret-safety`
- `cmd /c pnpm run verify:phase313a-model-usability-matrix`
- `cmd /c pnpm run health:phase12a`
- `cmd /c pnpm run doctor:phase13a`
- `cmd /c pnpm -r --if-present check`

Result:

- approvals 列表 bridge 正常接入。
- product recovery 通过。
- Phase322A 主链通过。
- secret safety 通过，`docsBoundaryPresent=true`。

## Risk Notes

- approvals 页面仍保留既有 approve / reject / apply 按钮逻辑，但本轮未通过 bridge 扩展这些能力。
- 本轮仅把列表读取入口统一到现有低风险 apiClient 方法，不改变危险动作边界。

## Rollback

- 如需回退，仅回退 `consolePage.js` 中 approvals 列表加载入口。
- 不使用 `git reset`。
- 不使用 `git clean`。
- 不声称 workspace clean。
