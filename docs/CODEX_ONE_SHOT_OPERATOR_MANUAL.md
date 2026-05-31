# Codex One-shot Operator Manual

Phase 264A consolidates Phases 256A-263A into an operator manual for future
one-shot readiness. It still does not execute Codex.

## 1. When To Consider One-shot

Consider one-shot readiness only for a small, bounded, verifiable task with
exact files, clear stop condition, and current passed evidence.

## 2. When Not To Consider One-shot

Do not consider one-shot when secrets, legacy changes, workflow runner,
worktree, broad refactor, dirty overlap, missing evidence, or provider mainline
changes are involved.

## 3. Classify The Task

Classify as safe-preview, needs-human-review, blocked, or forbidden.

## 4. Run Preflight

Run preflight for workspace, dirty state, allowed files, blocked files, secret
scan, required verification, expected evidence, and stop plan.

## 5. Generate Approval-preview

Generate approval-preview only as metadata. approval-preview is not execution
permission and executionEnabled=false remains required. approval-preview is not execution permission.

## 6. Generate Dry-run Execution Plan

Generate a dry-run plan that describes future steps but does not call Codex CLI
or change files.

## 7. Receive Codex Result

If a future result exists, intake must include modified files, executed
commands, verification, evidence paths, boundary review, and A-M summary.

Result intake marker: modified files, executed commands, verification, evidence paths, boundary review, and A-M summary.

## 8. Review Evidence

Review evidence through the verifier. Failed evidence is not sealed.

## 9. Trigger Stop Rules

Trigger stop rules on verification failure, missing evidence, legacy changes,
PROJECT_CONTEXT.md creation, secret exposure, workflow runner, worktree,
commit/push, or boundary drift.

## 10. Go / No-go Judgment

Go/no-go means readiness only. It does not authorize execution.

## 11. Current No-real-execution Boundary

Current state:

- executionEnabled=false
- codexExecInvoked=false
- worktreeCreated=false
- workflowRunEnabled=false
- autoCommit=false
- autoPush=false

## 12. Future Missing Pieces

Before real execution can ever be considered, the project still needs explicit
human authorization, clean scope, fresh evidence, rollback plan, result intake,
and a separate real-run phase.

## 13. UI Prompt

The `/ui` Personal Operator Console should show One-shot Operator Manual:

- when to consider
- when forbidden
- classify task
- run preflight
- approval-preview
- dry-run plan
- result intake
- stop rules
- go/no-go
- no real execution

## 14. Required Verification

```powershell
cmd /c pnpm run verify:phase264a-codex-one-shot-operator-manual
```

## 15. Boundary

This phase must not:

- Modify `legacy/`
- Create `PROJECT_CONTEXT.md`
- Do not add heavy dependencies
- Do not call real `codex exec`
- Do not execute codex command
- Do not create worktrees
- Do not connect workflow runner
- Do not automatically commit or push
- Do not change the default NVIDIA `/chat` mainline
- Do not promise unattended automatic development
- Do not treat approval-preview as execution authorization
- Do not write real API keys
- Do not describe dirty workspace as clean
- Do not describe readiness as execution completed

## 16. Final Conclusion

Phase 264A gives the operator a preview-only manual for one-shot readiness
without enabling real Codex execution.
