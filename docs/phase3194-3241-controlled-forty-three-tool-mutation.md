# Phase3194A-3241A Controlled Forty-Three Tool Mutation

## Goal

Phase3194A-3241A extends the controlled local mutation line from forty-two files to forty-three files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled forty-three tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase3147A-3193A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly forty-three existing source-file mutations.
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
  - `tools/phase3101_3146/apply-controlled-forty-one-tool-mutation.mjs`
  - `tools/phase3147_3193/apply-controlled-forty-two-tool-mutation.mjs`

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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support forty-three bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The forty-three mutation batch must prove:
- new Phase3199 target one emits `PHASE3199_FORTY_THREE_TOOL_TARGET_ONE_OK`
- new Phase3200 target two emits `PHASE3200_FORTY_THREE_TOOL_TARGET_TWO_OK`
- new Phase3201 target three emits `PHASE3201_FORTY_THREE_TOOL_TARGET_THREE_OK`
- new Phase3202 target four emits `PHASE3202_FORTY_THREE_TOOL_TARGET_FOUR_OK`
- new Phase3203 target five emits `PHASE3203_FORTY_THREE_TOOL_TARGET_FIVE_OK`
- new Phase3204 target six emits `PHASE3204_FORTY_THREE_TOOL_TARGET_SIX_OK`
- new Phase3205 target seven emits `PHASE3205_FORTY_THREE_TOOL_TARGET_SEVEN_OK`
- new Phase3206 target eight emits `PHASE3206_FORTY_THREE_TOOL_TARGET_EIGHT_OK`
- new Phase3207 target nine emits `PHASE3207_FORTY_THREE_TOOL_TARGET_NINE_OK`
- new Phase3208 target ten emits `PHASE3208_FORTY_THREE_TOOL_TARGET_TEN_OK`
- new Phase3209 target eleven emits `PHASE3209_FORTY_THREE_TOOL_TARGET_ELEVEN_OK`
- new Phase3210 target twelve emits `PHASE3210_FORTY_THREE_TOOL_TARGET_TWELVE_OK`
- new Phase3211 target thirteen emits `PHASE3211_FORTY_THREE_TOOL_TARGET_THIRTEEN_OK`
- new Phase3212 target fourteen emits `PHASE3212_FORTY_THREE_TOOL_TARGET_FOURTEEN_OK`
- new Phase3213 target fifteen emits `PHASE3213_FORTY_THREE_TOOL_TARGET_FIFTEEN_OK`
- new Phase3214 target sixteen emits `PHASE3214_FORTY_THREE_TOOL_TARGET_SIXTEEN_OK`
- new Phase3215 target seventeen emits `PHASE3215_FORTY_THREE_TOOL_TARGET_SEVENTEEN_OK`
- new Phase3216 target eighteen emits `PHASE3216_FORTY_THREE_TOOL_TARGET_EIGHTEEN_OK`
- new Phase3217 target nineteen emits `PHASE3217_FORTY_THREE_TOOL_TARGET_NINETEEN_OK`
- new Phase3218 target twenty emits `PHASE3218_FORTY_THREE_TOOL_TARGET_TWENTY_OK`
- new Phase3219 target twenty-one emits `PHASE3219_FORTY_THREE_TOOL_TARGET_TWENTY_ONE_OK`
- new Phase3220 target twenty-two emits `PHASE3220_FORTY_THREE_TOOL_TARGET_TWENTY_TWO_OK`
- new Phase3221 target twenty-three emits `PHASE3221_FORTY_THREE_TOOL_TARGET_TWENTY_THREE_OK`
- new Phase3222 target twenty-four emits `PHASE3222_FORTY_THREE_TOOL_TARGET_TWENTY_FOUR_OK`
- new Phase3223 target twenty-five emits `PHASE3223_FORTY_THREE_TOOL_TARGET_TWENTY_FIVE_OK`
- new Phase3224 target twenty-six emits `PHASE3224_FORTY_THREE_TOOL_TARGET_TWENTY_SIX_OK`
- new Phase3225 target twenty-seven emits `PHASE3225_FORTY_THREE_TOOL_TARGET_TWENTY_SEVEN_OK`
- new Phase3226 target twenty-eight emits `PHASE3226_FORTY_THREE_TOOL_TARGET_TWENTY_EIGHT_OK`
- new Phase3227 target twenty-nine emits `PHASE3227_FORTY_THREE_TOOL_TARGET_TWENTY_NINE_OK`
- new Phase3228 target thirty emits `PHASE3228_FORTY_THREE_TOOL_TARGET_THIRTY_OK`
- new Phase3229 target thirty-one emits `PHASE3229_FORTY_THREE_TOOL_TARGET_THIRTY_ONE_OK`
- new Phase3230 target thirty-two emits `PHASE3230_FORTY_THREE_TOOL_TARGET_THIRTY_TWO_OK`
- new Phase3231 target thirty-three emits `PHASE3231_FORTY_THREE_TOOL_TARGET_THIRTY_THREE_OK`
- new Phase3232 target thirty-four emits `PHASE3232_FORTY_THREE_TOOL_TARGET_THIRTY_FOUR_OK`
- new Phase3233 target thirty-five emits `PHASE3233_FORTY_THREE_TOOL_TARGET_THIRTY_FIVE_OK`
- new Phase3234 target thirty-six emits `PHASE3234_FORTY_THREE_TOOL_TARGET_THIRTY_SIX_OK`
- new Phase3235 target thirty-seven emits `PHASE3235_FORTY_THREE_TOOL_TARGET_THIRTY_SEVEN_OK`
- new Phase3236 target thirty-eight emits `PHASE3236_FORTY_THREE_TOOL_TARGET_THIRTY_EIGHT_OK`
- new Phase3237 target thirty-nine emits `PHASE3237_FORTY_THREE_TOOL_TARGET_THIRTY_NINE_OK`
- new Phase3238 target forty emits `PHASE3238_FORTY_THREE_TOOL_TARGET_FORTY_OK`
- new Phase3239 target forty-one emits `PHASE3239_FORTY_THREE_TOOL_TARGET_FORTY_ONE_OK`
- new Phase3240 target forty-two emits `PHASE3240_FORTY_THREE_TOOL_TARGET_FORTY_TWO_OK`
- new Phase3241 target forty-three emits `PHASE3241_FORTY_THREE_TOOL_TARGET_FORTY_THREE_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase3194-3241-controlled-forty-three-tool-mutation
cmd /c pnpm run apply:phase3194-3241-controlled-forty-three-tool-mutation
cmd /c pnpm run smoke:phase3194-3241-controlled-forty-three-tool-mutation
cmd /c pnpm run verify:phase3194-3241-controlled-forty-three-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the forty-three target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a forty-four-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
