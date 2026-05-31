# Phase2969A-3011A Controlled Thirty-Eight Tool Mutation

## Goal

Phase2969A-3011A extends the controlled local mutation line from thirty-seven files to thirty-eight files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled thirty-eight tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2927A-2968A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly thirty-eight existing source-file mutations.
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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support thirty-eight bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The thirty-eight mutation batch must prove:
- new Phase2974 target one emits `PHASE2974_THIRTY_EIGHT_TOOL_TARGET_ONE_OK`
- new Phase2975 target two emits `PHASE2975_THIRTY_EIGHT_TOOL_TARGET_TWO_OK`
- new Phase2976 target three emits `PHASE2976_THIRTY_EIGHT_TOOL_TARGET_THREE_OK`
- new Phase2977 target four emits `PHASE2977_THIRTY_EIGHT_TOOL_TARGET_FOUR_OK`
- new Phase2978 target five emits `PHASE2978_THIRTY_EIGHT_TOOL_TARGET_FIVE_OK`
- new Phase2979 target six emits `PHASE2979_THIRTY_EIGHT_TOOL_TARGET_SIX_OK`
- new Phase2980 target seven emits `PHASE2980_THIRTY_EIGHT_TOOL_TARGET_SEVEN_OK`
- new Phase2981 target eight emits `PHASE2981_THIRTY_EIGHT_TOOL_TARGET_EIGHT_OK`
- new Phase2982 target nine emits `PHASE2982_THIRTY_EIGHT_TOOL_TARGET_NINE_OK`
- new Phase2983 target ten emits `PHASE2983_THIRTY_EIGHT_TOOL_TARGET_TEN_OK`
- new Phase2984 target eleven emits `PHASE2984_THIRTY_EIGHT_TOOL_TARGET_ELEVEN_OK`
- new Phase2985 target twelve emits `PHASE2985_THIRTY_EIGHT_TOOL_TARGET_TWELVE_OK`
- new Phase2986 target thirteen emits `PHASE2986_THIRTY_EIGHT_TOOL_TARGET_THIRTEEN_OK`
- new Phase2987 target fourteen emits `PHASE2987_THIRTY_EIGHT_TOOL_TARGET_FOURTEEN_OK`
- new Phase2988 target fifteen emits `PHASE2988_THIRTY_EIGHT_TOOL_TARGET_FIFTEEN_OK`
- new Phase2989 target sixteen emits `PHASE2989_THIRTY_EIGHT_TOOL_TARGET_SIXTEEN_OK`
- new Phase2990 target seventeen emits `PHASE2990_THIRTY_EIGHT_TOOL_TARGET_SEVENTEEN_OK`
- new Phase2991 target eighteen emits `PHASE2991_THIRTY_EIGHT_TOOL_TARGET_EIGHTEEN_OK`
- new Phase2992 target nineteen emits `PHASE2992_THIRTY_EIGHT_TOOL_TARGET_NINETEEN_OK`
- new Phase2993 target twenty emits `PHASE2993_THIRTY_EIGHT_TOOL_TARGET_TWENTY_OK`
- new Phase2994 target twenty-one emits `PHASE2994_THIRTY_EIGHT_TOOL_TARGET_TWENTY_ONE_OK`
- new Phase2995 target twenty-two emits `PHASE2995_THIRTY_EIGHT_TOOL_TARGET_TWENTY_TWO_OK`
- new Phase2996 target twenty-three emits `PHASE2996_THIRTY_EIGHT_TOOL_TARGET_TWENTY_THREE_OK`
- new Phase2997 target twenty-four emits `PHASE2997_THIRTY_EIGHT_TOOL_TARGET_TWENTY_FOUR_OK`
- new Phase2998 target twenty-five emits `PHASE2998_THIRTY_EIGHT_TOOL_TARGET_TWENTY_FIVE_OK`
- new Phase2999 target twenty-six emits `PHASE2999_THIRTY_EIGHT_TOOL_TARGET_TWENTY_SIX_OK`
- new Phase3000 target twenty-seven emits `PHASE3000_THIRTY_EIGHT_TOOL_TARGET_TWENTY_SEVEN_OK`
- new Phase3001 target twenty-eight emits `PHASE3001_THIRTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK`
- new Phase3002 target twenty-nine emits `PHASE3002_THIRTY_EIGHT_TOOL_TARGET_TWENTY_NINE_OK`
- new Phase3003 target thirty emits `PHASE3003_THIRTY_EIGHT_TOOL_TARGET_THIRTY_OK`
- new Phase3004 target thirty-one emits `PHASE3004_THIRTY_EIGHT_TOOL_TARGET_THIRTY_ONE_OK`
- new Phase3005 target thirty-two emits `PHASE3005_THIRTY_EIGHT_TOOL_TARGET_THIRTY_TWO_OK`
- new Phase3006 target thirty-three emits `PHASE3006_THIRTY_EIGHT_TOOL_TARGET_THIRTY_THREE_OK`
- new Phase3007 target thirty-four emits `PHASE3007_THIRTY_EIGHT_TOOL_TARGET_THIRTY_FOUR_OK`
- new Phase3008 target thirty-five emits `PHASE3008_THIRTY_EIGHT_TOOL_TARGET_THIRTY_FIVE_OK`
- new Phase3009 target thirty-six emits `PHASE3009_THIRTY_EIGHT_TOOL_TARGET_THIRTY_SIX_OK`
- new Phase3010 target thirty-seven emits `PHASE3010_THIRTY_EIGHT_TOOL_TARGET_THIRTY_SEVEN_OK`
- new Phase3011 target thirty-eight emits `PHASE3011_THIRTY_EIGHT_TOOL_TARGET_THIRTY_EIGHT_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2969-3011-controlled-thirty-eight-tool-mutation
cmd /c pnpm run apply:phase2969-3011-controlled-thirty-eight-tool-mutation
cmd /c pnpm run smoke:phase2969-3011-controlled-thirty-eight-tool-mutation
cmd /c pnpm run verify:phase2969-3011-controlled-thirty-eight-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the thirty-eight target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a thirty-eight-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
