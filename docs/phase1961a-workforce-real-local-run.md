# Phase1961A Workforce 本地真实执行

## 阶段目标

把 Workforce 从只生成预览计划，升级为可通过 `POST /workforce/run-local` 触发的一次本地真实编排闭环。

## 已实现能力

- 生成 Workforce 计划。
- 保存计划到本地 plan store。
- 基于计划生成本地任务队列。
- 将本地任务队列记录为 completed。
- 写入 JSON 和 Markdown evidence。
- UI 按钮可触发 `/workforce/run-local` 并展示 runId、planId、任务数量和安全边界。

## 明确边界

- 不是生产部署。
- 不调用 Provider。
- 不调用 paid API、MiMo、OpenAI、Claude、OpenRouter 或 NVIDIA。
- 不读取、不打印、不暴露 API Key、`.env`、secret、token、auth.json 或 raw CredentialRef。
- 不执行项目代码修改。
- 不部署、不发布、不打 tag、不上传 artifact。
- 不 commit、不 push。
- 不修改 `legacy/`。
- 不创建 `PROJECT_CONTEXT.md`。
- 不改变默认 `/chat`。
- 不改变 `/chat-gateway/execute`。
- 不声称 workspace clean。

## HTTP Route

- `POST /workforce/run-local`

请求示例：

```json
{
  "goal": "为 AI Gateway Workbench 规划一次本地真实 Workforce 执行",
  "selectedTemplate": "feature-development"
}
```

返回重点字段：

- `phase=Phase1961A`
- `mode=real-local-workforce-run`
- `executionStatus=completed`
- `completionVerified=true`
- `previewOnly=false`
- `localRunExecuted=true`
- `taskQueueCreated=true`
- `providerCallsMade=false`
- `secretValueExposed=false`
- `projectFileWrites=false`

## Evidence

- `apps/ai-gateway-service/evidence/phase1961a/workforce-real-local-run-result.json`
- `apps/ai-gateway-service/evidence/phase1961a/workforce-real-local-run-result.md`
- `apps/ai-gateway-service/evidence/phase1961a/workforce-real-local-run-verification-result.json`

## 验证命令

```powershell
cmd /c pnpm run verify:phase1961a-workforce-real-local-run
```

## Sealed 判定

当 verifier 全部通过时，本阶段可判定为 Workforce 本地真实执行 ready。该结论只覆盖本地 Workforce 编排，不覆盖生产部署、公开发布、真实 Provider 调用或真实代码变更执行。
