# Phase2732A-2768A Controlled Thirty-Two Tool Mutation

## Goal

Phase2732A-2768A extends the controlled local mutation line from thirty-one files to thirty-two files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled thirty-two tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2696A-2731A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly thirty-two existing source-file mutations.
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
  - `tools/phase2696_2731/apply-controlled-thirty-one-tool-mutation.mjs`

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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support thirty-two bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The thirty-two mutation batch must prove:
- new Phase2737 target one emits `PHASE2737_THIRTY_TWO_TOOL_TARGET_ONE_OK`
- new Phase2738 target two emits `PHASE2738_THIRTY_TWO_TOOL_TARGET_TWO_OK`
- new Phase2739 target three emits `PHASE2739_THIRTY_TWO_TOOL_TARGET_THREE_OK`
- new Phase2740 target four emits `PHASE2740_THIRTY_TWO_TOOL_TARGET_FOUR_OK`
- new Phase2741 target five emits `PHASE2741_THIRTY_TWO_TOOL_TARGET_FIVE_OK`
- new Phase2742 target six emits `PHASE2742_THIRTY_TWO_TOOL_TARGET_SIX_OK`
- new Phase2743 target seven emits `PHASE2743_THIRTY_TWO_TOOL_TARGET_SEVEN_OK`
- new Phase2744 target eight emits `PHASE2744_THIRTY_TWO_TOOL_TARGET_EIGHT_OK`
- new Phase2745 target nine emits `PHASE2745_THIRTY_TWO_TOOL_TARGET_NINE_OK`
- new Phase2746 target ten emits `PHASE2746_THIRTY_TWO_TOOL_TARGET_TEN_OK`
- new Phase2747 target eleven emits `PHASE2747_THIRTY_TWO_TOOL_TARGET_ELEVEN_OK`
- new Phase2748 target twelve emits `PHASE2748_THIRTY_TWO_TOOL_TARGET_TWELVE_OK`
- new Phase2749 target thirteen emits `PHASE2749_THIRTY_TWO_TOOL_TARGET_THIRTEEN_OK`
- new Phase2750 target fourteen emits `PHASE2750_THIRTY_TWO_TOOL_TARGET_FOURTEEN_OK`
- new Phase2751 target fifteen emits `PHASE2751_THIRTY_TWO_TOOL_TARGET_FIFTEEN_OK`
- new Phase2752 target sixteen emits `PHASE2752_THIRTY_TWO_TOOL_TARGET_SIXTEEN_OK`
- new Phase2753 target seventeen emits `PHASE2753_THIRTY_TWO_TOOL_TARGET_SEVENTEEN_OK`
- new Phase2754 target eighteen emits `PHASE2754_THIRTY_TWO_TOOL_TARGET_EIGHTEEN_OK`
- new Phase2755 target nineteen emits `PHASE2755_THIRTY_TWO_TOOL_TARGET_NINETEEN_OK`
- new Phase2756 target twenty emits `PHASE2756_THIRTY_TWO_TOOL_TARGET_TWENTY_OK`
- new Phase2757 target twenty-one emits `PHASE2757_THIRTY_TWO_TOOL_TARGET_TWENTY_ONE_OK`
- new Phase2758 target twenty-two emits `PHASE2758_THIRTY_TWO_TOOL_TARGET_TWENTY_TWO_OK`
- new Phase2759 target twenty-three emits `PHASE2759_THIRTY_TWO_TOOL_TARGET_TWENTY_THREE_OK`
- new Phase2760 target twenty-four emits `PHASE2760_THIRTY_TWO_TOOL_TARGET_TWENTY_FOUR_OK`
- new Phase2761 target twenty-five emits `PHASE2761_THIRTY_TWO_TOOL_TARGET_TWENTY_FIVE_OK`
- new Phase2762 target twenty-six emits `PHASE2762_THIRTY_TWO_TOOL_TARGET_TWENTY_SIX_OK`
- new Phase2763 target twenty-seven emits `PHASE2763_THIRTY_TWO_TOOL_TARGET_TWENTY_SEVEN_OK`
- new Phase2764 target twenty-eight emits `PHASE2764_THIRTY_TWO_TOOL_TARGET_TWENTY_EIGHT_OK`
- new Phase2765 target twenty-nine emits `PHASE2765_THIRTY_TWO_TOOL_TARGET_TWENTY_NINE_OK`
- new Phase2766 target thirty emits `PHASE2766_THIRTY_TWO_TOOL_TARGET_THIRTY_OK`
- new Phase2767 target thirty-one emits `PHASE2767_THIRTY_TWO_TOOL_TARGET_THIRTY_ONE_OK`
- new Phase2768 target thirty-two emits `PHASE2768_THIRTY_TWO_TOOL_TARGET_THIRTY_TWO_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2732-2768-controlled-thirty-two-tool-mutation
cmd /c pnpm run apply:phase2732-2768-controlled-thirty-two-tool-mutation
cmd /c pnpm run smoke:phase2732-2768-controlled-thirty-two-tool-mutation
cmd /c pnpm run verify:phase2732-2768-controlled-thirty-two-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the thirty-two target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a thirty-three-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
