# Desktop Automation Ready State Reset

## 这是什么

Desktop Automation Ready State Reset 是一个本地待命状态重置步骤。它用于把三轮内部 mock 测试或人工审查留下的 latest `no-go` / `review_failed` 从当前可操作状态中移开，让 Auto Loop Status Panel 回到 `standby-ready`。

## 它不是什么

它不是重新判定旧结果通过，不会把 failed review 改成 passed。它不会删除 evidence，不会真实发送给 Codex Desktop，不会调用 codex CLI，不会使用 codex exec，不会创建 worktree，不会连接 workflow runner，也不会自动 commit/push。

## 为什么需要

Phase 266A 的 Round 3 会故意生成边界违规 mock result，预期 `goNoGo=no-go`。如果这个 mock result 留在 latest inbox/review，桌面自动化面板会一直显示 `review_failed`。Phase 267A 通过归档 latest inbox/review/feedback 并写入 reset record，把当前状态恢复为待命。

## 使用命令

```powershell
cmd /c pnpm run codex:desktop:reset-ready
cmd /c pnpm run codex:desktop:status
cmd /c pnpm run codex:loop:status
```

## 输出文件

- `.codex-handoff/runs/latest-ready-state-reset.json`
- `.codex-handoff/runs/latest-ready-state-reset.md`
- `.codex-handoff/runs/ready-state-reset/<resetId>/ready-state-reset.json`
- `.codex-handoff/runs/ready-state-reset/<resetId>/ready-state-reset.md`
- `.codex-handoff/runs/ready-state-reset/<resetId>/...snapshot files...`

## 重置后应该看到什么

- `readyStateResetActive=true`
- `latestGoNoGo=standby-ready`
- `currentBlocker=none`
- `recommendedNextAction` 提示可以生成/复制下一条任务，或等待新的 Codex result inbox

## 保留的边界

- `executionEnabled=false`
- `codexCliInvoked=false`
- `codexExecInvoked=false`
- `workflowRunnerEnabled=false`
- `worktreeCreated=false`
- `autoCommit=false`
- `autoPush=false`
- `realSendExecuted=false`
- `approval-preview is not execution permission`

## 停止规则

如果 reset record 缺失、旧 review 没有被快照归档、status 仍显示 `review_failed`，或者任何安全字段变成 true，必须停止并修复。不能把旧 no-go 写成 passed。

## 最终结论

Phase 267A 只把桌面自动化闭环恢复到待命状态。它不扩大能力，不开启真实执行，不改变默认 NVIDIA `/chat` 主链。
