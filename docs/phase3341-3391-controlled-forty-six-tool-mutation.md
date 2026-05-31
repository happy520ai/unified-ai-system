# Phase3341A-3391A Controlled Forty-Six Tool Mutation

## Goal

Phase3341A-3391A extends the controlled local mutation line from forty-five files to forty-six files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled forty-six tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase3291A-3340A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly forty-six existing source-file mutations.
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
  - `tools/phase3291_3340/apply-controlled-forty-five-tool-mutation.mjs`

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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support forty-six bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The forty-six mutation batch must prove:
- new Phase3346 target one emits `PHASE3346_FORTY_SIX_TOOL_TARGET_ONE_OK`
- new Phase3347 target two emits `PHASE3347_FORTY_SIX_TOOL_TARGET_TWO_OK`
- new Phase3348 target three emits `PHASE3348_FORTY_SIX_TOOL_TARGET_THREE_OK`
- new Phase3349 target four emits `PHASE3349_FORTY_SIX_TOOL_TARGET_FOUR_OK`
- new Phase3350 target five emits `PHASE3350_FORTY_SIX_TOOL_TARGET_FIVE_OK`
- new Phase3351 target six emits `PHASE3351_FORTY_SIX_TOOL_TARGET_SIX_OK`
- new Phase3352 target seven emits `PHASE3352_FORTY_SIX_TOOL_TARGET_SEVEN_OK`
- new Phase3353 target eight emits `PHASE3353_FORTY_SIX_TOOL_TARGET_EIGHT_OK`
- new Phase3354 target nine emits `PHASE3354_FORTY_SIX_TOOL_TARGET_NINE_OK`
- new Phase3355 target ten emits `PHASE3355_FORTY_SIX_TOOL_TARGET_TEN_OK`
- new Phase3356 target eleven emits `PHASE3356_FORTY_SIX_TOOL_TARGET_ELEVEN_OK`
- new Phase3357 target twelve emits `PHASE3357_FORTY_SIX_TOOL_TARGET_TWELVE_OK`
- new Phase3358 target thirteen emits `PHASE3358_FORTY_SIX_TOOL_TARGET_THIRTEEN_OK`
- new Phase3359 target fourteen emits `PHASE3359_FORTY_SIX_TOOL_TARGET_FOURTEEN_OK`
- new Phase3360 target fifteen emits `PHASE3360_FORTY_SIX_TOOL_TARGET_FIFTEEN_OK`
- new Phase3361 target sixteen emits `PHASE3361_FORTY_SIX_TOOL_TARGET_SIXTEEN_OK`
- new Phase3362 target seventeen emits `PHASE3362_FORTY_SIX_TOOL_TARGET_SEVENTEEN_OK`
- new Phase3363 target eighteen emits `PHASE3363_FORTY_SIX_TOOL_TARGET_EIGHTEEN_OK`
- new Phase3364 target nineteen emits `PHASE3364_FORTY_SIX_TOOL_TARGET_NINETEEN_OK`
- new Phase3365 target twenty emits `PHASE3365_FORTY_SIX_TOOL_TARGET_TWENTY_OK`
- new Phase3366 target twenty-one emits `PHASE3366_FORTY_SIX_TOOL_TARGET_TWENTY_ONE_OK`
- new Phase3367 target twenty-two emits `PHASE3367_FORTY_SIX_TOOL_TARGET_TWENTY_TWO_OK`
- new Phase3368 target twenty-three emits `PHASE3368_FORTY_SIX_TOOL_TARGET_TWENTY_THREE_OK`
- new Phase3369 target twenty-four emits `PHASE3369_FORTY_SIX_TOOL_TARGET_TWENTY_FOUR_OK`
- new Phase3370 target twenty-five emits `PHASE3370_FORTY_SIX_TOOL_TARGET_TWENTY_FIVE_OK`
- new Phase3371 target twenty-six emits `PHASE3371_FORTY_SIX_TOOL_TARGET_TWENTY_SIX_OK`
- new Phase3372 target twenty-seven emits `PHASE3372_FORTY_SIX_TOOL_TARGET_TWENTY_SEVEN_OK`
- new Phase3373 target twenty-eight emits `PHASE3373_FORTY_SIX_TOOL_TARGET_TWENTY_EIGHT_OK`
- new Phase3374 target twenty-nine emits `PHASE3374_FORTY_SIX_TOOL_TARGET_TWENTY_NINE_OK`
- new Phase3375 target thirty emits `PHASE3375_FORTY_SIX_TOOL_TARGET_THIRTY_OK`
- new Phase3376 target thirty-one emits `PHASE3376_FORTY_SIX_TOOL_TARGET_THIRTY_ONE_OK`
- new Phase3377 target thirty-two emits `PHASE3377_FORTY_SIX_TOOL_TARGET_THIRTY_TWO_OK`
- new Phase3378 target thirty-three emits `PHASE3378_FORTY_SIX_TOOL_TARGET_THIRTY_THREE_OK`
- new Phase3379 target thirty-four emits `PHASE3379_FORTY_SIX_TOOL_TARGET_THIRTY_FOUR_OK`
- new Phase3380 target thirty-five emits `PHASE3380_FORTY_SIX_TOOL_TARGET_THIRTY_FIVE_OK`
- new Phase3381 target thirty-six emits `PHASE3381_FORTY_SIX_TOOL_TARGET_THIRTY_SIX_OK`
- new Phase3382 target thirty-seven emits `PHASE3382_FORTY_SIX_TOOL_TARGET_THIRTY_SEVEN_OK`
- new Phase3383 target thirty-eight emits `PHASE3383_FORTY_SIX_TOOL_TARGET_THIRTY_EIGHT_OK`
- new Phase3384 target thirty-nine emits `PHASE3384_FORTY_SIX_TOOL_TARGET_THIRTY_NINE_OK`
- new Phase3385 target forty emits `PHASE3385_FORTY_SIX_TOOL_TARGET_FORTY_OK`
- new Phase3386 target forty-one emits `PHASE3386_FORTY_SIX_TOOL_TARGET_FORTY_ONE_OK`
- new Phase3387 target forty-two emits `PHASE3387_FORTY_SIX_TOOL_TARGET_FORTY_TWO_OK`
- new Phase3388 target forty-three emits `PHASE3388_FORTY_SIX_TOOL_TARGET_FORTY_THREE_OK`
- new Phase3389 target forty-four emits `PHASE3389_FORTY_SIX_TOOL_TARGET_FORTY_FOUR_OK`
- new Phase3390 target forty-five emits `PHASE3390_FORTY_SIX_TOOL_TARGET_FORTY_FIVE_OK`
- new Phase3391 target forty-six emits `PHASE3391_FORTY_SIX_TOOL_TARGET_FORTY_SIX_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase3341-3391-controlled-forty-six-tool-mutation
cmd /c pnpm run apply:phase3341-3391-controlled-forty-six-tool-mutation
cmd /c pnpm run smoke:phase3341-3391-controlled-forty-six-tool-mutation
cmd /c pnpm run verify:phase3341-3391-controlled-forty-six-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the forty-six target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a forty-seven-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
