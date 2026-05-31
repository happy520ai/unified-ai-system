# Phase2101A-2110A Controlled Quad Tool Mutation

## Goal

Phase2101A-2110A takes the real low-risk tool-source mutation line one step further in two combined blocks:

- Phase2101A-2105A: extract a reusable `controlled mutation substrate` for bounded existing-file mutations.
- Phase2106A-2110A: use that substrate to execute the first controlled quad tool mutation batch.

This remains a real local-write phase, not a dry-run paper design. It must still stay outside default `/chat`, outside `/chat-gateway/execute`, outside provider runtime, and outside any paid provider path.

## Scope

- Requires Phase632 preflight.
- Requires Phase2096A-2100A sealed evidence.
- Adds a reusable helper:
  - `tools/phase2101_2110/controlled-mutation-substrate.mjs`
- Applies exactly four existing source-file mutations.
- Targets only:
  - `tools/phase2091/generated-source-patch-target.mjs`
  - `tools/phase2092/apply-controlled-existing-tool-mutation.mjs`
  - `tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs`
  - `tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs`
- Refuses target creation, deletion, rename, binary diff, unsafe path, and extra changed files.
- Requires `approvalRecord`, `allowedFiles`, `forbiddenPaths`, expected pre-mutation SHA values, `node --check`, local quad smoke, and rollback evidence.

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

## Substrate Requirements

The new substrate must centralize reusable logic for bounded existing-file mutation batches:

- plan validation
- forbidden path enforcement
- SHA gate checking
- unified diff parsing
- bounded hunk application
- idempotent already-applied detection
- `node --check` execution
- smoke evidence writing
- rollback evidence writing
- secret/unsafe text rejection

The substrate must stay generic enough for future `tools/phase*` bounded local mutations, but it must not become a free-form patch engine.

## Verification

The quad mutation batch must prove:

- Phase2091 target still emits `PHASE2091_SOURCE_PATCH_OK`.
- Phase2092 target still emits `PHASE2092_EXISTING_TOOL_MUTATION_OK`.
- Phase2093 target still emits `PHASE2093_BATCH_TOOL_TARGET_ONE_OK`.
- Phase2096 target still emits `PHASE2096_TRIPLE_TOOL_TARGET_ONE_OK`.
- New Phase2106 target one emits `PHASE2106_QUAD_TOOL_TARGET_ONE_OK`.
- New Phase2107 target two emits `PHASE2107_QUAD_TOOL_TARGET_TWO_OK`.
- New Phase2108 target three emits `PHASE2108_QUAD_TOOL_TARGET_THREE_OK`.
- New Phase2109 target four emits `PHASE2109_QUAD_TOOL_TARGET_FOUR_OK`.

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2101-2110-controlled-quad-tool-mutation
cmd /c pnpm run apply:phase2101-2110-controlled-quad-tool-mutation
cmd /c pnpm run smoke:phase2101-2110-controlled-quad-tool-mutation
cmd /c pnpm run verify:phase2101-2110-controlled-quad-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet. That red state is intentional.

## Next Gate

The next round may use the substrate to drive a five-file bounded tool mutation batch or a stricter rollback replay trial, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
