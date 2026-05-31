# Phase2132A-2143A Controlled Sept Tool Mutation

## Goal

Phase2132A-2143A extends the controlled local mutation line from six files to seven files while reusing the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled sept tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2121A-2131A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly seven existing source-file mutations.
- Targets only:
  - `tools/phase2091/generated-source-patch-target.mjs`
  - `tools/phase2092/apply-controlled-existing-tool-mutation.mjs`
  - `tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs`
  - `tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs`
  - `tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs`
  - `tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs`
  - `tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs`

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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support seven bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The sept mutation batch must prove:

- new Phase2137 target one emits `PHASE2137_SEPT_TOOL_TARGET_ONE_OK`
- new Phase2138 target two emits `PHASE2138_SEPT_TOOL_TARGET_TWO_OK`
- new Phase2139 target three emits `PHASE2139_SEPT_TOOL_TARGET_THREE_OK`
- new Phase2140 target four emits `PHASE2140_SEPT_TOOL_TARGET_FOUR_OK`
- new Phase2141 target five emits `PHASE2141_SEPT_TOOL_TARGET_FIVE_OK`
- new Phase2142 target six emits `PHASE2142_SEPT_TOOL_TARGET_SIX_OK`
- new Phase2143 target seven emits `PHASE2143_SEPT_TOOL_TARGET_SEVEN_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2132-2143-controlled-sept-tool-mutation
cmd /c pnpm run apply:phase2132-2143-controlled-sept-tool-mutation
cmd /c pnpm run smoke:phase2132-2143-controlled-sept-tool-mutation
cmd /c pnpm run verify:phase2132-2143-controlled-sept-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the seven target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into an eight-file bounded batch or a rollback replay audit batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
