# Controlled Codex Desktop Automation System Audit

## 审查范围

Phase 266A 审查 Controlled Codex Desktop Automation Loop 的真实可用性：命令、outbox、inbox、review、feedback、internal-runs、UI 状态、安全边界、文档和 verifier。审查只覆盖本地文件桥和桌面 UI handoff 状态，不开启真实 Codex exec。

## 实际检查的命令

- `cmd /c pnpm run codex:desktop:status`
- `cmd /c pnpm run codex:desktop:send -- --dry-run`
- `cmd /c pnpm run codex:desktop:send -- --copy-only`
- `cmd /c pnpm run codex:desktop:send -- --send`
- `cmd /c pnpm run codex:desktop:send -- --confirm-send`
- `cmd /c pnpm run codex:desktop:ingest -- --from-file .codex-handoff/inbox/latest-codex-result.md`
- `cmd /c pnpm run codex:desktop:review`
- `cmd /c pnpm run codex:desktop:loop -- --dry-run`
- `cmd /c pnpm run codex:desktop:test:internal`
- `cmd /c pnpm run verify:codex-desktop-automation-system-audit`

`--send` alone and `--confirm-send` alone must be safe refusals. This audit does not run `--send --confirm-send`.

## 实际检查的文件

- `package.json`
- `apps/ai-gateway-service/package.json`
- `apps/ai-gateway-service/src/ui/consolePage.js`
- `apps/ai-gateway-service/src/entrypoints/codexDesktopStatus.js`
- `apps/ai-gateway-service/src/entrypoints/sendCodexDesktopTask.js`
- `apps/ai-gateway-service/src/entrypoints/ingestCodexDesktopResult.js`
- `apps/ai-gateway-service/src/entrypoints/codexDesktopReviewCore.js`
- `apps/ai-gateway-service/src/entrypoints/reviewCodexDesktopResult.js`
- `apps/ai-gateway-service/src/entrypoints/runCodexDesktopLoop.js`
- `apps/ai-gateway-service/src/entrypoints/runCodexDesktopInternalTests.js`
- `docs/CODEX_DESKTOP_AUTOMATION_LOOP.md`
- `docs/CODEX_AUTO_LOOP_STATUS_PANEL.md`
- `.codex-handoff/outbox/latest-codex-task.md`
- `.codex-handoff/outbox/latest-codex-task.json`
- `.codex-handoff/inbox/latest-codex-result.md`
- `.codex-handoff/inbox/latest-codex-result.json`
- `.codex-handoff/review/latest-desktop-review.json`
- `.codex-handoff/review/latest-desktop-review.md`
- `.codex-handoff/review/latest-feedback-to-codex.md`
- `.codex-handoff/internal-runs/internal-run-summary.json`

`.codex-handoff/runs/latest-desktop-send-record.json` is allowed to be absent unless a separately authorized `--send --confirm-send` run has happened.

## 发现的问题

- Phase 266A 之前没有系统级 audit 文档、machine-readable audit 报告和 dedicated verifier。
- Review gate 对完全无法判断的结果需要显式输出 `human-review-required`，不能默认 `go`。
- 系统级审查必须把 `--send` 缺少 `--confirm-send`、`--confirm-send` 缺少 `--send` 作为 expected refusal 记录。

## 实际修复的问题

- 新增 `docs/CODEX_DESKTOP_AUTOMATION_SYSTEM_AUDIT.md`。
- 新增 `.codex-handoff/runs/desktop-automation-system-audit.json` 与 `.md` 生成入口。
- 新增 `verify:codex-desktop-automation-system-audit`，检查 audit JSON、internal runs、UI markers、package scripts 和安全字段。
- 修复 review 判断：当验证项和 evidence 全部缺失时，结果进入 `human-review-required`。

## 未修复问题和原因

- 不执行真实 `--send --confirm-send`，因此 send record 允许不存在；这是本阶段安全边界，不是功能缺陷。
- 不测试真实 Codex Desktop 窗口粘贴；如果窗口不存在，paste-only 应返回 `codex_desktop_window_not_found`，不能误报发送成功。

## 三轮内部测试结果

- Round 1：正常合规结果，预期 `go` 或 `accepted-preview`。
- Round 2：缺少验证/evidence，预期 `review-required` 或 `human-review-required`。
- Round 3：边界违规，预期 `no-go`。
- 总报告：`.codex-handoff/internal-runs/internal-run-summary.json`，必须包含 `allExpectationsMet=true`。

这些是本地 mock 测试，不是真实 Codex 执行，不调用 codex CLI，不使用 codex exec，不创建 worktree，不连接 workflow runner。

## UI 检查结果

`/ui` 必须显示：

- 自动闭环状态面板 / Auto Loop Status Panel
- 受控 Codex 桌面自动化 / Controlled Codex Desktop Automation
- outbox / inbox / review / feedback
- go/no-go
- recommendedNextAction
- `executionEnabled=false`
- `codexExecInvoked=false`
- `codexCliInvoked=false`
- `no workflow runner`
- `no worktree creation`
- `no auto commit/push`
- `approval-preview is not execution permission`

## 安全边界检查结果

必须保持：

- `codexCliInvoked=false`
- `codexExecInvoked=false`
- `workflowRunnerEnabled=false`
- `worktreeCreated=false`
- `autoCommit=false`
- `autoPush=false`
- `realSendExecuted=false`

Desktop send 不等于 execution completed，也不授予 commit/push 权限。approval-preview is not execution permission.

## 当前是否可以进入人工授权真实发送

如果系统级 audit 为 `passed`，可以进入下一轮“是否人工授权真实 desktop send”的单独决策。但本阶段不会自动进入，也不会运行 `--send --confirm-send`。

## 当前仍不能做什么

- 不修改 `legacy/`
- 不创建 `PROJECT_CONTEXT.md`
- 不调用 codex CLI
- 不使用 codex exec
- 不真实发送给 Codex Desktop
- 不自动 commit/push/PR/release
- 不创建 worktree
- 不接 workflow runner
- 不改变默认 NVIDIA `/chat` 主链
- 不写入真实 API key
- 不把 mock/internal test 写成真实 Codex 执行
- 不把 desktop send 写成 execution completed

## 最终结论

Phase 266A 的通过条件是：真实命令运行、系统级 audit JSON `status=passed`、三轮内部测试符合预期、UI markers 存在、安全字段全部为 false、verifier 通过。若任一条件失败，最终结论必须是 `failed` 或 `blocked`，不能口头伪造通过。
