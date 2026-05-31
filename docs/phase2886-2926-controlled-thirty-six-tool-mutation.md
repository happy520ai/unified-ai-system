# Phase2886A-2926A Controlled Thirty-Six Tool Mutation

## Goal

Phase2886A-2926A extends the controlled local mutation line from thirty-five files to thirty-six files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled thirty-six tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2846A-2885A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly thirty-six existing source-file mutations.
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
  - `tools/phase2846_2885/apply-controlled-thirty-five-tool-mutation.mjs`

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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support thirty-six bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The thirty-six mutation batch must prove:
- new Phase2891 target one emits `PHASE2891_THIRTY_SIX_TOOL_TARGET_ONE_OK`
- new Phase2892 target two emits `PHASE2892_THIRTY_SIX_TOOL_TARGET_TWO_OK`
- new Phase2893 target three emits `PHASE2893_THIRTY_SIX_TOOL_TARGET_THREE_OK`
- new Phase2894 target four emits `PHASE2894_THIRTY_SIX_TOOL_TARGET_FOUR_OK`
- new Phase2895 target five emits `PHASE2895_THIRTY_SIX_TOOL_TARGET_FIVE_OK`
- new Phase2896 target six emits `PHASE2896_THIRTY_SIX_TOOL_TARGET_SIX_OK`
- new Phase2897 target seven emits `PHASE2897_THIRTY_SIX_TOOL_TARGET_SEVEN_OK`
- new Phase2898 target eight emits `PHASE2898_THIRTY_SIX_TOOL_TARGET_EIGHT_OK`
- new Phase2899 target nine emits `PHASE2899_THIRTY_SIX_TOOL_TARGET_NINE_OK`
- new Phase2900 target ten emits `PHASE2900_THIRTY_SIX_TOOL_TARGET_TEN_OK`
- new Phase2901 target eleven emits `PHASE2901_THIRTY_SIX_TOOL_TARGET_ELEVEN_OK`
- new Phase2902 target twelve emits `PHASE2902_THIRTY_SIX_TOOL_TARGET_TWELVE_OK`
- new Phase2903 target thirteen emits `PHASE2903_THIRTY_SIX_TOOL_TARGET_THIRTEEN_OK`
- new Phase2904 target fourteen emits `PHASE2904_THIRTY_SIX_TOOL_TARGET_FOURTEEN_OK`
- new Phase2905 target fifteen emits `PHASE2905_THIRTY_SIX_TOOL_TARGET_FIFTEEN_OK`
- new Phase2906 target sixteen emits `PHASE2906_THIRTY_SIX_TOOL_TARGET_SIXTEEN_OK`
- new Phase2907 target seventeen emits `PHASE2907_THIRTY_SIX_TOOL_TARGET_SEVENTEEN_OK`
- new Phase2908 target eighteen emits `PHASE2908_THIRTY_SIX_TOOL_TARGET_EIGHTEEN_OK`
- new Phase2909 target nineteen emits `PHASE2909_THIRTY_SIX_TOOL_TARGET_NINETEEN_OK`
- new Phase2910 target twenty emits `PHASE2910_THIRTY_SIX_TOOL_TARGET_TWENTY_OK`
- new Phase2911 target twenty-one emits `PHASE2911_THIRTY_SIX_TOOL_TARGET_TWENTY_ONE_OK`
- new Phase2912 target twenty-two emits `PHASE2912_THIRTY_SIX_TOOL_TARGET_TWENTY_TWO_OK`
- new Phase2913 target twenty-three emits `PHASE2913_THIRTY_SIX_TOOL_TARGET_TWENTY_THREE_OK`
- new Phase2914 target twenty-four emits `PHASE2914_THIRTY_SIX_TOOL_TARGET_TWENTY_FOUR_OK`
- new Phase2915 target twenty-five emits `PHASE2915_THIRTY_SIX_TOOL_TARGET_TWENTY_FIVE_OK`
- new Phase2916 target twenty-six emits `PHASE2916_THIRTY_SIX_TOOL_TARGET_TWENTY_SIX_OK`
- new Phase2917 target twenty-seven emits `PHASE2917_THIRTY_SIX_TOOL_TARGET_TWENTY_SEVEN_OK`
- new Phase2918 target twenty-eight emits `PHASE2918_THIRTY_SIX_TOOL_TARGET_TWENTY_EIGHT_OK`
- new Phase2919 target twenty-nine emits `PHASE2919_THIRTY_SIX_TOOL_TARGET_TWENTY_NINE_OK`
- new Phase2920 target thirty emits `PHASE2920_THIRTY_SIX_TOOL_TARGET_THIRTY_OK`
- new Phase2921 target thirty-one emits `PHASE2921_THIRTY_SIX_TOOL_TARGET_THIRTY_ONE_OK`
- new Phase2922 target thirty-two emits `PHASE2922_THIRTY_SIX_TOOL_TARGET_THIRTY_TWO_OK`
- new Phase2923 target thirty-three emits `PHASE2923_THIRTY_SIX_TOOL_TARGET_THIRTY_THREE_OK`
- new Phase2924 target thirty-four emits `PHASE2924_THIRTY_SIX_TOOL_TARGET_THIRTY_FOUR_OK`
- new Phase2925 target thirty-five emits `PHASE2925_THIRTY_SIX_TOOL_TARGET_THIRTY_FIVE_OK`
- new Phase2926 target thirty-six emits `PHASE2926_THIRTY_SIX_TOOL_TARGET_THIRTY_SIX_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2886-2926-controlled-thirty-six-tool-mutation
cmd /c pnpm run apply:phase2886-2926-controlled-thirty-six-tool-mutation
cmd /c pnpm run smoke:phase2886-2926-controlled-thirty-six-tool-mutation
cmd /c pnpm run verify:phase2886-2926-controlled-thirty-six-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the thirty-six target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a thirty-seven-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
