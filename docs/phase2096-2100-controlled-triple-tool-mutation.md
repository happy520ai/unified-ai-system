# Phase2096A-2100A Controlled Triple Tool Mutation

## Goal

Phase2096A-2100A expands the real source mutation path from two existing tool files to a controlled triple tool mutation.

This is a controlled triple tool mutation: one approval packet authorizes exactly three low-risk existing tool source mutations, each target must match its expected pre-mutation SHA, each mutation must come from a single-file unified diff, each target must pass `node --check`, and the batch must pass a local smoke that proves all three target markers.

## Scope

- Requires Phase632 preflight.
- Requires Phase2093A-2095A sealed evidence.
- Applies exactly three existing source-file mutations.
- Targets only:
  - `tools/phase2091/generated-source-patch-target.mjs`
  - `tools/phase2092/apply-controlled-existing-tool-mutation.mjs`
  - `tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs`
- Refuses target creation, deletion, rename, binary diff, unsafe path, and extra changed files.
- Requires `approvalRecord`, `allowedFiles`, and `forbiddenPaths`.
- Records rollback metadata for restoring all three previous target contents.
- Re-running the apply command is idempotent only when all three targets already
  contain the expected Phase2096/Phase2097/Phase2100 markers and still pass the
  same local `node --check` and triple smoke checks.
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

The triple mutation must prove:

- Phase2091 target still emits `PHASE2091_SOURCE_PATCH_OK`.
- Phase2092 target still supports Phase2092 local behavior and emits `PHASE2097_TRIPLE_TOOL_TARGET_TWO_OK`.
- Phase2093-2095 runner becomes import-safe and exports `buildPhase2100TripleMutationRuntimeStatus`.
- Phase2096 target one emits `PHASE2096_TRIPLE_TOOL_TARGET_ONE_OK`.
- Phase2100 seals the triple result with rollback evidence and verifier.

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run apply:phase2096-2100-controlled-triple-tool-mutation
cmd /c pnpm run smoke:phase2096-2100-controlled-triple-tool-mutation
cmd /c pnpm run verify:phase2096-2100-controlled-triple-tool-mutation
```

## Next Gate

The next phase can lift the triple mutation runner into a reusable controlled mutation substrate for low-risk `tools/phase*` files, but it must remain approval-bound, SHA-bound, rollback-bound, and verifier-bound.
