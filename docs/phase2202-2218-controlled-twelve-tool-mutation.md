# Phase2202A-2218A Controlled Twelve Tool Mutation

## Goal

Phase2202A-2218A extends the controlled local mutation line from eleven files to twelve files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled twelve tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2186A-2201A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly twelve existing source-file mutations.
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
  - `tools/phase2171_2185/apply-controlled-deca-tool-mutation.mjs`
  - `tools/phase2186_2201/apply-controlled-eleven-tool-mutation.mjs`

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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support twelve bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The twelve mutation batch must prove:
- new Phase2207 target one emits `PHASE2207_TWELVE_TOOL_TARGET_ONE_OK`
- new Phase2208 target two emits `PHASE2208_TWELVE_TOOL_TARGET_TWO_OK`
- new Phase2209 target three emits `PHASE2209_TWELVE_TOOL_TARGET_THREE_OK`
- new Phase2210 target four emits `PHASE2210_TWELVE_TOOL_TARGET_FOUR_OK`
- new Phase2211 target five emits `PHASE2211_TWELVE_TOOL_TARGET_FIVE_OK`
- new Phase2212 target six emits `PHASE2212_TWELVE_TOOL_TARGET_SIX_OK`
- new Phase2213 target seven emits `PHASE2213_TWELVE_TOOL_TARGET_SEVEN_OK`
- new Phase2214 target eight emits `PHASE2214_TWELVE_TOOL_TARGET_EIGHT_OK`
- new Phase2215 target nine emits `PHASE2215_TWELVE_TOOL_TARGET_NINE_OK`
- new Phase2216 target ten emits `PHASE2216_TWELVE_TOOL_TARGET_TEN_OK`
- new Phase2217 target eleven emits `PHASE2217_TWELVE_TOOL_TARGET_ELEVEN_OK`
- new Phase2218 target twelve emits `PHASE2218_TWELVE_TOOL_TARGET_TWELVE_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2202-2218-controlled-twelve-tool-mutation
cmd /c pnpm run apply:phase2202-2218-controlled-twelve-tool-mutation
cmd /c pnpm run smoke:phase2202-2218-controlled-twelve-tool-mutation
cmd /c pnpm run verify:phase2202-2218-controlled-twelve-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the twelve target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a thirteen-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
