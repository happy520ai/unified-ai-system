# Phase2023-GVC-Runner-Command-Bridge-DryRun

## Goal

Phase2023 adds a dry-run command bridge for the GVC timed runner panel. Owner OS can express pause, resume, and stop command intent, but this phase only renders command previews and verifier evidence.

## Scope

- UI shows pause, resume, and stop.
- Click handling updates only the local page preview.
- Verifier covers pause, resume, and stop command previews.
- Evidence records `commandIntent`, `wouldWriteControlFile`, and `realWritePerformed=false`.

## Boundaries

- 不真实写控制文件.
- 不真实停止 runner.
- No process kill or process signal is sent.
- No background service is registered.
- No startup auto-run is registered.
- No Provider call is made.
- No secret is read.
- No deploy, release, tag, artifact upload, push, or commit is performed.
- `/chat` and `/chat-gateway/execute` are unchanged.
- `legacy/` and `PROJECT_CONTEXT.md` are unchanged.

## Command Preview Contract

Each command preview returns:

- `commandIntent`: `pause`, `resume`, or `stop`
- `wouldWriteControlFile=true`
- `realWritePerformed=false`
- `processSignalSent=false`
- `providerCallsMade=false`
- `secretRead=false`
- `deployExecuted=false`

The preview describes the control-file patch that would be written in a future approval-gated phase. Phase2023 never applies it.

## Verification

Run:

```powershell
pnpm run verify:phase2023-gvc-runner-command-bridge-dryrun
pnpm run smoke:phase308a-desktop-workbench-ui
pnpm run verify:phase107a-secret-safety
pnpm run verify:phase321a-workbench-product-recovery
pnpm -r --if-present check
```

## Evidence

Expected evidence:

- `apps/ai-gateway-service/evidence/phase2023-gvc-runner-command-bridge-dryrun/runner-command-bridge-dryrun-result.json`
- `apps/ai-gateway-service/evidence/phase2023-gvc-runner-command-bridge-dryrun/runner-command-bridge-dryrun-result.md`
