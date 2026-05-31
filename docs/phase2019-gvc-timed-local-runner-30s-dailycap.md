# Phase2019-GVC-Timed-Local-Runner-30s-DailyCap

## Goal

Add a manually started local timed GVC runner. It attempts one allowed L0/L1/L2 dry-run task per loop, waits 30 seconds between loops by default, and stops or idles after 500 loops per local day.

## Runtime Policy

- `intervalMs=30000`
- `dailyLoopLimit=500`
- `maxTasksPerLoop=1`
- `dryRunOnly=true`
- Owner manual start only
- Ctrl+C writes graceful shutdown evidence
- No Windows Task Scheduler registration
- No startup auto-run

## Safety Boundary

The runner must not:

- Call Providers.
- Read raw secrets, `.env`, `auth.json`, API keys, or Authorization headers.
- Deploy, release, tag, upload artifacts, push, or commit.
- Modify `legacy/`.
- Modify `PROJECT_CONTEXT.md`.
- Modify `/chat` or `/chat-gateway/execute`.
- Claim production readiness or workspace clean.

## Loop Behavior

Each loop:

1. Reads `docs/project-brain/next-actions.json`.
2. Selects at most one allowed L0/L1/L2 task.
3. Records approval-required and forbidden tasks as skipped.
4. Runs:
   - `pnpm run verify:phase2000-gvc-os`
   - `pnpm run verify:phase107a-secret-safety`
   - `pnpm run verify:phase321a-workbench-product-recovery`
5. Writes loop evidence to `apps/ai-gateway-service/evidence/phase2019-gvc-timed-local-runner/loop-<date>-<n>.json`.
6. Updates `docs/project-brain/timed-runner-state.json`.

If two verifier failures occur consecutively, the runner stops.

## Manual Start

```powershell
pnpm run gvc:timed-runner
```

## Test Mode

```powershell
pnpm run gvc:timed-runner -- --intervalMs=1000 --dailyLoopLimit=3 --maxTasksPerLoop=1 --dryRunOnly=true --testMode=true
```

## Stop

Press `Ctrl+C`. The runner writes graceful shutdown evidence before exiting.
