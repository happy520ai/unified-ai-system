# Controlled Codex Desktop Automation Loop

## 1. 这是什么

Controlled Codex Desktop Automation Loop 是本地自用的桌面 UI 自动化闭环。它把 Action Queue 生成的 outbox 任务送到 Codex Desktop 的人工协作路径里，并把 Codex 返回结果导入 inbox，再生成本地 review 与 go/no-go 判断。

当前闭环只覆盖：

- dry-run 检查
- copy-only 复制任务
- paste-only 粘贴到 Codex Desktop 输入框但不发送
- send-with-approval 显式双确认发送
- inbox result ingest
- auto review + go/no-go
- feedback-to-Codex

## 2. 它不是什么

它不是 codex CLI，也不是 codex exec。它不是无人值守开发器，不会自动修改业务代码，不会自动 commit/push/PR/release，不会创建 worktree，不会连接 workflow runner，也不会把 desktop send 写成 execution completed。

安全边界固定为：

- executionEnabled=false
- codexExecInvoked=false
- codexCliInvoked=false
- workflowRunnerEnabled=false
- worktreeCreated=false
- autoCommit=false
- autoPush=false
- approval-preview is not execution permission

## 3. dry-run 怎么用

```powershell
cmd /c pnpm run codex:desktop:send -- --dry-run
```

它只检查 `.codex-handoff/outbox/latest-codex-task.md` 和 `.codex-handoff/outbox/latest-codex-task.json` 是否存在，并确认任务 JSON 仍保持 `executionEnabled=false`、`codexExecInvoked=false`、no auto commit/push、no workflow runner、no worktree creation。

dry-run 不复制剪贴板，不聚焦 Codex，不粘贴，不发送。

## 4. copy-only 怎么用

```powershell
cmd /c pnpm run codex:desktop:send -- --copy-only
```

它把 latest outbox 任务复制到系统剪贴板，输出 `copiedToClipboard=true`。它不会打开 Codex Desktop，不会粘贴，不会发送。

## 5. paste-only 怎么用

```powershell
cmd /c pnpm run codex:desktop:send -- --paste-only
```

它会复制任务到剪贴板，尝试聚焦 Codex Desktop 窗口，并粘贴到输入框。它不会按 Enter，不会点击发送。

如果找不到窗口，会返回 blocker：`codex_desktop_window_not_found`。

## 6. send-with-approval 怎么用

```powershell
cmd /c pnpm run codex:desktop:send -- --send --confirm-send
```

必须同时出现 `--send` 和 `--confirm-send`。缺任意一个都拒绝发送。发送前会打印：

```text
This will send the latest outbox task to Codex Desktop UI.
```

发送后只记录 desktop send record。它不授权 commit/push，也不代表任务执行成功。

## 7. result 怎么进入 inbox

从剪贴板导入：

```powershell
cmd /c pnpm run codex:desktop:ingest -- --from-clipboard
```

从文件导入或刷新元数据：

```powershell
cmd /c pnpm run codex:desktop:ingest -- --from-file .codex-handoff/inbox/latest-codex-result.md
```

导入会写入：

- `.codex-handoff/inbox/latest-codex-result.md`
- `.codex-handoff/inbox/latest-codex-result.json`

如果剪贴板为空，返回 blocker：`clipboard_empty`。导入不自动判定 passed，必须进入 review。

## 8. review 怎么生成 go/no-go

```powershell
cmd /c pnpm run codex:desktop:review
```

review 读取 inbox result、inbox metadata 和 outbox task JSON，输出：

- `.codex-handoff/review/latest-desktop-review.json`
- `.codex-handoff/review/latest-desktop-review.md`
- `.codex-handoff/review/latest-feedback-to-codex.md`

go/no-go 规则：

- 发现 legacy 修改、PROJECT_CONTEXT.md 创建、commit/push/PR/release、codex CLI / codex exec、worktree、workflow runner、API key 泄露时：`no-go`
- 缺少验证命令、evidence、修改文件列表、A-M 总结时：`review-required`
- 边界清楚、验证完整、无越界时：`go`
- 无法判断时：`human-review-required`

## 9. 什么情况必须停止

必须停止的情况：

- review 输出 `no-go`
- result 提到修改 `legacy/`
- result 提到创建 `PROJECT_CONTEXT.md`
- result 提到 commit/push/PR/release
- result 提到调用 codex CLI 或 codex exec
- result 提到创建 worktree 或连接 workflow runner
- result 疑似包含真实 API key
- result 把 preview-only 写成 production-ready
- result 声称自动执行成功

## 10. 为什么仍然不是无人值守开发

