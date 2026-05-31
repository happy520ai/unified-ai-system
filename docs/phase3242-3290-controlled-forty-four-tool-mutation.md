# Phase3242A-3290A Controlled Forty-Four Tool Mutation

## Goal

Phase3242A-3290A extends the controlled local mutation line from forty-three files to forty-four files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled forty-four tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase3194A-3241A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly forty-four existing source-file mutations.
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
  - `tools/phase3194_3241/apply-controlled-forty-three-tool-mutation.mjs`

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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support forty-four bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The forty-four mutation batch must prove:
- new Phase3247 target one emits `PHASE3247_FORTY_FOUR_TOOL_TARGET_ONE_OK`
- new Phase3248 target two emits `PHASE3248_FORTY_FOUR_TOOL_TARGET_TWO_OK`
- new Phase3249 target three emits `PHASE3249_FORTY_FOUR_TOOL_TARGET_THREE_OK`
- new Phase3250 target four emits `PHASE3250_FORTY_FOUR_TOOL_TARGET_FOUR_OK`
- new Phase3251 target five emits `PHASE3251_FORTY_FOUR_TOOL_TARGET_FIVE_OK`
- new Phase3252 target six emits `PHASE3252_FORTY_FOUR_TOOL_TARGET_SIX_OK`
- new Phase3253 target seven emits `PHASE3253_FORTY_FOUR_TOOL_TARGET_SEVEN_OK`
- new Phase3254 target eight emits `PHASE3254_FORTY_FOUR_TOOL_TARGET_EIGHT_OK`
- new Phase3255 target nine emits `PHASE3255_FORTY_FOUR_TOOL_TARGET_NINE_OK`
- new Phase3256 target ten emits `PHASE3256_FORTY_FOUR_TOOL_TARGET_TEN_OK`
- new Phase3257 target eleven emits `PHASE3257_FORTY_FOUR_TOOL_TARGET_ELEVEN_OK`
- new Phase3258 target twelve emits `PHASE3258_FORTY_FOUR_TOOL_TARGET_TWELVE_OK`
- new Phase3259 target thirteen emits `PHASE3259_FORTY_FOUR_TOOL_TARGET_THIRTEEN_OK`
- new Phase3260 target fourteen emits `PHASE3260_FORTY_FOUR_TOOL_TARGET_FOURTEEN_OK`
- new Phase3261 target fifteen emits `PHASE3261_FORTY_FOUR_TOOL_TARGET_FIFTEEN_OK`
- new Phase3262 target sixteen emits `PHASE3262_FORTY_FOUR_TOOL_TARGET_SIXTEEN_OK`
- new Phase3263 target seventeen emits `PHASE3263_FORTY_FOUR_TOOL_TARGET_SEVENTEEN_OK`
- new Phase3264 target eighteen emits `PHASE3264_FORTY_FOUR_TOOL_TARGET_EIGHTEEN_OK`
- new Phase3265 target nineteen emits `PHASE3265_FORTY_FOUR_TOOL_TARGET_NINETEEN_OK`
- new Phase3266 target twenty emits `PHASE3266_FORTY_FOUR_TOOL_TARGET_TWENTY_OK`
- new Phase3267 target twenty-one emits `PHASE3267_FORTY_FOUR_TOOL_TARGET_TWENTY_ONE_OK`
- new Phase3268 target twenty-two emits `PHASE3268_FORTY_FOUR_TOOL_TARGET_TWENTY_TWO_OK`
- new Phase3269 target twenty-three emits `PHASE3269_FORTY_FOUR_TOOL_TARGET_TWENTY_THREE_OK`
- new Phase3270 target twenty-four emits `PHASE3270_FORTY_FOUR_TOOL_TARGET_TWENTY_FOUR_OK`
- new Phase3271 target twenty-five emits `PHASE3271_FORTY_FOUR_TOOL_TARGET_TWENTY_FIVE_OK`
- new Phase3272 target twenty-six emits `PHASE3272_FORTY_FOUR_TOOL_TARGET_TWENTY_SIX_OK`
- new Phase3273 target twenty-seven emits `PHASE3273_FORTY_FOUR_TOOL_TARGET_TWENTY_SEVEN_OK`
- new Phase3274 target twenty-eight emits `PHASE3274_FORTY_FOUR_TOOL_TARGET_TWENTY_EIGHT_OK`
- new Phase3275 target twenty-nine emits `PHASE3275_FORTY_FOUR_TOOL_TARGET_TWENTY_NINE_OK`
- new Phase3276 target thirty emits `PHASE3276_FORTY_FOUR_TOOL_TARGET_THIRTY_OK`
- new Phase3277 target thirty-one emits `PHASE3277_FORTY_FOUR_TOOL_TARGET_THIRTY_ONE_OK`
- new Phase3278 target thirty-two emits `PHASE3278_FORTY_FOUR_TOOL_TARGET_THIRTY_TWO_OK`
- new Phase3279 target thirty-three emits `PHASE3279_FORTY_FOUR_TOOL_TARGET_THIRTY_THREE_OK`
- new Phase3280 target thirty-four emits `PHASE3280_FORTY_FOUR_TOOL_TARGET_THIRTY_FOUR_OK`
- new Phase3281 target thirty-five emits `PHASE3281_FORTY_FOUR_TOOL_TARGET_THIRTY_FIVE_OK`
- new Phase3282 target thirty-six emits `PHASE3282_FORTY_FOUR_TOOL_TARGET_THIRTY_SIX_OK`
- new Phase3283 target thirty-seven emits `PHASE3283_FORTY_FOUR_TOOL_TARGET_THIRTY_SEVEN_OK`
- new Phase3284 target thirty-eight emits `PHASE3284_FORTY_FOUR_TOOL_TARGET_THIRTY_EIGHT_OK`
- new Phase3285 target thirty-nine emits `PHASE3285_FORTY_FOUR_TOOL_TARGET_THIRTY_NINE_OK`
- new Phase3286 target forty emits `PHASE3286_FORTY_FOUR_TOOL_TARGET_FORTY_OK`
- new Phase3287 target forty-one emits `PHASE3287_FORTY_FOUR_TOOL_TARGET_FORTY_ONE_OK`
- new Phase3288 target forty-two emits `PHASE3288_FORTY_FOUR_TOOL_TARGET_FORTY_TWO_OK`
- new Phase3289 target forty-three emits `PHASE3289_FORTY_FOUR_TOOL_TARGET_FORTY_THREE_OK`
- new Phase3290 target forty-four emits `PHASE3290_FORTY_FOUR_TOOL_TARGET_FORTY_FOUR_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase3242-3290-controlled-forty-four-tool-mutation
cmd /c pnpm run apply:phase3242-3290-controlled-forty-four-tool-mutation
cmd /c pnpm run smoke:phase3242-3290-controlled-forty-four-tool-mutation
cmd /c pnpm run verify:phase3242-3290-controlled-forty-four-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the forty-four target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a forty-five-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
