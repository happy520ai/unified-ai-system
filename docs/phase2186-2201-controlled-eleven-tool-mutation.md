# Phase2186A-2201A Controlled Eleven Tool Mutation

## Goal

Phase2186A-2201A extends the controlled local mutation line from ten files to eleven files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled eleven tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2171A-2185A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly eleven existing source-file mutations.
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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support eleven bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The eleven mutation batch must prove:
- new Phase2191 target one emits `PHASE2191_ELEVEN_TOOL_TARGET_ONE_OK`
- new Phase2192 target two emits `PHASE2192_ELEVEN_TOOL_TARGET_TWO_OK`
- new Phase2193 target three emits `PHASE2193_ELEVEN_TOOL_TARGET_THREE_OK`
- new Phase2194 target four emits `PHASE2194_ELEVEN_TOOL_TARGET_FOUR_OK`
- new Phase2195 target five emits `PHASE2195_ELEVEN_TOOL_TARGET_FIVE_OK`
- new Phase2196 target six emits `PHASE2196_ELEVEN_TOOL_TARGET_SIX_OK`
- new Phase2197 target seven emits `PHASE2197_ELEVEN_TOOL_TARGET_SEVEN_OK`
- new Phase2198 target eight emits `PHASE2198_ELEVEN_TOOL_TARGET_EIGHT_OK`
- new Phase2199 target nine emits `PHASE2199_ELEVEN_TOOL_TARGET_NINE_OK`
- new Phase2200 target ten emits `PHASE2200_ELEVEN_TOOL_TARGET_TEN_OK`
- new Phase2201 target eleven emits `PHASE2201_ELEVEN_TOOL_TARGET_ELEVEN_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2186-2201-controlled-eleven-tool-mutation
cmd /c pnpm run apply:phase2186-2201-controlled-eleven-tool-mutation
cmd /c pnpm run smoke:phase2186-2201-controlled-eleven-tool-mutation
cmd /c pnpm run verify:phase2186-2201-controlled-eleven-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the eleven target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a twelve-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
