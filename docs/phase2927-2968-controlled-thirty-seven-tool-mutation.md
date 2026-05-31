# Phase2927A-2968A Controlled Thirty-Seven Tool Mutation

## Goal

Phase2927A-2968A extends the controlled local mutation line from thirty-six files to thirty-seven files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled thirty-seven tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2886A-2926A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly thirty-seven existing source-file mutations.
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
  - `tools/phase2886_2926/apply-controlled-thirty-six-tool-mutation.mjs`

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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support thirty-seven bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The thirty-seven mutation batch must prove:
- new Phase2932 target one emits `PHASE2932_THIRTY_SEVEN_TOOL_TARGET_ONE_OK`
- new Phase2933 target two emits `PHASE2933_THIRTY_SEVEN_TOOL_TARGET_TWO_OK`
- new Phase2934 target three emits `PHASE2934_THIRTY_SEVEN_TOOL_TARGET_THREE_OK`
- new Phase2935 target four emits `PHASE2935_THIRTY_SEVEN_TOOL_TARGET_FOUR_OK`
- new Phase2936 target five emits `PHASE2936_THIRTY_SEVEN_TOOL_TARGET_FIVE_OK`
- new Phase2937 target six emits `PHASE2937_THIRTY_SEVEN_TOOL_TARGET_SIX_OK`
- new Phase2938 target seven emits `PHASE2938_THIRTY_SEVEN_TOOL_TARGET_SEVEN_OK`
- new Phase2939 target eight emits `PHASE2939_THIRTY_SEVEN_TOOL_TARGET_EIGHT_OK`
- new Phase2940 target nine emits `PHASE2940_THIRTY_SEVEN_TOOL_TARGET_NINE_OK`
- new Phase2941 target ten emits `PHASE2941_THIRTY_SEVEN_TOOL_TARGET_TEN_OK`
- new Phase2942 target eleven emits `PHASE2942_THIRTY_SEVEN_TOOL_TARGET_ELEVEN_OK`
- new Phase2943 target twelve emits `PHASE2943_THIRTY_SEVEN_TOOL_TARGET_TWELVE_OK`
- new Phase2944 target thirteen emits `PHASE2944_THIRTY_SEVEN_TOOL_TARGET_THIRTEEN_OK`
- new Phase2945 target fourteen emits `PHASE2945_THIRTY_SEVEN_TOOL_TARGET_FOURTEEN_OK`
- new Phase2946 target fifteen emits `PHASE2946_THIRTY_SEVEN_TOOL_TARGET_FIFTEEN_OK`
- new Phase2947 target sixteen emits `PHASE2947_THIRTY_SEVEN_TOOL_TARGET_SIXTEEN_OK`
- new Phase2948 target seventeen emits `PHASE2948_THIRTY_SEVEN_TOOL_TARGET_SEVENTEEN_OK`
- new Phase2949 target eighteen emits `PHASE2949_THIRTY_SEVEN_TOOL_TARGET_EIGHTEEN_OK`
- new Phase2950 target nineteen emits `PHASE2950_THIRTY_SEVEN_TOOL_TARGET_NINETEEN_OK`
- new Phase2951 target twenty emits `PHASE2951_THIRTY_SEVEN_TOOL_TARGET_TWENTY_OK`
- new Phase2952 target twenty-one emits `PHASE2952_THIRTY_SEVEN_TOOL_TARGET_TWENTY_ONE_OK`
- new Phase2953 target twenty-two emits `PHASE2953_THIRTY_SEVEN_TOOL_TARGET_TWENTY_TWO_OK`
- new Phase2954 target twenty-three emits `PHASE2954_THIRTY_SEVEN_TOOL_TARGET_TWENTY_THREE_OK`
- new Phase2955 target twenty-four emits `PHASE2955_THIRTY_SEVEN_TOOL_TARGET_TWENTY_FOUR_OK`
- new Phase2956 target twenty-five emits `PHASE2956_THIRTY_SEVEN_TOOL_TARGET_TWENTY_FIVE_OK`
- new Phase2957 target twenty-six emits `PHASE2957_THIRTY_SEVEN_TOOL_TARGET_TWENTY_SIX_OK`
- new Phase2958 target twenty-seven emits `PHASE2958_THIRTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK`
- new Phase2959 target twenty-eight emits `PHASE2959_THIRTY_SEVEN_TOOL_TARGET_TWENTY_EIGHT_OK`
- new Phase2960 target twenty-nine emits `PHASE2960_THIRTY_SEVEN_TOOL_TARGET_TWENTY_NINE_OK`
- new Phase2961 target thirty emits `PHASE2961_THIRTY_SEVEN_TOOL_TARGET_THIRTY_OK`
- new Phase2962 target thirty-one emits `PHASE2962_THIRTY_SEVEN_TOOL_TARGET_THIRTY_ONE_OK`
- new Phase2963 target thirty-two emits `PHASE2963_THIRTY_SEVEN_TOOL_TARGET_THIRTY_TWO_OK`
- new Phase2964 target thirty-three emits `PHASE2964_THIRTY_SEVEN_TOOL_TARGET_THIRTY_THREE_OK`
- new Phase2965 target thirty-four emits `PHASE2965_THIRTY_SEVEN_TOOL_TARGET_THIRTY_FOUR_OK`
- new Phase2966 target thirty-five emits `PHASE2966_THIRTY_SEVEN_TOOL_TARGET_THIRTY_FIVE_OK`
- new Phase2967 target thirty-six emits `PHASE2967_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SIX_OK`
- new Phase2968 target thirty-seven emits `PHASE2968_THIRTY_SEVEN_TOOL_TARGET_THIRTY_SEVEN_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2927-2968-controlled-thirty-seven-tool-mutation
cmd /c pnpm run apply:phase2927-2968-controlled-thirty-seven-tool-mutation
cmd /c pnpm run smoke:phase2927-2968-controlled-thirty-seven-tool-mutation
cmd /c pnpm run verify:phase2927-2968-controlled-thirty-seven-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the thirty-seven target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a thirty-eight-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
