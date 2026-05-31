# Phase2627A-2660A Controlled Twenty-Nine Tool Mutation

## Goal

Phase2627A-2660A extends the controlled local mutation line from twenty-eight files to twenty-nine files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled twenty-nine tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2594A-2626A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly twenty-nine existing source-file mutations.
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
  - `tools/phase2501_2530/apply-controlled-twenty-five-tool-mutation.mjs`
  - `tools/phase2531_2561/apply-controlled-twenty-six-tool-mutation.mjs`
  - `tools/phase2562_2593/apply-controlled-twenty-seven-tool-mutation.mjs`
  - `tools/phase2594_2626/apply-controlled-twenty-eight-tool-mutation.mjs`

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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support twenty-nine bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The twenty-nine mutation batch must prove:
- new Phase2632 target one emits `PHASE2632_TWENTY_NINE_TOOL_TARGET_ONE_OK`
- new Phase2633 target two emits `PHASE2633_TWENTY_NINE_TOOL_TARGET_TWO_OK`
- new Phase2634 target three emits `PHASE2634_TWENTY_NINE_TOOL_TARGET_THREE_OK`
- new Phase2635 target four emits `PHASE2635_TWENTY_NINE_TOOL_TARGET_FOUR_OK`
- new Phase2636 target five emits `PHASE2636_TWENTY_NINE_TOOL_TARGET_FIVE_OK`
- new Phase2637 target six emits `PHASE2637_TWENTY_NINE_TOOL_TARGET_SIX_OK`
- new Phase2638 target seven emits `PHASE2638_TWENTY_NINE_TOOL_TARGET_SEVEN_OK`
- new Phase2639 target eight emits `PHASE2639_TWENTY_NINE_TOOL_TARGET_EIGHT_OK`
- new Phase2640 target nine emits `PHASE2640_TWENTY_NINE_TOOL_TARGET_NINE_OK`
- new Phase2641 target ten emits `PHASE2641_TWENTY_NINE_TOOL_TARGET_TEN_OK`
- new Phase2642 target eleven emits `PHASE2642_TWENTY_NINE_TOOL_TARGET_ELEVEN_OK`
- new Phase2643 target twelve emits `PHASE2643_TWENTY_NINE_TOOL_TARGET_TWELVE_OK`
- new Phase2644 target thirteen emits `PHASE2644_TWENTY_NINE_TOOL_TARGET_THIRTEEN_OK`
- new Phase2645 target fourteen emits `PHASE2645_TWENTY_NINE_TOOL_TARGET_FOURTEEN_OK`
- new Phase2646 target fifteen emits `PHASE2646_TWENTY_NINE_TOOL_TARGET_FIFTEEN_OK`
- new Phase2647 target sixteen emits `PHASE2647_TWENTY_NINE_TOOL_TARGET_SIXTEEN_OK`
- new Phase2648 target seventeen emits `PHASE2648_TWENTY_NINE_TOOL_TARGET_SEVENTEEN_OK`
- new Phase2649 target eighteen emits `PHASE2649_TWENTY_NINE_TOOL_TARGET_EIGHTEEN_OK`
- new Phase2650 target nineteen emits `PHASE2650_TWENTY_NINE_TOOL_TARGET_NINETEEN_OK`
- new Phase2651 target twenty emits `PHASE2651_TWENTY_NINE_TOOL_TARGET_TWENTY_OK`
- new Phase2652 target twenty-one emits `PHASE2652_TWENTY_NINE_TOOL_TARGET_TWENTY_ONE_OK`
- new Phase2653 target twenty-two emits `PHASE2653_TWENTY_NINE_TOOL_TARGET_TWENTY_TWO_OK`
- new Phase2654 target twenty-three emits `PHASE2654_TWENTY_NINE_TOOL_TARGET_TWENTY_THREE_OK`
- new Phase2655 target twenty-four emits `PHASE2655_TWENTY_NINE_TOOL_TARGET_TWENTY_FOUR_OK`
- new Phase2656 target twenty-five emits `PHASE2656_TWENTY_NINE_TOOL_TARGET_TWENTY_FIVE_OK`
- new Phase2657 target twenty-six emits `PHASE2657_TWENTY_NINE_TOOL_TARGET_TWENTY_SIX_OK`
- new Phase2658 target twenty-seven emits `PHASE2658_TWENTY_NINE_TOOL_TARGET_TWENTY_SEVEN_OK`
- new Phase2659 target twenty-eight emits `PHASE2659_TWENTY_NINE_TOOL_TARGET_TWENTY_EIGHT_OK`
- new Phase2660 target twenty-nine emits `PHASE2660_TWENTY_NINE_TOOL_TARGET_TWENTY_NINE_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2627-2660-controlled-twenty-nine-tool-mutation
cmd /c pnpm run apply:phase2627-2660-controlled-twenty-nine-tool-mutation
cmd /c pnpm run smoke:phase2627-2660-controlled-twenty-nine-tool-mutation
cmd /c pnpm run verify:phase2627-2660-controlled-twenty-nine-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the twenty-nine target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a twenty-seven-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
