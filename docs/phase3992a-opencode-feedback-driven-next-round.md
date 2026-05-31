# Phase3992A OpenCode Feedback-Driven Next Round

## 阶段目标

基于 `Phase3991A` 的真实 `review-required` 结果，自动生成一份新的 OpenCode 下一轮任务包，明确要求 OpenCode 补齐结构化输出和证据缺口。

本阶段只解决：
1. 把最新 `review-required` 转成新的 outbox task。
2. 让下一轮任务显式要求 `Commands Run`、`Changed Files`、`Evidence Paths`、`blocker / none`、`completionVerified`、A-W 输出。
3. 生成本阶段 docs / evidence / verifier。

## 本阶段不要做的事

- 不修改 `legacy/`
- 不创建 `PROJECT_CONTEXT.md`
- 不 commit / push / deploy / release
- 不读取或打印 `auth.json`
- 不读取或打印 `.env` / API Key / token / secret
- 不调用 MiMo / OpenAI / Claude / OpenRouter / paid provider
- 不修改默认 `/chat`
- 不修改 `/chat-gateway/execute`

## 输入来源

### 上一轮真实输入

- `.opencode-handoff/inbox/latest-opencode-result.json`
- `.opencode-handoff/review/latest-opencode-review.json`
- `.opencode-handoff/review/latest-feedback-to-opencode.md`

### 本轮生成结果

- `.opencode-handoff/outbox/latest-opencode-task.md`
- `.opencode-handoff/outbox/latest-opencode-task.json`
- `.opencode-handoff/runs/opencode-desktop-next-round-task.json`
- `.opencode-handoff/runs/opencode-desktop-next-round-task.md`
- `apps/ai-gateway-service/evidence/phase3992a-opencode-feedback-driven-next-round/latest-next-round-task.json`
- `apps/ai-gateway-service/evidence/phase3992a-opencode-feedback-driven-next-round/latest-next-round-task.md`

## 下一轮任务必须补齐的缺口

只有当最新 review 是 `review-required`，才允许生成下一轮任务。生成后的任务必须要求 OpenCode 明确输出：

- `Commands Run`
- `Changed Files`
- `Evidence Paths`
- `Known Issues` 或 `blocker / none`
- `completionVerified`
- A-W 结构化结果

如果没有实际改动，也必须写：

- `Changed Files: none`
- `Commands Run: none`

不允许继续输出无结构的短句结果。

## 验证命令

```powershell
node --check apps/ai-gateway-service/src/entrypoints/opencodeLoopShared.js
node --check apps/ai-gateway-service/src/entrypoints/opencodeNextRoundTaskCore.js
node --check apps/ai-gateway-service/src/entrypoints/generateNextOpenCodeDesktopTask.js
node --check apps/ai-gateway-service/src/entrypoints/verifyPhase3992AOpenCodeFeedbackDrivenNextRound.js
node --test apps/ai-gateway-service/src/entrypoints/opencodeNextRoundTaskCore.test.js
cmd /c pnpm --filter @unified-ai-system/ai-gateway-service opencode:desktop:next-round
cmd /c pnpm --filter @unified-ai-system/ai-gateway-service verify:phase3992a-opencode-feedback-driven-next-round
cmd /c pnpm run verify:phase107a-secret-safety
cmd /c pnpm run health:phase12a
cmd /c pnpm run doctor:phase13a
cmd /c pnpm run verify:safe-regression-matrix
cmd /c pnpm run sync:readme-agents-current-state
cmd /c pnpm run verify:phase306c-readme-agents-auto-sync-guard
```

## sealed/pass 判定

只有同时满足以下条件，本阶段才可判定 sealed/pass：

1. 最新 review 是 `review-required`
2. 新的 next-round outbox 已生成
3. 新任务带有 `Commands Run / Changed Files / Evidence Paths / completionVerified` 明确要求
4. verifier passed
5. 未调用 paid provider
6. 未修改默认 `/chat`
7. 未读取或暴露 `auth.json` / `.env` / secret
8. 未声称 workspace clean
