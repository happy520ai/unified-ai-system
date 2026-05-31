# Phase2696A-2731A Controlled Thirty-One Tool Mutation

## Goal

Phase2696A-2731A extends the controlled local mutation line from thirty files to thirty-one files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled thirty-one tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2661A-2695A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly thirty-one existing source-file mutations.
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
  - `tools/phase2627_2660/apply-controlled-twenty-nine-tool-mutation.mjs`
  - `tools/phase2661_2695/apply-controlled-thirty-tool-mutation.mjs`

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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support thirty-one bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The thirty-one mutation batch must prove:
- new Phase2701 target one emits `PHASE2701_THIRTY_ONE_TOOL_TARGET_ONE_OK`
- new Phase2702 target two emits `PHASE2702_THIRTY_ONE_TOOL_TARGET_TWO_OK`
- new Phase2703 target three emits `PHASE2703_THIRTY_ONE_TOOL_TARGET_THREE_OK`
- new Phase2704 target four emits `PHASE2704_THIRTY_ONE_TOOL_TARGET_FOUR_OK`
- new Phase2705 target five emits `PHASE2705_THIRTY_ONE_TOOL_TARGET_FIVE_OK`
- new Phase2706 target six emits `PHASE2706_THIRTY_ONE_TOOL_TARGET_SIX_OK`
- new Phase2707 target seven emits `PHASE2707_THIRTY_ONE_TOOL_TARGET_SEVEN_OK`
- new Phase2708 target eight emits `PHASE2708_THIRTY_ONE_TOOL_TARGET_EIGHT_OK`
- new Phase2709 target nine emits `PHASE2709_THIRTY_ONE_TOOL_TARGET_NINE_OK`
- new Phase2710 target ten emits `PHASE2710_THIRTY_ONE_TOOL_TARGET_TEN_OK`
- new Phase2711 target eleven emits `PHASE2711_THIRTY_ONE_TOOL_TARGET_ELEVEN_OK`
- new Phase2712 target twelve emits `PHASE2712_THIRTY_ONE_TOOL_TARGET_TWELVE_OK`
- new Phase2713 target thirteen emits `PHASE2713_THIRTY_ONE_TOOL_TARGET_THIRTEEN_OK`
- new Phase2714 target fourteen emits `PHASE2714_THIRTY_ONE_TOOL_TARGET_FOURTEEN_OK`
- new Phase2715 target fifteen emits `PHASE2715_THIRTY_ONE_TOOL_TARGET_FIFTEEN_OK`
- new Phase2716 target sixteen emits `PHASE2716_THIRTY_ONE_TOOL_TARGET_SIXTEEN_OK`
- new Phase2717 target seventeen emits `PHASE2717_THIRTY_ONE_TOOL_TARGET_SEVENTEEN_OK`
- new Phase2718 target eighteen emits `PHASE2718_THIRTY_ONE_TOOL_TARGET_EIGHTEEN_OK`
- new Phase2719 target nineteen emits `PHASE2719_THIRTY_ONE_TOOL_TARGET_NINETEEN_OK`
- new Phase2720 target twenty emits `PHASE2720_THIRTY_ONE_TOOL_TARGET_TWENTY_OK`
- new Phase2721 target twenty-one emits `PHASE2721_THIRTY_ONE_TOOL_TARGET_TWENTY_ONE_OK`
- new Phase2722 target twenty-two emits `PHASE2722_THIRTY_ONE_TOOL_TARGET_TWENTY_TWO_OK`
- new Phase2723 target twenty-three emits `PHASE2723_THIRTY_ONE_TOOL_TARGET_TWENTY_THREE_OK`
- new Phase2724 target twenty-four emits `PHASE2724_THIRTY_ONE_TOOL_TARGET_TWENTY_FOUR_OK`
- new Phase2725 target twenty-five emits `PHASE2725_THIRTY_ONE_TOOL_TARGET_TWENTY_FIVE_OK`
- new Phase2726 target twenty-six emits `PHASE2726_THIRTY_ONE_TOOL_TARGET_TWENTY_SIX_OK`
- new Phase2727 target twenty-seven emits `PHASE2727_THIRTY_ONE_TOOL_TARGET_TWENTY_SEVEN_OK`
- new Phase2728 target twenty-eight emits `PHASE2728_THIRTY_ONE_TOOL_TARGET_TWENTY_EIGHT_OK`
- new Phase2729 target twenty-nine emits `PHASE2729_THIRTY_ONE_TOOL_TARGET_TWENTY_NINE_OK`
- new Phase2730 target thirty emits `PHASE2730_THIRTY_ONE_TOOL_TARGET_THIRTY_OK`
- new Phase2731 target thirty-one emits `PHASE2731_THIRTY_ONE_TOOL_TARGET_THIRTY_ONE_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2696-2731-controlled-thirty-one-tool-mutation
cmd /c pnpm run apply:phase2696-2731-controlled-thirty-one-tool-mutation
cmd /c pnpm run smoke:phase2696-2731-controlled-thirty-one-tool-mutation
cmd /c pnpm run verify:phase2696-2731-controlled-thirty-one-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the thirty-one target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a thirty-two-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
