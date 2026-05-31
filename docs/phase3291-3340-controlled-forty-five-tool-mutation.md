# Phase3291A-3340A Controlled Forty-Five Tool Mutation

## Goal

Phase3291A-3340A extends the controlled local mutation line from forty-four files to forty-five files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled forty-five tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase3242A-3290A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly forty-five existing source-file mutations.
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
  - `tools/phase3242_3290/apply-controlled-forty-four-tool-mutation.mjs`

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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support forty-five bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The forty-five mutation batch must prove:
- new Phase3296 target one emits `PHASE3296_FORTY_FIVE_TOOL_TARGET_ONE_OK`
- new Phase3297 target two emits `PHASE3297_FORTY_FIVE_TOOL_TARGET_TWO_OK`
- new Phase3298 target three emits `PHASE3298_FORTY_FIVE_TOOL_TARGET_THREE_OK`
- new Phase3299 target four emits `PHASE3299_FORTY_FIVE_TOOL_TARGET_FOUR_OK`
- new Phase3300 target five emits `PHASE3300_FORTY_FIVE_TOOL_TARGET_FIVE_OK`
- new Phase3301 target six emits `PHASE3301_FORTY_FIVE_TOOL_TARGET_SIX_OK`
- new Phase3302 target seven emits `PHASE3302_FORTY_FIVE_TOOL_TARGET_SEVEN_OK`
- new Phase3303 target eight emits `PHASE3303_FORTY_FIVE_TOOL_TARGET_EIGHT_OK`
- new Phase3304 target nine emits `PHASE3304_FORTY_FIVE_TOOL_TARGET_NINE_OK`
- new Phase3305 target ten emits `PHASE3305_FORTY_FIVE_TOOL_TARGET_TEN_OK`
- new Phase3306 target eleven emits `PHASE3306_FORTY_FIVE_TOOL_TARGET_ELEVEN_OK`
- new Phase3307 target twelve emits `PHASE3307_FORTY_FIVE_TOOL_TARGET_TWELVE_OK`
- new Phase3308 target thirteen emits `PHASE3308_FORTY_FIVE_TOOL_TARGET_THIRTEEN_OK`
- new Phase3309 target fourteen emits `PHASE3309_FORTY_FIVE_TOOL_TARGET_FOURTEEN_OK`
- new Phase3310 target fifteen emits `PHASE3310_FORTY_FIVE_TOOL_TARGET_FIFTEEN_OK`
- new Phase3311 target sixteen emits `PHASE3311_FORTY_FIVE_TOOL_TARGET_SIXTEEN_OK`
- new Phase3312 target seventeen emits `PHASE3312_FORTY_FIVE_TOOL_TARGET_SEVENTEEN_OK`
- new Phase3313 target eighteen emits `PHASE3313_FORTY_FIVE_TOOL_TARGET_EIGHTEEN_OK`
- new Phase3314 target nineteen emits `PHASE3314_FORTY_FIVE_TOOL_TARGET_NINETEEN_OK`
- new Phase3315 target twenty emits `PHASE3315_FORTY_FIVE_TOOL_TARGET_TWENTY_OK`
- new Phase3316 target twenty-one emits `PHASE3316_FORTY_FIVE_TOOL_TARGET_TWENTY_ONE_OK`
- new Phase3317 target twenty-two emits `PHASE3317_FORTY_FIVE_TOOL_TARGET_TWENTY_TWO_OK`
- new Phase3318 target twenty-three emits `PHASE3318_FORTY_FIVE_TOOL_TARGET_TWENTY_THREE_OK`
- new Phase3319 target twenty-four emits `PHASE3319_FORTY_FIVE_TOOL_TARGET_TWENTY_FOUR_OK`
- new Phase3320 target twenty-five emits `PHASE3320_FORTY_FIVE_TOOL_TARGET_TWENTY_FIVE_OK`
- new Phase3321 target twenty-six emits `PHASE3321_FORTY_FIVE_TOOL_TARGET_TWENTY_SIX_OK`
- new Phase3322 target twenty-seven emits `PHASE3322_FORTY_FIVE_TOOL_TARGET_TWENTY_SEVEN_OK`
- new Phase3323 target twenty-eight emits `PHASE3323_FORTY_FIVE_TOOL_TARGET_TWENTY_EIGHT_OK`
- new Phase3324 target twenty-nine emits `PHASE3324_FORTY_FIVE_TOOL_TARGET_TWENTY_NINE_OK`
- new Phase3325 target thirty emits `PHASE3325_FORTY_FIVE_TOOL_TARGET_THIRTY_OK`
- new Phase3326 target thirty-one emits `PHASE3326_FORTY_FIVE_TOOL_TARGET_THIRTY_ONE_OK`
- new Phase3327 target thirty-two emits `PHASE3327_FORTY_FIVE_TOOL_TARGET_THIRTY_TWO_OK`
- new Phase3328 target thirty-three emits `PHASE3328_FORTY_FIVE_TOOL_TARGET_THIRTY_THREE_OK`
- new Phase3329 target thirty-four emits `PHASE3329_FORTY_FIVE_TOOL_TARGET_THIRTY_FOUR_OK`
- new Phase3330 target thirty-five emits `PHASE3330_FORTY_FIVE_TOOL_TARGET_THIRTY_FIVE_OK`
- new Phase3331 target thirty-six emits `PHASE3331_FORTY_FIVE_TOOL_TARGET_THIRTY_SIX_OK`
- new Phase3332 target thirty-seven emits `PHASE3332_FORTY_FIVE_TOOL_TARGET_THIRTY_SEVEN_OK`
- new Phase3333 target thirty-eight emits `PHASE3333_FORTY_FIVE_TOOL_TARGET_THIRTY_EIGHT_OK`
- new Phase3334 target thirty-nine emits `PHASE3334_FORTY_FIVE_TOOL_TARGET_THIRTY_NINE_OK`
- new Phase3335 target forty emits `PHASE3335_FORTY_FIVE_TOOL_TARGET_FORTY_OK`
- new Phase3336 target forty-one emits `PHASE3336_FORTY_FIVE_TOOL_TARGET_FORTY_ONE_OK`
- new Phase3337 target forty-two emits `PHASE3337_FORTY_FIVE_TOOL_TARGET_FORTY_TWO_OK`
- new Phase3338 target forty-three emits `PHASE3338_FORTY_FIVE_TOOL_TARGET_FORTY_THREE_OK`
- new Phase3339 target forty-four emits `PHASE3339_FORTY_FIVE_TOOL_TARGET_FORTY_FOUR_OK`
- new Phase3340 target forty-five emits `PHASE3340_FORTY_FIVE_TOOL_TARGET_FORTY_FIVE_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase3291-3340-controlled-forty-five-tool-mutation
cmd /c pnpm run apply:phase3291-3340-controlled-forty-five-tool-mutation
cmd /c pnpm run smoke:phase3291-3340-controlled-forty-five-tool-mutation
cmd /c pnpm run verify:phase3291-3340-controlled-forty-five-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the forty-five target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a forty-six-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
