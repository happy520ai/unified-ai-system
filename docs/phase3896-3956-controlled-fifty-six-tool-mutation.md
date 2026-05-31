# Phase3896A-3956A Controlled Fifty-Six Tool Mutation

## Goal

Phase3896A-3956A extends the controlled local mutation line from fifty-five files to fifty-six files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled fifty-six tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase3836A-3895A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly fifty-six existing source-file mutations.
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
  - `tools/phase3606_3661/apply-controlled-fifty-one-tool-mutation.mjs`
  - `tools/phase3662_3718/apply-controlled-fifty-two-tool-mutation.mjs`
  - `tools/phase3719_3776/apply-controlled-fifty-three-tool-mutation.mjs`
  - `tools/phase3777_3835/apply-controlled-fifty-four-tool-mutation.mjs`
  - `tools/phase3836_3895/apply-controlled-fifty-five-tool-mutation.mjs`

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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support fifty-six bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The fifty-six mutation batch must prove:
- new Phase3901 target one emits `PHASE3901_FIFTY_SIX_TOOL_TARGET_ONE_OK`
- new Phase3902 target two emits `PHASE3902_FIFTY_SIX_TOOL_TARGET_TWO_OK`
- new Phase3903 target three emits `PHASE3903_FIFTY_SIX_TOOL_TARGET_THREE_OK`
- new Phase3904 target four emits `PHASE3904_FIFTY_SIX_TOOL_TARGET_FOUR_OK`
- new Phase3905 target five emits `PHASE3905_FIFTY_SIX_TOOL_TARGET_FIVE_OK`
- new Phase3906 target six emits `PHASE3906_FIFTY_SIX_TOOL_TARGET_SIX_OK`
- new Phase3907 target seven emits `PHASE3907_FIFTY_SIX_TOOL_TARGET_SEVEN_OK`
- new Phase3908 target eight emits `PHASE3908_FIFTY_SIX_TOOL_TARGET_EIGHT_OK`
- new Phase3909 target nine emits `PHASE3909_FIFTY_SIX_TOOL_TARGET_NINE_OK`
- new Phase3910 target ten emits `PHASE3910_FIFTY_SIX_TOOL_TARGET_TEN_OK`
- new Phase3911 target eleven emits `PHASE3911_FIFTY_SIX_TOOL_TARGET_ELEVEN_OK`
- new Phase3912 target twelve emits `PHASE3912_FIFTY_SIX_TOOL_TARGET_TWELVE_OK`
- new Phase3913 target thirteen emits `PHASE3913_FIFTY_SIX_TOOL_TARGET_THIRTEEN_OK`
- new Phase3914 target fourteen emits `PHASE3914_FIFTY_SIX_TOOL_TARGET_FOURTEEN_OK`
- new Phase3915 target fifteen emits `PHASE3915_FIFTY_SIX_TOOL_TARGET_FIFTEEN_OK`
- new Phase3916 target sixteen emits `PHASE3916_FIFTY_SIX_TOOL_TARGET_SIXTEEN_OK`
- new Phase3917 target seventeen emits `PHASE3917_FIFTY_SIX_TOOL_TARGET_SEVENTEEN_OK`
- new Phase3918 target eighteen emits `PHASE3918_FIFTY_SIX_TOOL_TARGET_EIGHTEEN_OK`
- new Phase3919 target nineteen emits `PHASE3919_FIFTY_SIX_TOOL_TARGET_NINETEEN_OK`
- new Phase3920 target twenty emits `PHASE3920_FIFTY_SIX_TOOL_TARGET_TWENTY_OK`
- new Phase3921 target twenty-one emits `PHASE3921_FIFTY_SIX_TOOL_TARGET_TWENTY_ONE_OK`
- new Phase3922 target twenty-two emits `PHASE3922_FIFTY_SIX_TOOL_TARGET_TWENTY_TWO_OK`
- new Phase3923 target twenty-three emits `PHASE3923_FIFTY_SIX_TOOL_TARGET_TWENTY_THREE_OK`
- new Phase3924 target twenty-four emits `PHASE3924_FIFTY_SIX_TOOL_TARGET_TWENTY_FOUR_OK`
- new Phase3925 target twenty-five emits `PHASE3925_FIFTY_SIX_TOOL_TARGET_TWENTY_FIVE_OK`
- new Phase3926 target twenty-six emits `PHASE3926_FIFTY_SIX_TOOL_TARGET_TWENTY_SIX_OK`
- new Phase3927 target twenty-seven emits `PHASE3927_FIFTY_SIX_TOOL_TARGET_TWENTY_SEVEN_OK`
- new Phase3928 target twenty-eight emits `PHASE3928_FIFTY_SIX_TOOL_TARGET_TWENTY_EIGHT_OK`
- new Phase3929 target twenty-nine emits `PHASE3929_FIFTY_SIX_TOOL_TARGET_TWENTY_NINE_OK`
- new Phase3930 target thirty emits `PHASE3930_FIFTY_SIX_TOOL_TARGET_THIRTY_OK`
- new Phase3931 target thirty-one emits `PHASE3931_FIFTY_SIX_TOOL_TARGET_THIRTY_ONE_OK`
- new Phase3932 target thirty-two emits `PHASE3932_FIFTY_SIX_TOOL_TARGET_THIRTY_TWO_OK`
- new Phase3933 target thirty-three emits `PHASE3933_FIFTY_SIX_TOOL_TARGET_THIRTY_THREE_OK`
- new Phase3934 target thirty-four emits `PHASE3934_FIFTY_SIX_TOOL_TARGET_THIRTY_FOUR_OK`
- new Phase3935 target thirty-five emits `PHASE3935_FIFTY_SIX_TOOL_TARGET_THIRTY_FIVE_OK`
- new Phase3936 target thirty-six emits `PHASE3936_FIFTY_SIX_TOOL_TARGET_THIRTY_SIX_OK`
- new Phase3937 target thirty-seven emits `PHASE3937_FIFTY_SIX_TOOL_TARGET_THIRTY_SEVEN_OK`
- new Phase3938 target thirty-eight emits `PHASE3938_FIFTY_SIX_TOOL_TARGET_THIRTY_EIGHT_OK`
- new Phase3939 target thirty-nine emits `PHASE3939_FIFTY_SIX_TOOL_TARGET_THIRTY_NINE_OK`
- new Phase3940 target forty emits `PHASE3940_FIFTY_SIX_TOOL_TARGET_FORTY_OK`
- new Phase3941 target forty-one emits `PHASE3941_FIFTY_SIX_TOOL_TARGET_FORTY_ONE_OK`
- new Phase3942 target forty-two emits `PHASE3942_FIFTY_SIX_TOOL_TARGET_FORTY_TWO_OK`
- new Phase3943 target forty-three emits `PHASE3943_FIFTY_SIX_TOOL_TARGET_FORTY_THREE_OK`
- new Phase3944 target forty-four emits `PHASE3944_FIFTY_SIX_TOOL_TARGET_FORTY_FOUR_OK`
- new Phase3945 target forty-five emits `PHASE3945_FIFTY_SIX_TOOL_TARGET_FORTY_FIVE_OK`
- new Phase3946 target forty-six emits `PHASE3946_FIFTY_SIX_TOOL_TARGET_FORTY_SIX_OK`
- new Phase3947 target forty-seven emits `PHASE3947_FIFTY_SIX_TOOL_TARGET_FORTY_SEVEN_OK`
- new Phase3948 target forty-eight emits `PHASE3948_FIFTY_SIX_TOOL_TARGET_FORTY_EIGHT_OK`
- new Phase3949 target forty-nine emits `PHASE3949_FIFTY_SIX_TOOL_TARGET_FORTY_NINE_OK`
- new Phase3950 target fifty emits `PHASE3950_FIFTY_SIX_TOOL_TARGET_FIFTY_OK`
- new Phase3951 target fifty-one emits `PHASE3951_FIFTY_SIX_TOOL_TARGET_FIFTY_ONE_OK`
- new Phase3952 target fifty-two emits `PHASE3952_FIFTY_SIX_TOOL_TARGET_FIFTY_TWO_OK`
- new Phase3953 target fifty-three emits `PHASE3953_FIFTY_SIX_TOOL_TARGET_FIFTY_THREE_OK`
- new Phase3954 target fifty-four emits `PHASE3954_FIFTY_SIX_TOOL_TARGET_FIFTY_FOUR_OK`
- new Phase3955 target fifty-five emits `PHASE3955_FIFTY_SIX_TOOL_TARGET_FIFTY_FIVE_OK`
- new Phase3956 target fifty-six emits `PHASE3956_FIFTY_SIX_TOOL_TARGET_FIFTY_SIX_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase3896-3956-controlled-fifty-six-tool-mutation
cmd /c pnpm run apply:phase3896-3956-controlled-fifty-six-tool-mutation
cmd /c pnpm run smoke:phase3896-3956-controlled-fifty-six-tool-mutation
cmd /c pnpm run verify:phase3896-3956-controlled-fifty-six-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the fifty-six target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a fifty-seven-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
