# Phase3101A-3146A Controlled Forty-One Tool Mutation

## Goal

Phase3101A-3146A extends the controlled local mutation line from forty files to forty-one files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled forty-one tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase3056A-3100A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly forty-one existing source-file mutations.
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
  - `tools/phase2927_2968/apply-controlled-thirty-seven-tool-mutation.mjs`
  - `tools/phase2969_3011/apply-controlled-thirty-eight-tool-mutation.mjs`
  - `tools/phase3012_3055/apply-controlled-thirty-nine-tool-mutation.mjs`
  - `tools/phase3056_3100/apply-controlled-forty-tool-mutation.mjs`

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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support forty bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The forty mutation batch must prove:
- new Phase3106 target one emits `PHASE3106_FORTY_ONE_TOOL_TARGET_ONE_OK`
- new Phase3107 target two emits `PHASE3107_FORTY_ONE_TOOL_TARGET_TWO_OK`
- new Phase3108 target three emits `PHASE3108_FORTY_ONE_TOOL_TARGET_THREE_OK`
- new Phase3109 target four emits `PHASE3109_FORTY_ONE_TOOL_TARGET_FOUR_OK`
- new Phase3110 target five emits `PHASE3110_FORTY_ONE_TOOL_TARGET_FIVE_OK`
- new Phase3111 target six emits `PHASE3111_FORTY_ONE_TOOL_TARGET_SIX_OK`
- new Phase3112 target seven emits `PHASE3112_FORTY_ONE_TOOL_TARGET_SEVEN_OK`
- new Phase3113 target eight emits `PHASE3113_FORTY_ONE_TOOL_TARGET_EIGHT_OK`
- new Phase3114 target nine emits `PHASE3114_FORTY_ONE_TOOL_TARGET_NINE_OK`
- new Phase3115 target ten emits `PHASE3115_FORTY_ONE_TOOL_TARGET_TEN_OK`
- new Phase3116 target eleven emits `PHASE3116_FORTY_ONE_TOOL_TARGET_ELEVEN_OK`
- new Phase3117 target twelve emits `PHASE3117_FORTY_ONE_TOOL_TARGET_TWELVE_OK`
- new Phase3118 target thirteen emits `PHASE3118_FORTY_ONE_TOOL_TARGET_THIRTEEN_OK`
- new Phase3119 target fourteen emits `PHASE3119_FORTY_ONE_TOOL_TARGET_FOURTEEN_OK`
- new Phase3120 target fifteen emits `PHASE3120_FORTY_ONE_TOOL_TARGET_FIFTEEN_OK`
- new Phase3121 target sixteen emits `PHASE3121_FORTY_ONE_TOOL_TARGET_SIXTEEN_OK`
- new Phase3122 target seventeen emits `PHASE3122_FORTY_ONE_TOOL_TARGET_SEVENTEEN_OK`
- new Phase3123 target eighteen emits `PHASE3123_FORTY_ONE_TOOL_TARGET_EIGHTEEN_OK`
- new Phase3124 target nineteen emits `PHASE3124_FORTY_ONE_TOOL_TARGET_NINETEEN_OK`
- new Phase3125 target twenty emits `PHASE3125_FORTY_ONE_TOOL_TARGET_TWENTY_OK`
- new Phase3126 target twenty-one emits `PHASE3126_FORTY_ONE_TOOL_TARGET_TWENTY_ONE_OK`
- new Phase3127 target twenty-two emits `PHASE3127_FORTY_ONE_TOOL_TARGET_TWENTY_TWO_OK`
- new Phase3128 target twenty-three emits `PHASE3128_FORTY_ONE_TOOL_TARGET_TWENTY_THREE_OK`
- new Phase3129 target twenty-four emits `PHASE3129_FORTY_ONE_TOOL_TARGET_TWENTY_FOUR_OK`
- new Phase3130 target twenty-five emits `PHASE3130_FORTY_ONE_TOOL_TARGET_TWENTY_FIVE_OK`
- new Phase3131 target twenty-six emits `PHASE3131_FORTY_ONE_TOOL_TARGET_TWENTY_SIX_OK`
- new Phase3132 target twenty-seven emits `PHASE3132_FORTY_ONE_TOOL_TARGET_TWENTY_SEVEN_OK`
- new Phase3133 target twenty-eight emits `PHASE3133_FORTY_ONE_TOOL_TARGET_TWENTY_EIGHT_OK`
- new Phase3134 target twenty-nine emits `PHASE3134_FORTY_ONE_TOOL_TARGET_TWENTY_NINE_OK`
- new Phase3135 target thirty emits `PHASE3135_FORTY_ONE_TOOL_TARGET_THIRTY_OK`
- new Phase3136 target thirty-one emits `PHASE3136_FORTY_ONE_TOOL_TARGET_THIRTY_ONE_OK`
- new Phase3137 target thirty-two emits `PHASE3137_FORTY_ONE_TOOL_TARGET_THIRTY_TWO_OK`
- new Phase3138 target thirty-three emits `PHASE3138_FORTY_ONE_TOOL_TARGET_THIRTY_THREE_OK`
- new Phase3139 target thirty-four emits `PHASE3139_FORTY_ONE_TOOL_TARGET_THIRTY_FOUR_OK`
- new Phase3140 target thirty-five emits `PHASE3140_FORTY_ONE_TOOL_TARGET_THIRTY_FIVE_OK`
- new Phase3141 target thirty-six emits `PHASE3141_FORTY_ONE_TOOL_TARGET_THIRTY_SIX_OK`
- new Phase3142 target thirty-seven emits `PHASE3142_FORTY_ONE_TOOL_TARGET_THIRTY_SEVEN_OK`
- new Phase3143 target thirty-eight emits `PHASE3143_FORTY_ONE_TOOL_TARGET_THIRTY_EIGHT_OK`
- new Phase3144 target thirty-nine emits `PHASE3144_FORTY_ONE_TOOL_TARGET_THIRTY_NINE_OK`
- new Phase3145 target forty emits `PHASE3145_FORTY_ONE_TOOL_TARGET_FORTY_OK`
- new Phase3146 target forty-one emits `PHASE3146_FORTY_ONE_TOOL_TARGET_FORTY_ONE_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase3101-3146-controlled-forty-one-tool-mutation
cmd /c pnpm run apply:phase3101-3146-controlled-forty-one-tool-mutation
cmd /c pnpm run smoke:phase3101-3146-controlled-forty-one-tool-mutation
cmd /c pnpm run verify:phase3101-3146-controlled-forty-one-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the forty target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a forty-one-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
