# Personal Live Trial

Phase 241A records a preview-only live self-use trial for the personal value
line. It uses the Phase 237A Personal Operator Console, Phase 238A Daily
Workflow, Phase 239A Project Knowledge Pack, and Phase 240A Decision Dashboard.

It does not call real `codex exec`, does not create worktrees, does not connect
workflow runner, does not commit or push, and does not claim production-grade
vector RAG or GraphRAG.

## 1. Live Trial Purpose

The trial proves that the operator can manually move from current-state review
to a bounded next task without adding real execution capability.

Preview-only safety state:

- preview-only
- manual handoff only
- real Codex exec disabled; codexExecInvoked=false
- executionEnabled=false
- no worktree creation
- no workflow runner
- no auto commit/push
- approval-preview is not execution permission

Expected live-trial result:

- The operator can read current project state.
- The operator can identify blocker and next action.
- The operator can generate a bounded Next Codex Task.
- The operator can review a Codex result manually.
- The operator can verify evidence before treating a result as sealed.
- The operator can stop when the next action crosses preview-only boundaries.

## 2. Real Use Order After Opening The System

Use this order after starting the local system and opening `/ui`:

1. Open the Personal Operator Console.
2. Read Current project status.
3. Read Current blocker.
4. Read Recommended next step.
5. Read Agent Workforce / Codex Bridge / Knowledge Base status.
6. Read Daily Workflow.
7. Read Project Knowledge Pack prompts.
8. Read Decision Dashboard.
9. Decide whether to generate a Next Codex Task.
10. If a result exists, review it before refreshing evidence.

## 3. Reading Personal Operator Console

Read the Personal Operator Console as the daily home page:

- Current project status: tells what the system can help with today.
- Current blocker: names dirty workspace, verification failure, evidence gap,
  or boundary risk.
- Recommended next step: gives the smallest useful action.
- Common verification commands: shows the commands needed before sealing.
- Status cards: show Agent Workforce, Codex Bridge, and Knowledge Base limits.

Do not treat the console as an execution panel. It is guidance only.

## 4. Using Daily Workflow

Use Daily Workflow as the runbook:

- Today Start: start with status and health checks.
- Next Codex Task: write one bounded manual handoff.
- Review Result: inspect scope, files, claims, evidence, and commands.
- Verify Evidence: run the matching verifier and regressions.
- Stop / Decide Next: record whether to continue or pause.

## 5. Querying Project Knowledge Pack

Use Project Knowledge Pack to answer narrow questions:

- What is the current project status?
- What is the current blocker?
- Which phase is the latest sealed personal value phase?
- Which capabilities are preview-only?
- Which evidence file proves the phase?
- Which verification commands are required?
- Why is commercial packaging paused?

Prefer current personal docs and current evidence over old commercial reports,
old evidence, or future-roadmap notes.

## 6. Using Decision Dashboard

Use Decision Dashboard to choose the next action:

- Check current status dimensions.
- Classify the blocker.
- Compare Option A/B/C.
- Check Risk / Boundary.
- Decide whether the task is Codex-ready.
- Decide Stop / Continue.

If the next action needs real execution, workflow runner, worktree, commit,
push, production vector RAG, or GraphRAG, stop and require a new explicit phase.

## 7. Generating Next Codex Task

Generate a Next Codex Task only when:

- The goal is one concrete self-use improvement.
- The allowed file range is explicit.
- The blocked scope is explicit.
- Required verification commands are listed.
- Default commit/push is No.
- Default real execution is No.

The handoff should include:

- Goal
- Boundary
- Allowed modification range
- Verification commands
- Output format
- Evidence expectations
- Stop condition

## 8. Reviewing Codex Result

When a Codex result comes back:

1. Read the claimed summary.
2. Compare changed files against allowed scope.
3. Check whether `legacy/` changed.
4. Check whether `PROJECT_CONTEXT.md` was created.
5. Check whether commit/push was attempted.
6. Check whether real `codex exec`, worktree, or workflow runner was connected.
7. Check whether evidence was refreshed only after verification passed.
8. Check whether preview-only was overstated as production-ready.

## 9. Confirming Evidence And Verification

Before calling a result sealed:

- Run the matching phase verifier.
- Run required regression commands.
- Confirm evidence `.json` status is `passed`.
- Confirm evidence `.md` exists.
- Confirm safety fields show disabled execution, runner, workflow run,
  worktree, commit, push, and production RAG claims.
- Do not refresh or cite evidence from a failed or skipped result as sealed.

## 10. Stop Or Continue

Continue only when:

- Verification passed.
- Evidence exists.
- The next task is bounded.
- The workspace ownership is clear enough for the next edit.
- The task improves personal operator value.

Stop when:

- Any required verification fails.
- Evidence is missing or stale.
- The next action crosses preview-only boundaries.
- The next action is commercial packaging while personal value remains the
  active priority.
- Dirty workspace overlap makes the next edit unsafe.

## 11. Dirty Workspace Handling

The live trial must not describe a dirty workspace as clean.

When the workspace is dirty:

- Treat existing unrelated changes as user-owned.
- Do not revert unrelated files.
- Read overlapping files before editing.
- Keep the next action small.
- Record dirty workspace as a blocker or caution when it affects the next
  task.
- Do not commit or push by default.

## 12. UI Live Trial Prompt

The `/ui` Personal Operator Console should show:

- Start live trial
- Read current state
- Decide next action
- Generate handoff
- Review result
- Verify evidence
- Stop or continue

## 13. Required Verification Commands

```powershell
cmd /c pnpm run verify:phase241a-personal-live-trial
cmd /c pnpm run verify:phase240a-personal-decision-dashboard
cmd /c pnpm run verify:phase239a-personal-project-knowledge-pack
cmd /c pnpm run verify:phase238a-personal-daily-workflow
cmd /c pnpm run verify:phase237a-personal-operator-console
cmd /c pnpm run verify:phase199a-real-ui-trial-runtime-sync
cmd /c pnpm run verify:phase107a-secret-safety
cmd /c pnpm run verify:phase105a-user-journey
cmd /c pnpm run health:phase12a
cmd /c pnpm run doctor:phase13a
cmd /c pnpm -r --if-present check
```

## 14. Phase 241A Boundary

This phase must not:

- Modify `legacy/`
- Create `PROJECT_CONTEXT.md`
- Do not add heavy dependencies
- Do not call real `codex exec`
- Do not create worktrees
- Do not connect workflow runner
- Do not automatically commit or push
- Do not change the default NVIDIA `/chat` mainline
- Do not promise unattended automatic development
- Do not promise production-grade vector RAG or GraphRAG
- Do not describe preview-only capability as production-ready
- Do not write real API keys
- Do not treat approval-preview as execution authorization
- Do not describe dirty workspace as clean
- Do not forge phase evidence

## 15. Final Conclusion

Phase 241A proves the self-use line can be tried manually end to end as a
preview-only operator workflow. It does not execute work automatically and does
not seal any real Agent execution capability.
