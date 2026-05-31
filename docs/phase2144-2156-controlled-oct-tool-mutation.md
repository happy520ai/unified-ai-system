# Phase2144A-2156A Controlled Oct Tool Mutation

## Goal

Phase2144A-2156A extends the controlled local mutation line from seven files to eight files while reusing the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled oct tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2132A-2143A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly eight existing source-file mutations.
- Targets only:
  - `tools/phase2091/generated-source-patch-target.mjs`
  - `tools/phase2092/apply-controlled-existing-tool-mutation.mjs`
  - `tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs`
  - `tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs`
  - `tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs`
  - `tools/phase2111_2120/apply-controlled-quint-tool-mutation.mjs`
  - `tools/phase2121_2131/apply-controlled-sext-tool-mutation.mjs`
  - `tools/phase2132_2143/apply-controlled-sept-tool-mutation.mjs`

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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support eight bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The oct mutation batch must prove:

- new Phase2149 target one emits `PHASE2149_OCT_TOOL_TARGET_ONE_OK`
- new Phase2150 target two emits `PHASE2150_OCT_TOOL_TARGET_TWO_OK`
- new Phase2151 target three emits `PHASE2151_OCT_TOOL_TARGET_THREE_OK`
- new Phase2152 target four emits `PHASE2152_OCT_TOOL_TARGET_FOUR_OK`
- new Phase2153 target five emits `PHASE2153_OCT_TOOL_TARGET_FIVE_OK`
- new Phase2154 target six emits `PHASE2154_OCT_TOOL_TARGET_SIX_OK`
- new Phase2155 target seven emits `PHASE2155_OCT_TOOL_TARGET_SEVEN_OK`
- new Phase2156 target eight emits `PHASE2156_OCT_TOOL_TARGET_EIGHT_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2144-2156-controlled-oct-tool-mutation
cmd /c pnpm run apply:phase2144-2156-controlled-oct-tool-mutation
cmd /c pnpm run smoke:phase2144-2156-controlled-oct-tool-mutation
cmd /c pnpm run verify:phase2144-2156-controlled-oct-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the eight target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a nine-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
