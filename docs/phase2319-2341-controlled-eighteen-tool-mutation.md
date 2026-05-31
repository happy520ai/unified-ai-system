# Phase2319A-2341A Controlled Eighteen Tool Mutation

## Goal

Phase2319A-2341A extends the controlled local mutation line from seventeen files to eighteen files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled eighteen tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2297A-2318A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly eighteen existing source-file mutations.
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
  - `tools/phase2276_2296/apply-controlled-sixteen-tool-mutation.mjs`
  - `tools/phase2297_2318/apply-controlled-seventeen-tool-mutation.mjs`

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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support eighteen bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The eighteen mutation batch must prove:
- new Phase2324 target one emits `PHASE2324_EIGHTEEN_TOOL_TARGET_ONE_OK`
- new Phase2325 target two emits `PHASE2325_EIGHTEEN_TOOL_TARGET_TWO_OK`
- new Phase2326 target three emits `PHASE2326_EIGHTEEN_TOOL_TARGET_THREE_OK`
- new Phase2327 target four emits `PHASE2327_EIGHTEEN_TOOL_TARGET_FOUR_OK`
- new Phase2328 target five emits `PHASE2328_EIGHTEEN_TOOL_TARGET_FIVE_OK`
- new Phase2329 target six emits `PHASE2329_EIGHTEEN_TOOL_TARGET_SIX_OK`
- new Phase2330 target seven emits `PHASE2330_EIGHTEEN_TOOL_TARGET_SEVEN_OK`
- new Phase2331 target eight emits `PHASE2331_EIGHTEEN_TOOL_TARGET_EIGHT_OK`
- new Phase2332 target nine emits `PHASE2332_EIGHTEEN_TOOL_TARGET_NINE_OK`
- new Phase2333 target ten emits `PHASE2333_EIGHTEEN_TOOL_TARGET_TEN_OK`
- new Phase2334 target eleven emits `PHASE2334_EIGHTEEN_TOOL_TARGET_ELEVEN_OK`
- new Phase2335 target twelve emits `PHASE2335_EIGHTEEN_TOOL_TARGET_TWELVE_OK`
- new Phase2336 target thirteen emits `PHASE2336_EIGHTEEN_TOOL_TARGET_THIRTEEN_OK`
- new Phase2337 target fourteen emits `PHASE2337_EIGHTEEN_TOOL_TARGET_FOURTEEN_OK`
- new Phase2338 target fifteen emits `PHASE2338_EIGHTEEN_TOOL_TARGET_FIFTEEN_OK`
- new Phase2339 target sixteen emits `PHASE2339_EIGHTEEN_TOOL_TARGET_SIXTEEN_OK`
- new Phase2340 target seventeen emits `PHASE2340_EIGHTEEN_TOOL_TARGET_SEVENTEEN_OK`
- new Phase2341 target eighteen emits `PHASE2341_EIGHTEEN_TOOL_TARGET_EIGHTEEN_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2319-2341-controlled-eighteen-tool-mutation
cmd /c pnpm run apply:phase2319-2341-controlled-eighteen-tool-mutation
cmd /c pnpm run smoke:phase2319-2341-controlled-eighteen-tool-mutation
cmd /c pnpm run verify:phase2319-2341-controlled-eighteen-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the eighteen target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a nineteen-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
