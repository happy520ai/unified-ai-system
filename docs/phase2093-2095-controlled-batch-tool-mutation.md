# Phase2093A-2095A Controlled Batch Tool Mutation

## Goal

Phase2093A-2095A expands the real source mutation path from one existing tool file to a controlled batch tool mutation.

This is a controlled batch tool mutation: one approval packet authorizes exactly two low-risk existing tool source mutations, each target must match its expected pre-mutation SHA, each mutation must come from a single-file unified diff, each target must pass `node --check`, and the batch must pass a local smoke that proves both target markers.

## Scope

- Requires Phase632 preflight.
- Requires Phase2092A sealed evidence.
- Applies exactly two existing source-file mutations.
- Targets only:
  - `tools/phase2091/generated-source-patch-target.mjs`
  - `tools/phase2092/apply-controlled-existing-tool-mutation.mjs`
- Refuses target creation, deletion, rename, binary diff, unsafe path, and extra changed files.
- Requires `approvalRecord`, `allowedFiles`, and `forbiddenPaths`.
- Records rollback metadata for restoring both previous target contents.
- Re-running the apply command is idempotent only when both targets already
  contain the expected Phase2093/Phase2094 markers and still pass the same
  local `node --check` and batch smoke checks.
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

The batch must prove:

- Phase2091 target still emits `PHASE2091_SOURCE_PATCH_OK`.
- Phase2092 target still supports Phase2092 local behavior.
- Phase2093 target one emits `PHASE2093_BATCH_TOOL_TARGET_ONE_OK`.
- Phase2094 target two exports `buildPhase2094BatchMutationRuntimeStatus`.
- Phase2095 seals the batch result with rollback evidence and verifier.

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run apply:phase2093-2095-controlled-batch-tool-mutation
cmd /c pnpm run smoke:phase2093-2095-controlled-batch-tool-mutation
cmd /c pnpm run verify:phase2093-2095-controlled-batch-tool-mutation
```

## Next Gate

The next phase can lift the batch mutation runner into a reusable controlled patch substrate for low-risk `tools/phase*` files, but it must remain approval-bound, SHA-bound, rollback-bound, and verifier-bound.
