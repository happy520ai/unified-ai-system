# Phase323D-11 Approvals Preview-Only Bridge Report

Generated: 2026-05-06

## Scope

- 本轮只在 approvals 页面增加 preview-only bridge with gate。
- 保留已有 approvals list-only bridge，不改 `GET /approvals` 语义。
- 本轮唯一新增 bridge 调用为 `POST /local-agent/intent-preview`。
- 本轮不接入 `patch-proposal`、`approvals/create`、`approve`、`reject`、`apply-approved`。
- 本轮不修改 `httpServer.js`、`/chat-gateway/execute`、Chat send 请求 body。

## Implementation

- `apps/ai-gateway-service/src/ui/workbench/apiClient.js`
  - 新增 `previewLocalAgentIntent(body)`。
  - 方法内部固定调用 `POST /local-agent/intent-preview`。
  - 方法内部强制 `dryRun: true` 与 `mode: "intent-preview"`。
  - 明确删除 `applyApproved`、`execute`、`write` 字段，避免误带执行语义。
- `apps/ai-gateway-service/src/ui/consolePage.js`
  - 在 approvals 区域增加独立按钮 `#preview-approval-intent-button`。
  - 新增 `#approval-preview-output` 只读预览结果区。
  - 新增 `previewApprovalIntent()`，仅调用 `workbenchApiClient.previewLocalAgentIntent(...)`。
  - 不复用 approve/reject/apply 按钮，不改变既有审批动作处理函数。

## Preview Gate

- 按钮文案明确包含“只读预览”。
- 预览调用与 approve/reject/apply 操作区分，不复用执行类按钮。
- payload 固定为 preview 语义：
  - `input: "审批意图只读预览"`
  - `message: "审批意图只读预览"`
  - `permissionMode: "manual"`
  - `allowedFiles: ALLOWED_NOOP_FILES`
  - `forbiddenPaths: FORBIDDEN_PATHS`
  - `dryRun: true`
  - `mode: "intent-preview"`
- 本轮没有创建 approval，没有生成 patch proposal，没有触发 apply-approved。

## Explicit Non-Goals

- 不接入 `POST /local-agent/patch-proposal`
- 不接入 `POST /approvals/create`
- 不接入 `POST /approvals/:id/approve`
- 不接入 `POST /approvals/:id/reject`
- 不接入 `POST /local-operation/apply-approved`
- 不触发 local operation
- 不改变审批人工确认语义
- 不接入 Chat send apiClient

## Verification

- `node --check apps\ai-gateway-service\src\ui\workbench\apiClient.js`
- `node --check apps\ai-gateway-service\src\ui\consolePage.js`
- `cmd /c pnpm run verify:phase321a-workbench-product-recovery`
- `cmd /c pnpm run verify:phase322a-workbench-chat-gateway-real-nvidia`
- `cmd /c pnpm run verify:phase313a-model-usability-matrix`
- `cmd /c pnpm run verify:phase107a-secret-safety`
- `cmd /c pnpm run health:phase12a`
- `cmd /c pnpm run doctor:phase13a`
- `cmd /c pnpm -r --if-present check`

## Risk Notes

- approvals 页面原有 create / approve / reject / apply 逻辑仍存在，但本轮未扩展这些高风险链路。
- preview-only bridge 仍需 future gate，Tier C / D / E 继续保持 do-not-bridge-now。
- workspace 保持既有 dirty 状态，未清理。

## Rollback

- 如需回退，仅回退 `consolePage.js` 与 `apiClient.js` 中的 preview-only bridge 代码。
- 不使用 `git reset`。
- 不使用 `git clean`。
- 不声称 workspace clean。
