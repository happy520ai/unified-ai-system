# Phase2501A-2530A Controlled Twenty-Five Tool Mutation

## Goal

Phase2501A-2530A extends the controlled local mutation line from twenty-four files to twenty-five files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled twenty-five tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2472A-2500A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly twenty-five existing source-file mutations.
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
  - `tools/phase2319_2341/apply-controlled-eighteen-tool-mutation.mjs`
  - `tools/phase2342_2365/apply-controlled-nineteen-tool-mutation.mjs`
  - `tools/phase2366_2390/apply-controlled-twenty-tool-mutation.mjs`
  - `tools/phase2391_2416/apply-controlled-twenty-one-tool-mutation.mjs`
  - `tools/phase2417_2443/apply-controlled-twenty-two-tool-mutation.mjs`
  - `tools/phase2444_2471/apply-controlled-twenty-three-tool-mutation.mjs`
  - `tools/phase2472_2500/apply-controlled-twenty-four-tool-mutation.mjs`

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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support twenty-five bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The twenty-five mutation batch must prove:
- new Phase2506 target one emits `PHASE2506_TWENTY_FIVE_TOOL_TARGET_ONE_OK`
- new Phase2507 target two emits `PHASE2507_TWENTY_FIVE_TOOL_TARGET_TWO_OK`
- new Phase2508 target three emits `PHASE2508_TWENTY_FIVE_TOOL_TARGET_THREE_OK`
- new Phase2509 target four emits `PHASE2509_TWENTY_FIVE_TOOL_TARGET_FOUR_OK`
- new Phase2510 target five emits `PHASE2510_TWENTY_FIVE_TOOL_TARGET_FIVE_OK`
- new Phase2511 target six emits `PHASE2511_TWENTY_FIVE_TOOL_TARGET_SIX_OK`
- new Phase2512 target seven emits `PHASE2512_TWENTY_FIVE_TOOL_TARGET_SEVEN_OK`
- new Phase2513 target eight emits `PHASE2513_TWENTY_FIVE_TOOL_TARGET_EIGHT_OK`
- new Phase2514 target nine emits `PHASE2514_TWENTY_FIVE_TOOL_TARGET_NINE_OK`
- new Phase2515 target ten emits `PHASE2515_TWENTY_FIVE_TOOL_TARGET_TEN_OK`
- new Phase2516 target eleven emits `PHASE2516_TWENTY_FIVE_TOOL_TARGET_ELEVEN_OK`
- new Phase2517 target twelve emits `PHASE2517_TWENTY_FIVE_TOOL_TARGET_TWELVE_OK`
- new Phase2518 target thirteen emits `PHASE2518_TWENTY_FIVE_TOOL_TARGET_THIRTEEN_OK`
- new Phase2519 target fourteen emits `PHASE2519_TWENTY_FIVE_TOOL_TARGET_FOURTEEN_OK`
- new Phase2520 target fifteen emits `PHASE2520_TWENTY_FIVE_TOOL_TARGET_FIFTEEN_OK`
- new Phase2521 target sixteen emits `PHASE2521_TWENTY_FIVE_TOOL_TARGET_SIXTEEN_OK`
- new Phase2522 target seventeen emits `PHASE2522_TWENTY_FIVE_TOOL_TARGET_SEVENTEEN_OK`
- new Phase2523 target eighteen emits `PHASE2523_TWENTY_FIVE_TOOL_TARGET_EIGHTEEN_OK`
- new Phase2524 target nineteen emits `PHASE2524_TWENTY_FIVE_TOOL_TARGET_NINETEEN_OK`
- new Phase2525 target twenty emits `PHASE2525_TWENTY_FIVE_TOOL_TARGET_TWENTY_OK`
- new Phase2526 target twenty-one emits `PHASE2526_TWENTY_FIVE_TOOL_TARGET_TWENTY_ONE_OK`
- new Phase2527 target twenty-two emits `PHASE2527_TWENTY_FIVE_TOOL_TARGET_TWENTY_TWO_OK`
- new Phase2528 target twenty-three emits `PHASE2528_TWENTY_FIVE_TOOL_TARGET_TWENTY_THREE_OK`
- new Phase2529 target twenty-four emits `PHASE2529_TWENTY_FIVE_TOOL_TARGET_TWENTY_FOUR_OK`
- new Phase2530 target twenty-five emits `PHASE2530_TWENTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2501-2530-controlled-twenty-five-tool-mutation
cmd /c pnpm run apply:phase2501-2530-controlled-twenty-five-tool-mutation
cmd /c pnpm run smoke:phase2501-2530-controlled-twenty-five-tool-mutation
cmd /c pnpm run verify:phase2501-2530-controlled-twenty-five-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the twenty-five target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a twenty-six-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
