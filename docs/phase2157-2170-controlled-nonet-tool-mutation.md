# Phase2157A-2170A Controlled Nonet Tool Mutation

## Goal

Phase2157A-2170A extends the controlled local mutation line from eight files to nine files while reusing the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled nonet tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2144A-2156A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly nine existing source-file mutations.
- Targets only:
  - `tools/phase2091/generated-source-patch-target.mjs`
  - `tools/phase2092/apply-controlled-existing-tool-mutation.mjs`
  - `tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs`
  - `tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs`
  - `tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs`
  - `tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs`
  - `tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs`
  - `tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs`
  - `tools/phase2144_2156/apply-controlled-oct-tool-mutation.mjs`

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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support nine bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The nonet mutation batch must prove:

- new Phase2162 target one emits `PHASE2162_NONET_TOOL_TARGET_ONE_OK`
- new Phase2163 target two emits `PHASE2163_NONET_TOOL_TARGET_TWO_OK`
- new Phase2164 target three emits `PHASE2164_NONET_TOOL_TARGET_THREE_OK`
- new Phase2165 target four emits `PHASE2165_NONET_TOOL_TARGET_FOUR_OK`
- new Phase2166 target five emits `PHASE2166_NONET_TOOL_TARGET_FIVE_OK`
- new Phase2167 target six emits `PHASE2167_NONET_TOOL_TARGET_SIX_OK`
- new Phase2168 target seven emits `PHASE2168_NONET_TOOL_TARGET_SEVEN_OK`
- new Phase2169 target eight emits `PHASE2169_NONET_TOOL_TARGET_EIGHT_OK`
- new Phase2170 target nine emits `PHASE2170_NONET_TOOL_TARGET_NINE_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2157-2170-controlled-nonet-tool-mutation
cmd /c pnpm run apply:phase2157-2170-controlled-nonet-tool-mutation
cmd /c pnpm run smoke:phase2157-2170-controlled-nonet-tool-mutation
cmd /c pnpm run verify:phase2157-2170-controlled-nonet-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the nine target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a ten-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
