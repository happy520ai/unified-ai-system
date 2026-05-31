# Phase2021-GVC-Owner-Control-Panel

## Goal

Add an owner-editable control file for the local timed GVC runner so the owner can pause, resume, or request a graceful stop without changing code.

## Scope

- Adds `docs/project-brain/runner-control.json`.
- Adds a local reader in `tools/gvc/read-runner-control.mjs`.
- Updates `tools/gvc/run-timed-local-runner.mjs` to read the control file on every loop.
- Adds `tools/gvc/verify-runner-control.mjs` for normal, paused, and stop-requested dry-run coverage.

## Control Contract

```json
{
  "paused": false,
  "stopRequested": false,
  "maxTasksPerLoop": 1,
  "dryRunOnly": true,
  "noProvider": true,
  "noSecret": true,
  "noDeploy": true
}
```

## Behavior

- `paused=true`: the runner writes idle evidence and does not select or execute a task.
- `stopRequested=true`: the runner writes stopped evidence, updates state as a graceful shutdown, and exits.
- `maxTasksPerLoop`: capped at `1` for Phase2021.
- `dryRunOnly=true`: required. Unsafe changes block the loop.
- `noProvider=true`: provider operations are blocked.
- `noSecret=true`: secret/auth file operations are blocked.
- `noDeploy=true`: deploy, release, tag, artifact upload, push, and commit operations are blocked.

## Boundary

- No Provider call.
- No raw secret read.
- No deploy, release, tag, artifact upload, push, or commit.
- No Windows Task Scheduler registration.
- No startup auto-run registration.
- No `/chat` modification.
- No `/chat-gateway/execute` modification.
- No `legacy/` modification.
- No `PROJECT_CONTEXT.md` modification.

## Verification

```powershell
node --check tools/gvc/read-runner-control.mjs
node --check tools/gvc/run-timed-local-runner.mjs
node --check tools/gvc/verify-runner-control.mjs
pnpm run verify:phase2021-gvc-owner-control-panel
pnpm run verify:phase107a-secret-safety
pnpm run verify:phase321a-workbench-product-recovery
pnpm -r --if-present check
```

## Evidence

- `apps/ai-gateway-service/evidence/phase2021-gvc-owner-control-panel/runner-control-result.json`
- Phase2019 loop evidence is reused for per-loop control behavior snapshots.
