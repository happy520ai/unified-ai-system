# Phase3991A OpenCode Real One-Shot Intake

## 阶段目标

在不修改默认 `/chat`、不修改 `/chat-gateway/execute`、不读取 `auth.json`、不读取 `.env`、不调用 paid provider 的前提下，完成一次真实 `OpenCode DB` 单轮结果自动摄取，并把本地 review 与 one-shot seal 证据写全。

本阶段要求：
1. `opencode:desktop:ingest -- --from-db-latest` 从本机 `OpenCode DB` 读取 repo-matching session。
2. `opencode:desktop:review` 基于真实 inbox 生成 review 与 feedback。
3. `opencode:desktop:seal-one-shot` 生成本阶段 one-shot seal。
4. 如果没有真实结果，必须诚实写成 blocker，不得伪装为成功。

## 本阶段不要做的事

- 不修改 `legacy/`
- 不创建 `PROJECT_CONTEXT.md`
- 不 commit / push / deploy / release
- 不读取或打印 `auth.json`
- 不读取或打印 `.env` / API Key / token / secret
- 不调用 MiMo / OpenAI / Claude / OpenRouter / paid provider
- 不修改默认 `/chat`
- 不修改 `/chat-gateway/execute`

## 真实 intake / review / seal 链路

### 1. Intake

命令：

```powershell
cmd /c pnpm run opencode:desktop:ingest -- --from-db-latest
```

输出：

- `.opencode-handoff/inbox/latest-opencode-result.md`
- `.opencode-handoff/inbox/latest-opencode-result.json`

要求：

- 来源必须是 `OpenCode DB`
- session 必须是 repo-matching
- 不读取 `auth.json`
- 不导出 reasoning 原文

### 2. Review

命令：

```powershell
cmd /c pnpm run opencode:desktop:review
```

输出：

- `.opencode-handoff/review/latest-opencode-review.json`
- `.opencode-handoff/review/latest-opencode-review.md`
- `.opencode-handoff/review/latest-feedback-to-opencode.md`

要求：

- 允许 `go`
- 允许 `review-required`
- 允许 `no-go`
- 不允许把 `completionVerified=false` 写成成功

### 3. One-Shot Seal

命令：

```powershell
cmd /c pnpm run opencode:desktop:seal-one-shot
cmd /c pnpm run verify:phase3991a-opencode-real-one-shot-intake
```

输出：

- `.opencode-handoff/runs/opencode-desktop-one-shot-seal.json`
- `.opencode-handoff/runs/opencode-desktop-one-shot-seal.md`
- `apps/ai-gateway-service/evidence/phase3991a-opencode-real-one-shot-intake/latest-one-shot-seal.json`
- `apps/ai-gateway-service/evidence/phase3991a-opencode-real-one-shot-intake/latest-one-shot-seal.md`

如果本轮没有真实 inbox / session，必须明确区分：

- `manual_result_missing`
- `session_not_found`
- `review_not_generated`
- `feedback_not_generated`

## 验证命令

```powershell
node --check apps/ai-gateway-service/src/entrypoints/ingestOpenCodeDesktopResult.js
node --check apps/ai-gateway-service/src/entrypoints/reviewOpenCodeDesktopResult.js
node --check apps/ai-gateway-service/src/entrypoints/opencodeDesktopStatus.js
node --check apps/ai-gateway-service/src/entrypoints/opencodeOneShotSealCore.js
node --check apps/ai-gateway-service/src/entrypoints/runOpenCodeDesktopOneShotSeal.js
node --check apps/ai-gateway-service/src/entrypoints/verifyPhase3991AOpenCodeRealOneShotIntake.js
node --test apps/ai-gateway-service/src/entrypoints/opencodeOneShotSealCore.test.js
cmd /c pnpm --filter @unified-ai-system/ai-gateway-service opencode:desktop:ingest -- --from-db-latest
cmd /c pnpm --filter @unified-ai-system/ai-gateway-service opencode:desktop:review
cmd /c pnpm --filter @unified-ai-system/ai-gateway-service opencode:desktop:seal-one-shot
cmd /c pnpm --filter @unified-ai-system/ai-gateway-service verify:phase3991a-opencode-real-one-shot-intake
cmd /c pnpm run verify:phase107a-secret-safety
cmd /c pnpm run health:phase12a
cmd /c pnpm run doctor:phase13a
cmd /c pnpm run verify:safe-regression-matrix
cmd /c pnpm run sync:readme-agents-current-state
cmd /c pnpm run verify:phase306c-readme-agents-auto-sync-guard
```

## sealed/pass 判定

只有同时满足以下条件，本阶段才可判定 sealed/pass：

1. 真实 inbox 已生成
2. review 已生成
3. feedback 已生成
4. one-shot seal 已生成
5. verifier passed
6. 未调用 paid provider
7. 未修改默认 `/chat`
8. 未读取或暴露 `auth.json` / `.env` / secret
9. 未声称 workspace clean
