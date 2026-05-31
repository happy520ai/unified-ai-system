# Phase3606A-3661A Controlled Fifty-One Tool Mutation

## Goal

Phase3606A-3661A extends the controlled local mutation line from fifty files to fifty-one files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled fifty-one tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase3551A-3605A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly fifty-one existing source-file mutations.
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
  - `tools/phase3497_3550/apply-controlled-forty-nine-tool-mutation.mjs`
  - `tools/phase3551_3605/apply-controlled-fifty-tool-mutation.mjs`

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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support fifty-one bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The fifty-one mutation batch must prove:
- new Phase3611 target one emits `PHASE3611_FIFTY_ONE_TOOL_TARGET_ONE_OK`
- new Phase3612 target two emits `PHASE3612_FIFTY_ONE_TOOL_TARGET_TWO_OK`
- new Phase3613 target three emits `PHASE3613_FIFTY_ONE_TOOL_TARGET_THREE_OK`
- new Phase3614 target four emits `PHASE3614_FIFTY_ONE_TOOL_TARGET_FOUR_OK`
- new Phase3615 target five emits `PHASE3615_FIFTY_ONE_TOOL_TARGET_FIVE_OK`
- new Phase3616 target six emits `PHASE3616_FIFTY_ONE_TOOL_TARGET_SIX_OK`
- new Phase3617 target seven emits `PHASE3617_FIFTY_ONE_TOOL_TARGET_SEVEN_OK`
- new Phase3618 target eight emits `PHASE3618_FIFTY_ONE_TOOL_TARGET_EIGHT_OK`
- new Phase3619 target nine emits `PHASE3619_FIFTY_ONE_TOOL_TARGET_NINE_OK`
- new Phase3620 target ten emits `PHASE3620_FIFTY_ONE_TOOL_TARGET_TEN_OK`
- new Phase3621 target eleven emits `PHASE3621_FIFTY_ONE_TOOL_TARGET_ELEVEN_OK`
- new Phase3622 target twelve emits `PHASE3622_FIFTY_ONE_TOOL_TARGET_TWELVE_OK`
- new Phase3623 target thirteen emits `PHASE3623_FIFTY_ONE_TOOL_TARGET_THIRTEEN_OK`
- new Phase3624 target fourteen emits `PHASE3624_FIFTY_ONE_TOOL_TARGET_FOURTEEN_OK`
- new Phase3625 target fifteen emits `PHASE3625_FIFTY_ONE_TOOL_TARGET_FIFTEEN_OK`
- new Phase3626 target sixteen emits `PHASE3626_FIFTY_ONE_TOOL_TARGET_SIXTEEN_OK`
- new Phase3627 target seventeen emits `PHASE3627_FIFTY_ONE_TOOL_TARGET_SEVENTEEN_OK`
- new Phase3628 target eighteen emits `PHASE3628_FIFTY_ONE_TOOL_TARGET_EIGHTEEN_OK`
- new Phase3629 target nineteen emits `PHASE3629_FIFTY_ONE_TOOL_TARGET_NINETEEN_OK`
- new Phase3630 target twenty emits `PHASE3630_FIFTY_ONE_TOOL_TARGET_TWENTY_OK`
- new Phase3631 target twenty-one emits `PHASE3631_FIFTY_ONE_TOOL_TARGET_TWENTY_ONE_OK`
- new Phase3632 target twenty-two emits `PHASE3632_FIFTY_ONE_TOOL_TARGET_TWENTY_TWO_OK`
- new Phase3633 target twenty-three emits `PHASE3633_FIFTY_ONE_TOOL_TARGET_TWENTY_THREE_OK`
- new Phase3634 target twenty-four emits `PHASE3634_FIFTY_ONE_TOOL_TARGET_TWENTY_FOUR_OK`
- new Phase3635 target twenty-five emits `PHASE3635_FIFTY_ONE_TOOL_TARGET_TWENTY_FIVE_OK`
- new Phase3636 target twenty-six emits `PHASE3636_FIFTY_ONE_TOOL_TARGET_TWENTY_SIX_OK`
- new Phase3637 target twenty-seven emits `PHASE3637_FIFTY_ONE_TOOL_TARGET_TWENTY_SEVEN_OK`
- new Phase3638 target twenty-eight emits `PHASE3638_FIFTY_ONE_TOOL_TARGET_TWENTY_EIGHT_OK`
- new Phase3639 target twenty-nine emits `PHASE3639_FIFTY_ONE_TOOL_TARGET_TWENTY_NINE_OK`
- new Phase3640 target thirty emits `PHASE3640_FIFTY_ONE_TOOL_TARGET_THIRTY_OK`
- new Phase3641 target thirty-one emits `PHASE3641_FIFTY_ONE_TOOL_TARGET_THIRTY_ONE_OK`
- new Phase3642 target thirty-two emits `PHASE3642_FIFTY_ONE_TOOL_TARGET_THIRTY_TWO_OK`
- new Phase3643 target thirty-three emits `PHASE3643_FIFTY_ONE_TOOL_TARGET_THIRTY_THREE_OK`
- new Phase3644 target thirty-four emits `PHASE3644_FIFTY_ONE_TOOL_TARGET_THIRTY_FOUR_OK`
- new Phase3645 target thirty-five emits `PHASE3645_FIFTY_ONE_TOOL_TARGET_THIRTY_FIVE_OK`
- new Phase3646 target thirty-six emits `PHASE3646_FIFTY_ONE_TOOL_TARGET_THIRTY_SIX_OK`
- new Phase3647 target thirty-seven emits `PHASE3647_FIFTY_ONE_TOOL_TARGET_THIRTY_SEVEN_OK`
- new Phase3648 target thirty-eight emits `PHASE3648_FIFTY_ONE_TOOL_TARGET_THIRTY_EIGHT_OK`
- new Phase3649 target thirty-nine emits `PHASE3649_FIFTY_ONE_TOOL_TARGET_THIRTY_NINE_OK`
- new Phase3650 target forty emits `PHASE3650_FIFTY_ONE_TOOL_TARGET_FORTY_OK`
- new Phase3651 target forty-one emits `PHASE3651_FIFTY_ONE_TOOL_TARGET_FORTY_ONE_OK`
- new Phase3652 target forty-two emits `PHASE3652_FIFTY_ONE_TOOL_TARGET_FORTY_TWO_OK`
- new Phase3653 target forty-three emits `PHASE3653_FIFTY_ONE_TOOL_TARGET_FORTY_THREE_OK`
- new Phase3654 target forty-four emits `PHASE3654_FIFTY_ONE_TOOL_TARGET_FORTY_FOUR_OK`
- new Phase3655 target forty-five emits `PHASE3655_FIFTY_ONE_TOOL_TARGET_FORTY_FIVE_OK`
- new Phase3656 target forty-six emits `PHASE3656_FIFTY_ONE_TOOL_TARGET_FORTY_SIX_OK`
- new Phase3657 target forty-seven emits `PHASE3657_FIFTY_ONE_TOOL_TARGET_FORTY_SEVEN_OK`
- new Phase3658 target forty-eight emits `PHASE3658_FIFTY_ONE_TOOL_TARGET_FORTY_EIGHT_OK`
- new Phase3659 target forty-nine emits `PHASE3659_FIFTY_ONE_TOOL_TARGET_FORTY_NINE_OK`
- new Phase3660 target fifty emits `PHASE3660_FIFTY_ONE_TOOL_TARGET_FIFTY_OK`
- new Phase3661 target fifty-one emits `PHASE3661_FIFTY_ONE_TOOL_TARGET_FIFTY_ONE_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase3606-3661-controlled-fifty-one-tool-mutation
cmd /c pnpm run apply:phase3606-3661-controlled-fifty-one-tool-mutation
cmd /c pnpm run smoke:phase3606-3661-controlled-fifty-one-tool-mutation
cmd /c pnpm run verify:phase3606-3661-controlled-fifty-one-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the fifty-one target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a fifty-two-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
