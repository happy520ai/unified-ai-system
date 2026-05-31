# Phase2846A-2885A Controlled Thirty-Five Tool Mutation

## Goal

Phase2846A-2885A extends the controlled local mutation line from thirty-four files to thirty-five files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled thirty-five tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2807A-2845A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly thirty-five existing source-file mutations.
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
  - `tools/phase2732_2768/apply-controlled-thirty-two-tool-mutation.mjs`
  - `tools/phase2769_2806/apply-controlled-thirty-three-tool-mutation.mjs`
  - `tools/phase2807_2845/apply-controlled-thirty-four-tool-mutation.mjs`

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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support thirty-five bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The thirty-five mutation batch must prove:
- new Phase2851 target one emits `PHASE2851_THIRTY_FIVE_TOOL_TARGET_ONE_OK`
- new Phase2852 target two emits `PHASE2852_THIRTY_FIVE_TOOL_TARGET_TWO_OK`
- new Phase2853 target three emits `PHASE2853_THIRTY_FIVE_TOOL_TARGET_THREE_OK`
- new Phase2854 target four emits `PHASE2854_THIRTY_FIVE_TOOL_TARGET_FOUR_OK`
- new Phase2855 target five emits `PHASE2855_THIRTY_FIVE_TOOL_TARGET_FIVE_OK`
- new Phase2856 target six emits `PHASE2856_THIRTY_FIVE_TOOL_TARGET_SIX_OK`
- new Phase2857 target seven emits `PHASE2857_THIRTY_FIVE_TOOL_TARGET_SEVEN_OK`
- new Phase2858 target eight emits `PHASE2858_THIRTY_FIVE_TOOL_TARGET_EIGHT_OK`
- new Phase2859 target nine emits `PHASE2859_THIRTY_FIVE_TOOL_TARGET_NINE_OK`
- new Phase2860 target ten emits `PHASE2860_THIRTY_FIVE_TOOL_TARGET_TEN_OK`
- new Phase2861 target eleven emits `PHASE2861_THIRTY_FIVE_TOOL_TARGET_ELEVEN_OK`
- new Phase2862 target twelve emits `PHASE2862_THIRTY_FIVE_TOOL_TARGET_TWELVE_OK`
- new Phase2863 target thirteen emits `PHASE2863_THIRTY_FIVE_TOOL_TARGET_THIRTEEN_OK`
- new Phase2864 target fourteen emits `PHASE2864_THIRTY_FIVE_TOOL_TARGET_FOURTEEN_OK`
- new Phase2865 target fifteen emits `PHASE2865_THIRTY_FIVE_TOOL_TARGET_FIFTEEN_OK`
- new Phase2866 target sixteen emits `PHASE2866_THIRTY_FIVE_TOOL_TARGET_SIXTEEN_OK`
- new Phase2867 target seventeen emits `PHASE2867_THIRTY_FIVE_TOOL_TARGET_SEVENTEEN_OK`
- new Phase2868 target eighteen emits `PHASE2868_THIRTY_FIVE_TOOL_TARGET_EIGHTEEN_OK`
- new Phase2869 target nineteen emits `PHASE2869_THIRTY_FIVE_TOOL_TARGET_NINETEEN_OK`
- new Phase2870 target twenty emits `PHASE2870_THIRTY_FIVE_TOOL_TARGET_TWENTY_OK`
- new Phase2871 target twenty-one emits `PHASE2871_THIRTY_FIVE_TOOL_TARGET_TWENTY_ONE_OK`
- new Phase2872 target twenty-two emits `PHASE2872_THIRTY_FIVE_TOOL_TARGET_TWENTY_TWO_OK`
- new Phase2873 target twenty-three emits `PHASE2873_THIRTY_FIVE_TOOL_TARGET_TWENTY_THREE_OK`
- new Phase2874 target twenty-four emits `PHASE2874_THIRTY_FIVE_TOOL_TARGET_TWENTY_FOUR_OK`
- new Phase2875 target twenty-five emits `PHASE2875_THIRTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK`
- new Phase2876 target twenty-six emits `PHASE2876_THIRTY_FIVE_TOOL_TARGET_TWENTY_SIX_OK`
- new Phase2877 target twenty-seven emits `PHASE2877_THIRTY_FIVE_TOOL_TARGET_TWENTY_SEVEN_OK`
- new Phase2878 target twenty-eight emits `PHASE2878_THIRTY_FIVE_TOOL_TARGET_TWENTY_EIGHT_OK`
- new Phase2879 target twenty-nine emits `PHASE2879_THIRTY_FIVE_TOOL_TARGET_TWENTY_NINE_OK`
- new Phase2880 target thirty emits `PHASE2880_THIRTY_FIVE_TOOL_TARGET_THIRTY_OK`
- new Phase2881 target thirty-one emits `PHASE2881_THIRTY_FIVE_TOOL_TARGET_THIRTY_ONE_OK`
- new Phase2882 target thirty-two emits `PHASE2882_THIRTY_FIVE_TOOL_TARGET_THIRTY_TWO_OK`
- new Phase2883 target thirty-three emits `PHASE2883_THIRTY_FIVE_TOOL_TARGET_THIRTY_THREE_OK`
- new Phase2884 target thirty-four emits `PHASE2884_THIRTY_FIVE_TOOL_TARGET_THIRTY_FOUR_OK`
- new Phase2885 target thirty-five emits `PHASE2885_THIRTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2846-2885-controlled-thirty-five-tool-mutation
cmd /c pnpm run apply:phase2846-2885-controlled-thirty-five-tool-mutation
cmd /c pnpm run smoke:phase2846-2885-controlled-thirty-five-tool-mutation
cmd /c pnpm run verify:phase2846-2885-controlled-thirty-five-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the thirty-five target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a thirty-six-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
