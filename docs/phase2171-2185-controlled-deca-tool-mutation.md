# Phase2171A-2185A Controlled Deca Tool Mutation

## Goal

Phase2171A-2185A extends the controlled local mutation line from nine files to ten files while reusing the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled deca tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2157A-2170A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly ten existing source-file mutations.
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
  - `tools/phase2157_2170/apply-controlled-nonet-tool-mutation.mjs`

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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support ten bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The deca mutation batch must prove:
- new Phase2176 target one emits `PHASE2176_DECA_TOOL_TARGET_ONE_OK`
- new Phase2177 target two emits `PHASE2177_DECA_TOOL_TARGET_TWO_OK`
- new Phase2178 target three emits `PHASE2178_DECA_TOOL_TARGET_THREE_OK`
- new Phase2179 target four emits `PHASE2179_DECA_TOOL_TARGET_FOUR_OK`
- new Phase2180 target five emits `PHASE2180_DECA_TOOL_TARGET_FIVE_OK`
- new Phase2181 target six emits `PHASE2181_DECA_TOOL_TARGET_SIX_OK`
- new Phase2182 target seven emits `PHASE2182_DECA_TOOL_TARGET_SEVEN_OK`
- new Phase2183 target eight emits `PHASE2183_DECA_TOOL_TARGET_EIGHT_OK`
- new Phase2184 target nine emits `PHASE2184_DECA_TOOL_TARGET_NINE_OK`
- new Phase2185 target ten emits `PHASE2185_DECA_TOOL_TARGET_TEN_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2171-2185-controlled-deca-tool-mutation
cmd /c pnpm run apply:phase2171-2185-controlled-deca-tool-mutation
cmd /c pnpm run smoke:phase2171-2185-controlled-deca-tool-mutation
cmd /c pnpm run verify:phase2171-2185-controlled-deca-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the ten target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or an eleven-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
