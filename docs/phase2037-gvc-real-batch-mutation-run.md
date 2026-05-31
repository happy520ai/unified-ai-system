# Phase2037 GVC Real Batch Mutation Run

## Goal

Run the timed GVC runner with low-risk autonomous mutation enabled by owner approval.

## Required Command

```powershell
pnpm run gvc:timed-runner -- --intervalMs=1000 --dailyLoopLimit=10 --maxTasksPerLoop=1 --dryRunOnly=false --testMode=false
```

## Safety Boundary

- Requires `docs/approvals/gvc-low-risk-autonomous-mutation-approval.json`.
- Executes at most one mutation per loop.
- Does not call Provider.
- Does not read raw secret.
- Does not deploy, release, tag, upload, push, or commit.
- Does not modify `/chat`, `/chat-gateway/execute`, `legacy/`, or `PROJECT_CONTEXT.md`.

