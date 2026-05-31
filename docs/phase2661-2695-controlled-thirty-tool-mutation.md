# Phase2661A-2695A Controlled Thirty Tool Mutation

## Goal

Phase2661A-2695A extends the controlled local mutation line from twenty-nine files to thirty files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled thirty tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2627A-2660A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly thirty existing source-file mutations.
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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support thirty bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The thirty mutation batch must prove:
- new Phase2666 target one emits `PHASE2666_THIRTY_TOOL_TARGET_ONE_OK`
- new Phase2667 target two emits `PHASE2667_THIRTY_TOOL_TARGET_TWO_OK`
- new Phase2668 target three emits `PHASE2668_THIRTY_TOOL_TARGET_THREE_OK`
- new Phase2669 target four emits `PHASE2669_THIRTY_TOOL_TARGET_FOUR_OK`
- new Phase2670 target five emits `PHASE2670_THIRTY_TOOL_TARGET_FIVE_OK`
- new Phase2671 target six emits `PHASE2671_THIRTY_TOOL_TARGET_SIX_OK`
- new Phase2672 target seven emits `PHASE2672_THIRTY_TOOL_TARGET_SEVEN_OK`
- new Phase2673 target eight emits `PHASE2673_THIRTY_TOOL_TARGET_EIGHT_OK`
- new Phase2674 target nine emits `PHASE2674_THIRTY_TOOL_TARGET_NINE_OK`
- new Phase2675 target ten emits `PHASE2675_THIRTY_TOOL_TARGET_TEN_OK`
- new Phase2676 target eleven emits `PHASE2676_THIRTY_TOOL_TARGET_ELEVEN_OK`
- new Phase2677 target twelve emits `PHASE2677_THIRTY_TOOL_TARGET_TWELVE_OK`
- new Phase2678 target thirteen emits `PHASE2678_THIRTY_TOOL_TARGET_THIRTEEN_OK`
- new Phase2679 target fourteen emits `PHASE2679_THIRTY_TOOL_TARGET_FOURTEEN_OK`
- new Phase2680 target fifteen emits `PHASE2680_THIRTY_TOOL_TARGET_FIFTEEN_OK`
- new Phase2681 target sixteen emits `PHASE2681_THIRTY_TOOL_TARGET_SIXTEEN_OK`
- new Phase2682 target seventeen emits `PHASE2682_THIRTY_TOOL_TARGET_SEVENTEEN_OK`
- new Phase2683 target eighteen emits `PHASE2683_THIRTY_TOOL_TARGET_EIGHTEEN_OK`
- new Phase2684 target nineteen emits `PHASE2684_THIRTY_TOOL_TARGET_NINETEEN_OK`
- new Phase2685 target twenty emits `PHASE2685_THIRTY_TOOL_TARGET_TWENTY_OK`
- new Phase2686 target twenty-one emits `PHASE2686_THIRTY_TOOL_TARGET_TWENTY_ONE_OK`
- new Phase2687 target twenty-two emits `PHASE2687_THIRTY_TOOL_TARGET_TWENTY_TWO_OK`
- new Phase2688 target twenty-three emits `PHASE2688_THIRTY_TOOL_TARGET_TWENTY_THREE_OK`
- new Phase2689 target twenty-four emits `PHASE2689_THIRTY_TOOL_TARGET_TWENTY_FOUR_OK`
- new Phase2690 target twenty-five emits `PHASE2690_THIRTY_TOOL_TARGET_TWENTY_FIVE_OK`
- new Phase2691 target twenty-six emits `PHASE2691_THIRTY_TOOL_TARGET_TWENTY_SIX_OK`
- new Phase2692 target twenty-seven emits `PHASE2692_THIRTY_TOOL_TARGET_TWENTY_SEVEN_OK`
- new Phase2693 target twenty-eight emits `PHASE2693_THIRTY_TOOL_TARGET_TWENTY_EIGHT_OK`
- new Phase2694 target twenty-nine emits `PHASE2694_THIRTY_TOOL_TARGET_TWENTY_NINE_OK`
- new Phase2695 target thirty emits `PHASE2695_THIRTY_TOOL_TARGET_THIRTY_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2661-2695-controlled-thirty-tool-mutation
cmd /c pnpm run apply:phase2661-2695-controlled-thirty-tool-mutation
cmd /c pnpm run smoke:phase2661-2695-controlled-thirty-tool-mutation
cmd /c pnpm run verify:phase2661-2695-controlled-thirty-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the thirty target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a twenty-seven-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
