# Phase2090A Controlled Patch Apply Gate

## Goal

Phase2090A turns the Phase2089A Codex patch proposal into one real, bounded docs-only file change.

The phase proves that the system can validate a generated unified diff, apply only the approved single-file addition, and preserve rollback evidence without opening general patch execution.

## Scope

- Requires Phase632 preflight.
- Requires Phase2089A sealed evidence.
- Reads only the Phase2089A proposal evidence file.
- Applies only `docs/phase2089-codex-generated-patch-proposal-target.md`.
- Refuses overwrite when the target already exists.
- Records rollback metadata for deleting the created file.
- Keeps `codexExecExecuted=false`.
- Keeps providerCallsMade=false.

## Boundaries

- default `/chat` unchanged.
- `/chat-gateway/execute` unchanged.
- provider runtime unchanged.
- codexExecExecuted=false.
- providerCallsMade=false.
- secretRead=false.
- envRead=false.
- authJsonRead=false.
- codexConfigModified=false.
- codexBaseUrlModified=false.
- deployExecuted=false.
- releaseExecuted=false.
- tagCreated=false.
- artifactUploaded=false.
- pushExecuted=false.
- commitCreated=false.
- legacyModified=false.
- projectContextCreated=false.
- workspaceCleanClaimed=false.

## Rollback

The rollback record is written to `apps/ai-gateway-service/evidence/phase2090-controlled-patch-apply-gate/rollback.json`.

The rollback action is intentionally narrow: delete the single file created by this phase. The phase does not execute rollback automatically because the apply verifier needs the target file to exist.

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run apply:phase2090-controlled-patch-apply-gate
cmd /c pnpm run verify:phase2090-controlled-patch-apply-gate
```

## Next Gate

The next phase can classify real source-code patch proposals, but it must remain behind explicit allowedFiles, rollback, no commit/push/deploy, and verifier gates.
