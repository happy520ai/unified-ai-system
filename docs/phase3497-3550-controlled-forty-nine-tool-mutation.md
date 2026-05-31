# Phase3497A-3550A Controlled Forty-Nine Tool Mutation

## Goal

Phase3497A-3550A extends the controlled local mutation line from forty-eight files to forty-nine files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled forty-nine tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase3444A-3496A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly forty-nine existing source-file mutations.
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
  - `tools/phase3341_3391/apply-controlled-forty-six-tool-mutation.mjs`
  - `tools/phase3392_3443/apply-controlled-forty-seven-tool-mutation.mjs`
  - `tools/phase3444_3496/apply-controlled-forty-eight-tool-mutation.mjs`

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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support forty-nine bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The forty-nine mutation batch must prove:
- new Phase3502 target one emits `PHASE3502_FORTY_NINE_TOOL_TARGET_ONE_OK`
- new Phase3503 target two emits `PHASE3503_FORTY_NINE_TOOL_TARGET_TWO_OK`
- new Phase3504 target three emits `PHASE3504_FORTY_NINE_TOOL_TARGET_THREE_OK`
- new Phase3505 target four emits `PHASE3505_FORTY_NINE_TOOL_TARGET_FOUR_OK`
- new Phase3506 target five emits `PHASE3506_FORTY_NINE_TOOL_TARGET_FIVE_OK`
- new Phase3507 target six emits `PHASE3507_FORTY_NINE_TOOL_TARGET_SIX_OK`
- new Phase3508 target seven emits `PHASE3508_FORTY_NINE_TOOL_TARGET_SEVEN_OK`
- new Phase3509 target eight emits `PHASE3509_FORTY_NINE_TOOL_TARGET_EIGHT_OK`
- new Phase3510 target nine emits `PHASE3510_FORTY_NINE_TOOL_TARGET_NINE_OK`
- new Phase3511 target ten emits `PHASE3511_FORTY_NINE_TOOL_TARGET_TEN_OK`
- new Phase3512 target eleven emits `PHASE3512_FORTY_NINE_TOOL_TARGET_ELEVEN_OK`
- new Phase3513 target twelve emits `PHASE3513_FORTY_NINE_TOOL_TARGET_TWELVE_OK`
- new Phase3514 target thirteen emits `PHASE3514_FORTY_NINE_TOOL_TARGET_THIRTEEN_OK`
- new Phase3515 target fourteen emits `PHASE3515_FORTY_NINE_TOOL_TARGET_FOURTEEN_OK`
- new Phase3516 target fifteen emits `PHASE3516_FORTY_NINE_TOOL_TARGET_FIFTEEN_OK`
- new Phase3517 target sixteen emits `PHASE3517_FORTY_NINE_TOOL_TARGET_SIXTEEN_OK`
- new Phase3518 target seventeen emits `PHASE3518_FORTY_NINE_TOOL_TARGET_SEVENTEEN_OK`
- new Phase3519 target eighteen emits `PHASE3519_FORTY_NINE_TOOL_TARGET_EIGHTEEN_OK`
- new Phase3520 target nineteen emits `PHASE3520_FORTY_NINE_TOOL_TARGET_NINETEEN_OK`
- new Phase3521 target twenty emits `PHASE3521_FORTY_NINE_TOOL_TARGET_TWENTY_OK`
- new Phase3522 target twenty-one emits `PHASE3522_FORTY_NINE_TOOL_TARGET_TWENTY_ONE_OK`
- new Phase3523 target twenty-two emits `PHASE3523_FORTY_NINE_TOOL_TARGET_TWENTY_TWO_OK`
- new Phase3524 target twenty-three emits `PHASE3524_FORTY_NINE_TOOL_TARGET_TWENTY_THREE_OK`
- new Phase3525 target twenty-four emits `PHASE3525_FORTY_NINE_TOOL_TARGET_TWENTY_FOUR_OK`
- new Phase3526 target twenty-five emits `PHASE3526_FORTY_NINE_TOOL_TARGET_TWENTY_FIVE_OK`
- new Phase3527 target twenty-six emits `PHASE3527_FORTY_NINE_TOOL_TARGET_TWENTY_SIX_OK`
- new Phase3528 target twenty-seven emits `PHASE3528_FORTY_NINE_TOOL_TARGET_TWENTY_SEVEN_OK`
- new Phase3529 target twenty-eight emits `PHASE3529_FORTY_NINE_TOOL_TARGET_TWENTY_EIGHT_OK`
- new Phase3530 target twenty-nine emits `PHASE3530_FORTY_NINE_TOOL_TARGET_TWENTY_NINE_OK`
- new Phase3531 target thirty emits `PHASE3531_FORTY_NINE_TOOL_TARGET_THIRTY_OK`
- new Phase3532 target thirty-one emits `PHASE3532_FORTY_NINE_TOOL_TARGET_THIRTY_ONE_OK`
- new Phase3533 target thirty-two emits `PHASE3533_FORTY_NINE_TOOL_TARGET_THIRTY_TWO_OK`
- new Phase3534 target thirty-three emits `PHASE3534_FORTY_NINE_TOOL_TARGET_THIRTY_THREE_OK`
- new Phase3535 target thirty-four emits `PHASE3535_FORTY_NINE_TOOL_TARGET_THIRTY_FOUR_OK`
- new Phase3536 target thirty-five emits `PHASE3536_FORTY_NINE_TOOL_TARGET_THIRTY_FIVE_OK`
- new Phase3537 target thirty-six emits `PHASE3537_FORTY_NINE_TOOL_TARGET_THIRTY_SIX_OK`
- new Phase3538 target thirty-seven emits `PHASE3538_FORTY_NINE_TOOL_TARGET_THIRTY_SEVEN_OK`
- new Phase3539 target thirty-eight emits `PHASE3539_FORTY_NINE_TOOL_TARGET_THIRTY_EIGHT_OK`
- new Phase3540 target thirty-nine emits `PHASE3540_FORTY_NINE_TOOL_TARGET_THIRTY_NINE_OK`
- new Phase3541 target forty emits `PHASE3541_FORTY_NINE_TOOL_TARGET_FORTY_OK`
- new Phase3542 target forty-one emits `PHASE3542_FORTY_NINE_TOOL_TARGET_FORTY_ONE_OK`
- new Phase3543 target forty-two emits `PHASE3543_FORTY_NINE_TOOL_TARGET_FORTY_TWO_OK`
- new Phase3544 target forty-three emits `PHASE3544_FORTY_NINE_TOOL_TARGET_FORTY_THREE_OK`
- new Phase3545 target forty-four emits `PHASE3545_FORTY_NINE_TOOL_TARGET_FORTY_FOUR_OK`
- new Phase3546 target forty-five emits `PHASE3546_FORTY_NINE_TOOL_TARGET_FORTY_FIVE_OK`
- new Phase3547 target forty-six emits `PHASE3547_FORTY_NINE_TOOL_TARGET_FORTY_SIX_OK`
- new Phase3548 target forty-seven emits `PHASE3548_FORTY_NINE_TOOL_TARGET_FORTY_SEVEN_OK`
- new Phase3549 target forty-eight emits `PHASE3549_FORTY_NINE_TOOL_TARGET_FORTY_EIGHT_OK`
- new Phase3550 target forty-nine emits `PHASE3550_FORTY_NINE_TOOL_TARGET_FORTY_NINE_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase3497-3550-controlled-forty-nine-tool-mutation
cmd /c pnpm run apply:phase3497-3550-controlled-forty-nine-tool-mutation
cmd /c pnpm run smoke:phase3497-3550-controlled-forty-nine-tool-mutation
cmd /c pnpm run verify:phase3497-3550-controlled-forty-nine-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the forty-nine target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a fifty-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