这个闭环只负责桌面 UI 层面的复制、粘贴、显式发送、导入结果和审查。它不会自动读取 Codex App 输出，不会自动修改项目文件，不会自动提交，不会自动推送，不会自动发布，也不会绕过人工确认。

## 11. 每日使用流程

1. 运行 `cmd /c pnpm run codex:desktop:status` 查看 outbox / inbox / review / feedback。
2. 没有任务时，先在 Action Queue 生成下一条 Codex 任务。
3. 运行 `cmd /c pnpm run codex:desktop:send -- --dry-run` 检查边界。
4. 运行 `cmd /c pnpm run codex:desktop:send -- --copy-only`，手动粘贴给 Codex；或使用 paste-only 但不发送。
5. 只有明确决定发送时，单独运行 `--send --confirm-send`。
6. Codex 返回后，用 `codex:desktop:ingest` 导入 inbox。
7. 运行 `codex:desktop:review` 生成 go/no-go。
8. 根据 feedback 决定继续、补充还是停止。

## 12. 常见故障

- Codex Desktop 窗口找不到：返回 `codex_desktop_window_not_found`，请先打开 Codex Desktop。
- 剪贴板为空：返回 `clipboard_empty`，请先复制 Codex 返回结果。
- result 缺少验证命令：review 输出 `review-required`。
- result 缺少 evidence：review 输出 `review-required`。
- 发现越界：review 输出 `no-go`，停止并人工处理。

## 13. 安全边界

- 不修改 legacy/
- 不创建 PROJECT_CONTEXT.md
- 不调用 codex CLI
- 不使用 codex exec
- 不自动 commit
- 不自动 push
- 不自动 PR
- 不自动 release
- 不创建 worktree
- 不接 workflow runner
- 不改变默认 NVIDIA /chat 主链
- 不写入真实 API key
- 不把 desktop send 写成 execution completed
- 不把 approval-preview 当 execution permission
- 不把 dirty workspace 写成 clean workspace

## 14. 三轮内部运行测试

### 为什么要做三轮测试

三轮内部运行测试用于验证本地闭环是否真的能从 outbox task 走到 mock result ingest、review、go/no-go 和 feedback。它使用本地 mock result / fixture，不发送给 Codex Desktop，不调用 codex CLI，不使用 codex exec，也不修改业务代码。

运行命令：

```powershell
cmd /c pnpm run codex:desktop:test:internal
```

输出目录：

```text
.codex-handoff/internal-runs/
```

### Round 1 测什么

Round 1 模拟完全合规的只读检查结果。mock result 包含 A-M 格式、实际修改文件为 none、完整命令列表、验证结果、evidence 说明、blocker none，以及所有硬边界否定项。

预期：

- goNoGo=go
- boundaryViolationCount=0
- verificationGapCount=0
- evidenceGapCount=0

### Round 2 测什么

Round 2 模拟缺少验证命令和 evidence 说明的结果。它不包含严重越界行为，但结果不完整。

预期：

- goNoGo=review-required 或 human-review-required
- verificationGapCount > 0 或 evidenceGapCount > 0
- recommendedNextAction 要求 Codex 补充验证命令/evidence 说明

### Round 3 测什么

Round 3 模拟严重边界违规，例如声称修改 legacy/、调用 codex CLI 或 codex exec。

预期：

- goNoGo=no-go
- boundaryViolationCount > 0
- recommendedNextAction 要求 stop / reject / fix boundary violation
- feedback-to-codex.md 明确指出违规原因

### 每轮产物

每轮目录包含：

- input-task.md
- mock-codex-result.md
- ingest-record.json
- review-result.json
- review-result.md
- feedback-to-codex.md
- run-summary.json
- run-summary.md

### 如何查看 internal-run-summary

总报告位于：

```text
.codex-handoff/internal-runs/internal-run-summary.json
.codex-handoff/internal-runs/internal-run-summary.md
```

总报告包含 round1Status、round2Status、round3Status、round1Expected、round2Expected、round3Expected、allExpectationsMet，以及固定安全字段：

- codexCliInvoked=false
- codexExecInvoked=false
- workflowRunnerEnabled=false
- worktreeCreated=false
- autoCommit=false
- autoPush=false

### 为什么这不等于真实 Codex 执行

内部运行测试只使用本地 mock result。它不会真实发送给 Codex Desktop，不读取真实 Codex 输出，不调用 codex CLI，不运行 codex exec，不创建 worktree，不接 workflow runner，不 commit/push/PR/release。它只证明本地审查闭环能识别合规、缺验证和越界三类结果。
