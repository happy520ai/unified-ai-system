# Phase2001-GVC-Task-Queue-Runner

## Goal

Phase2001 adds a local dry-run task queue runner for the Governed Vibe Coding OS. It reads `docs/project-brain/next-actions.json`, validates each action through the Phase2000 risk gate, and writes an evidence ledger of queue decisions.

## Scope

Allowed:

- Read project-brain JSON files.
- Classify queued actions as `allowed`, `approval_required`, or `forbidden`.
- Mark L0/L1/L2 actions as dry-run planned when the risk gate allows them.
- Keep L3 actions approval-gated.
- Write sanitized evidence.

Forbidden:

- Real task execution.
- Provider calls.
- Secret, `.env`, `auth.json`, raw API key, or Authorization header reads.
- Deploy, release, tag, artifact upload, push, or commit.
- Runtime Provider mutation.
- Default `/chat` or `/chat-gateway/execute` modification.
- `legacy/` modification.
- `PROJECT_CONTEXT.md` modification.
- Workspace-clean, production-ready, or commercial-ready claims.

## Runner

`tools/gvc/run-task-queue-dry-run.mjs` exports `runTaskQueueDryRun()`.

The runner only produces a decision ledger:

- L0/L1/L2 allowed tasks become `dryRunPlanned=true`.
- L3 tasks remain `approval_required` and may generate approval packet paths.
- `realExecutionPerformed=false` for every queue entry.

## Evidence

Evidence is written to:

- `apps/ai-gateway-service/evidence/phase2001-gvc-task-queue-runner/task-queue-runner-result.json`

Required safety fields:

- `providerCallsMade=false`
- `secretRead=false`
- `deployReleasePerformed=false`
- `chatModified=false`
- `chatGatewayExecuteModified=false`
- `legacyModified=false`
- `projectContextModified=false`
- `workspaceCleanClaimed=false`

## Verification

```powershell
node --check tools/gvc/run-task-queue-dry-run.mjs
node --check tools/gvc/verify-gvc-task-queue-runner.mjs
pnpm run run:phase2001-gvc-task-queue-runner
pnpm run verify:phase2001-gvc-task-queue-runner
pnpm run verify:phase2000-gvc-os
pnpm run verify:phase107a-secret-safety
pnpm run verify:phase321a-workbench-product-recovery
pnpm -r --if-present check
```

UI smoke is not required because this phase does not change UI.
