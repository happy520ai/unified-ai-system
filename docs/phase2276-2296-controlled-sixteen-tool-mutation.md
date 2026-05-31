# Phase2276A-2296A Controlled Sixteen Tool Mutation

## Goal

Phase2276A-2296A extends the controlled local mutation line from fifteen files to sixteen files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled sixteen tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2256A-2275A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly sixteen existing source-file mutations.
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
  - `tools/phase2202_2218/apply-controlled-twelve-tool-mutation.mjs`
  - `tools/phase2219_2236/apply-controlled-thirteen-tool-mutation.mjs`
  - `tools/phase2237_2255/apply-controlled-fourteen-tool-mutation.mjs`
  - `tools/phase2256_2275/apply-controlled-fifteen-tool-mutation.mjs`

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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support sixteen bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The sixteen mutation batch must prove:
- new Phase2281 target one emits `PHASE2281_SIXTEEN_TOOL_TARGET_ONE_OK`
- new Phase2282 target two emits `PHASE2282_SIXTEEN_TOOL_TARGET_TWO_OK`
- new Phase2283 target three emits `PHASE2283_SIXTEEN_TOOL_TARGET_THREE_OK`
- new Phase2284 target four emits `PHASE2284_SIXTEEN_TOOL_TARGET_FOUR_OK`
- new Phase2285 target five emits `PHASE2285_SIXTEEN_TOOL_TARGET_FIVE_OK`
- new Phase2286 target six emits `PHASE2286_SIXTEEN_TOOL_TARGET_SIX_OK`
- new Phase2287 target seven emits `PHASE2287_SIXTEEN_TOOL_TARGET_SEVEN_OK`
- new Phase2288 target eight emits `PHASE2288_SIXTEEN_TOOL_TARGET_EIGHT_OK`
- new Phase2289 target nine emits `PHASE2289_SIXTEEN_TOOL_TARGET_NINE_OK`
- new Phase2290 target ten emits `PHASE2290_SIXTEEN_TOOL_TARGET_TEN_OK`
- new Phase2291 target eleven emits `PHASE2291_SIXTEEN_TOOL_TARGET_ELEVEN_OK`
- new Phase2292 target twelve emits `PHASE2292_SIXTEEN_TOOL_TARGET_TWELVE_OK`
- new Phase2293 target thirteen emits `PHASE2293_SIXTEEN_TOOL_TARGET_THIRTEEN_OK`
- new Phase2294 target fourteen emits `PHASE2294_SIXTEEN_TOOL_TARGET_FOURTEEN_OK`
- new Phase2295 target fifteen emits `PHASE2295_SIXTEEN_TOOL_TARGET_FIFTEEN_OK`
- new Phase2296 target sixteen emits `PHASE2296_SIXTEEN_TOOL_TARGET_SIXTEEN_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2276-2296-controlled-sixteen-tool-mutation
cmd /c pnpm run apply:phase2276-2296-controlled-sixteen-tool-mutation
cmd /c pnpm run smoke:phase2276-2296-controlled-sixteen-tool-mutation
cmd /c pnpm run verify:phase2276-2296-controlled-sixteen-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the sixteen target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a seventeen-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
