# Phase2091A Controlled Source Patch Apply

## Goal

Phase2091A expands the real patch path from docs-only to a narrow source-code addition.

This is a real source patch: the runner validates a single-file unified diff, creates `tools/phase2091/generated-source-patch-target.mjs`, runs `node --check`, executes a local smoke command, and records rollback evidence.

## Scope

- Requires Phase632 preflight.
- Requires Phase2090A sealed evidence.
- Applies only `tools/phase2091/generated-source-patch-target.mjs`.
- Refuses overwrite when the target already exists.
- Allows only one new source file under `tools/phase2091/`.
- Records rollback metadata for deleting the created file.
- Keeps codexExecExecuted=false.
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

## Verification

The phase must prove three things:

- The source file was actually created.
- The file passes `node --check`.
- The file can run a local smoke command and emit `PHASE2091_SOURCE_PATCH_OK`.

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run apply:phase2091-controlled-source-patch-apply
cmd /c pnpm run smoke:phase2091-controlled-source-patch-apply
cmd /c pnpm run verify:phase2091-controlled-source-patch-apply
```

## Next Gate

The next phase can allow a controlled modification to an existing low-risk tool module, but it must remain behind explicit allowedFiles, rollback, no commit/push/deploy, no Provider call, and verifier gates.
