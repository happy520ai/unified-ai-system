# Phase2121A-2131A Controlled Sext Tool Mutation

## Goal

Phase2121A-2131A extends the controlled local mutation line from five files to six files while reusing the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled sext tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2111A-2120A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly six existing source-file mutations.
- Targets only:
  - `tools/phase2091/generated-source-patch-target.mjs`
  - `tools/phase2092/apply-controlled-existing-tool-mutation.mjs`
  - `tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs`
  - `tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs`
  - `tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs`
  - `tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs`

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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support six bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The sext mutation batch must prove:

- new Phase2126 target one emits `PHASE2126_SEXT_TOOL_TARGET_ONE_OK`
- new Phase2127 target two emits `PHASE2127_SEXT_TOOL_TARGET_TWO_OK`
- new Phase2128 target three emits `PHASE2128_SEXT_TOOL_TARGET_THREE_OK`
- new Phase2129 target four emits `PHASE2129_SEXT_TOOL_TARGET_FOUR_OK`
- new Phase2130 target five emits `PHASE2130_SEXT_TOOL_TARGET_FIVE_OK`
- new Phase2131 target six emits `PHASE2131_SEXT_TOOL_TARGET_SIX_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2121-2131-controlled-sext-tool-mutation
cmd /c pnpm run apply:phase2121-2131-controlled-sext-tool-mutation
cmd /c pnpm run smoke:phase2121-2131-controlled-sext-tool-mutation
cmd /c pnpm run verify:phase2121-2131-controlled-sext-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the six target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a seven-file bounded batch or a rollback replay audit batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
