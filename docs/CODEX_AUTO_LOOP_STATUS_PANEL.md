# Codex Auto Loop Status Panel

This document describes the preview-only Auto Loop Status Panel in `/ui`.
It shows where the manual Codex collaboration loop is currently stopped.
It does not execute Codex, does not call the Codex CLI, and does not modify
project code.

## Daily Status Check

Open `http://127.0.0.1:3100/ui`, then go to:

- 个人项目操作台
- 自动闭环状态面板 / Auto Loop Status Panel
- 任务队列 / Action Queue

You can also run the read-only command:

```powershell
cmd /c pnpm run codex:loop:status
```

The command only reads `.codex-handoff` state files. It does not refresh
business evidence, does not write code, and does not execute Codex.

## Status Files

- `.codex-handoff/outbox/latest-codex-task.md`
  - The next recommended Codex task in copyable Markdown form.
- `.codex-handoff/outbox/latest-codex-task.json`
  - The same task as structured metadata with `executionEnabled=false` and
    `codexExecInvoked=false`.
- `.codex-handoff/inbox/latest-codex-result.md`
  - A manually imported Codex result.
- `.codex-handoff/review/latest-feedback-to-codex.md`
  - Feedback generated after reviewing the Codex result.
- `.codex-handoff/runs/latest-run-summary.json`
  - The latest run summary, if a dry-run/readiness loop has been recorded.
- `.codex-handoff/runs/safety-gate-summary.json`
  - The latest safety gate summary.

## How To Read The Panel

- `nextTaskExists`
  - If false, generate the next Codex task from Action Queue.
- `outboxTaskExists`
  - If true, manually copy the task to Codex.
- `inboxResultExists`
  - If true, review the Codex result before doing anything else.
- `reviewExists`
  - If true, inspect the review decision and any blocker.
- `feedbackExists`
  - If true, you can manually copy feedback back to Codex.
- `latestGoNoGo`
  - Shows whether the current loop is ready for manual next-step only or
    blocked.
- `currentBlocker`
  - Shows the most important reason to stop or wait.
  - 无 blocker：可以继续观察或生成下一步任务。
- `recommendedNextAction`
  - Shows the next manual action.

## Continue Rules

Continue only when:

- next task exists,
- outbox task exists,
- inbox result has been reviewed,
- review is passed or accepted-preview,
- feedback is ready if another Codex round is needed,
- boundaries are still clear.

## Stop Rules

Stop when:

- no next task exists,
- inbox result exists but review is missing,
- review failed,
- blocker is not understood,
- required files are missing,
- any step implies real Codex execution,
- any step implies worktree creation, workflow runner connection, or
  auto commit/push.

## When To Generate The Next Task

Generate the next task when:

- review passed,
- no blocker remains for manual handoff,
- the next step can be bounded,
- required commands are known,
- stop conditions are explicit.

## When Human Judgment Is Required

Human judgment is required when:

- review decision is missing or ambiguous,
- latest evidence conflicts with older evidence,
- dirty workspace state affects interpretation,
- the task asks for real execution,
- the task expands into product or commercial claims,
- the safety gate says execution is not allowed.

## Preview-only Boundary

- 当前仍然不会真实执行 Codex。
- This panel only displays loop state.
- `executionEnabled=false`
- `codexExecInvoked=false`
- no real Codex exec
- no workflow runner
- no worktree creation
- no auto commit/push
- approval-preview is not execution permission
- readiness is not execution completed
