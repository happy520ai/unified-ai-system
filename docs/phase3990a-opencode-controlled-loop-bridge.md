# Phase3990A OpenCode Controlled Loop Bridge

## 阶段目标

在不修改默认 `/chat`、不调用 paid provider、不过界读取 `auth.json` / `.env` / secret 的前提下，为当前仓库新增一条独立的 `OpenCode` 受控闭环：

1. 生成可发送给 `OpenCode Desktop` 的任务 outbox。
2. 通过桌面窗口发送任务。
3. 从本机 `OpenCode DB` 自动摄取最新 repo-matching assistant 结果。
4. 对结果执行本地 go/no-go 审查。
5. 产出 feedback / status / audit / verifier / internal tests。

## 本阶段不做的事

- 不修改 `legacy/`
- 不创建 `PROJECT_CONTEXT.md`
- 不 commit / push / deploy / release
- 不读取或打印 `auth.json`
- 不读取或打印 `.env` / API Key / token / secret
- 不调用 MiMo / OpenAI / Claude / OpenRouter / paid provider
- 不改默认 `/chat` 或 `/chat-gateway/execute`
- 不把 `OpenCode` 桌面发送写成“执行已完成”

## 新增链路

### 1. Outbox

- `.opencode-handoff/outbox/latest-opencode-task.md`
- `.opencode-handoff/outbox/latest-opencode-task.json`

通过 `opencode:desktop:seed-task` 生成 Phase3990A 标准任务，任务里明确：

- 允许范围
- 禁止范围
- 必须验证命令
- 停止条件
- A-W 结构化输出要求

### 2. Send

- `opencode:desktop:send -- --dry-run`
- `opencode:desktop:send -- --copy-only`
- `opencode:desktop:send -- --paste-only`
- `opencode:desktop:send -- --send --confirm-send`

发送前预检要求：

- `executionEnabled=false`
- 不包含明文 secret
- 不允许 commit / push
- 不表示 provider 已被调用

### 3. DB 自动回传

从本机 `OpenCode DB` 安全读取：

- `session`
- `message`
- `part`

只读取最小需要的会话元信息和 assistant 可见文本，不读取账户 token，不输出 reasoning 原文，不输出 secret。

### 4. Review

审查结果会落在：

- `.opencode-handoff/review/latest-opencode-review.json`
- `.opencode-handoff/review/latest-opencode-review.md`
- `.opencode-handoff/review/latest-feedback-to-opencode.md`

审查会判断：

- 是否越界修改 `legacy/`
- 是否创建 `PROJECT_CONTEXT.md`
- 是否出现 commit / push / destructive git
- 是否触碰 paid provider
- 是否缺命令/文件/evidence/completionVerified 说明
- 当前执行是否仍朝阶段目标前进

## 关键事实

- 当前仓内原有 `OpenCode autopilot` 仍然只是治理队列，不是真执行闭环。
- Phase3990A 复用了现有 `Codex Desktop` 桥接思路，但走的是独立 `.opencode-handoff` 链路。
- 本机 `OpenCode DB` 已确认存在 `session / message / part / todo / project / workspace` 等表，可用于自动结果摄取。

## 主要命令

```powershell
cmd /c pnpm run opencode:desktop:seed-task
cmd /c pnpm run opencode:desktop:status
cmd /c pnpm run opencode:desktop:send -- --dry-run
cmd /c pnpm run opencode:desktop:ingest -- --from-db-latest
cmd /c pnpm run opencode:desktop:review
cmd /c pnpm run opencode:desktop:loop -- --dry-run
cmd /c pnpm run opencode:desktop:test:internal
cmd /c pnpm run opencode:desktop:audit
cmd /c pnpm run verify:phase3990a-opencode-controlled-loop-bridge
```

## 验证要求

```powershell
node --check apps/ai-gateway-service/src/entrypoints/opencodeLoopShared.js
node --check apps/ai-gateway-service/src/entrypoints/opencodeDbSafeReader.js
node --check apps/ai-gateway-service/src/entrypoints/opencodeReviewCore.js
node --check apps/ai-gateway-service/src/entrypoints/opencodeDesktopStatus.js
node --check apps/ai-gateway-service/src/entrypoints/sendOpenCodeDesktopTask.js
node --check apps/ai-gateway-service/src/entrypoints/ingestOpenCodeDesktopResult.js
node --check apps/ai-gateway-service/src/entrypoints/reviewOpenCodeDesktopResult.js
node --check apps/ai-gateway-service/src/entrypoints/runOpenCodeDesktopLoop.js
node --check apps/ai-gateway-service/src/entrypoints/seedOpenCodeDesktopTask.js
node --check apps/ai-gateway-service/src/entrypoints/runOpenCodeDesktopInternalTests.js
node --check apps/ai-gateway-service/src/entrypoints/runOpenCodeDesktopAutomationAudit.js
node --check apps/ai-gateway-service/src/entrypoints/verifyPhase3990AOpenCodeControlledLoopBridge.js
node --test apps/ai-gateway-service/src/entrypoints/opencodeDbSafeReader.test.js
node --test apps/ai-gateway-service/src/entrypoints/opencodeReviewCore.test.js
cmd /c pnpm --filter @unified-ai-system/ai-gateway-service opencode:desktop:seed-task
cmd /c pnpm --filter @unified-ai-system/ai-gateway-service opencode:desktop:test:internal
cmd /c pnpm --filter @unified-ai-system/ai-gateway-service opencode:desktop:audit
cmd /c pnpm --filter @unified-ai-system/ai-gateway-service verify:phase3990a-opencode-controlled-loop-bridge
cmd /c pnpm run verify:phase107a-secret-safety
cmd /c pnpm run health:phase12a
cmd /c pnpm run doctor:phase13a
cmd /c pnpm run verify:safe-regression-matrix
cmd /c pnpm run sync:readme-agents-current-state
cmd /c pnpm run verify:phase306c-readme-agents-auto-sync-guard
```

## 封板标准

只有在以下条件同时满足时，Phase3990A 才能声称 sealed/pass：

1. `.opencode-handoff` 全链路文件存在。
2. internal tests 三轮通过。
3. audit passed。
4. verifier passed。
5. 不声称 provider 已调用。
6. 不声称 workspace clean。
