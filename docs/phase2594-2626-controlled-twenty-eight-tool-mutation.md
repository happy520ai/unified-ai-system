# Phase2594A-2626A Controlled Twenty-Eight Tool Mutation

## Goal

Phase2594A-2626A extends the controlled local mutation line from twenty-seven files to twenty-eight files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled twenty-eight tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2562A-2593A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly twenty-eight existing source-file mutations.
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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support twenty-eight bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The twenty-eight mutation batch must prove:
- new Phase2599 target one emits `PHASE2599_TWENTY_EIGHT_TOOL_TARGET_ONE_OK`
- new Phase2600 target two emits `PHASE2600_TWENTY_EIGHT_TOOL_TARGET_TWO_OK`
- new Phase2601 target three emits `PHASE2601_TWENTY_EIGHT_TOOL_TARGET_THREE_OK`
- new Phase2602 target four emits `PHASE2602_TWENTY_EIGHT_TOOL_TARGET_FOUR_OK`
- new Phase2603 target five emits `PHASE2603_TWENTY_EIGHT_TOOL_TARGET_FIVE_OK`
- new Phase2604 target six emits `PHASE2604_TWENTY_EIGHT_TOOL_TARGET_SIX_OK`
- new Phase2605 target seven emits `PHASE2605_TWENTY_EIGHT_TOOL_TARGET_SEVEN_OK`
- new Phase2606 target eight emits `PHASE2606_TWENTY_EIGHT_TOOL_TARGET_EIGHT_OK`
- new Phase2607 target nine emits `PHASE2607_TWENTY_EIGHT_TOOL_TARGET_NINE_OK`
- new Phase2608 target ten emits `PHASE2608_TWENTY_EIGHT_TOOL_TARGET_TEN_OK`
- new Phase2609 target eleven emits `PHASE2609_TWENTY_EIGHT_TOOL_TARGET_ELEVEN_OK`
- new Phase2610 target twelve emits `PHASE2610_TWENTY_EIGHT_TOOL_TARGET_TWELVE_OK`
- new Phase2611 target thirteen emits `PHASE2611_TWENTY_EIGHT_TOOL_TARGET_THIRTEEN_OK`
- new Phase2612 target fourteen emits `PHASE2612_TWENTY_EIGHT_TOOL_TARGET_FOURTEEN_OK`
- new Phase2613 target fifteen emits `PHASE2613_TWENTY_EIGHT_TOOL_TARGET_FIFTEEN_OK`
- new Phase2614 target sixteen emits `PHASE2614_TWENTY_EIGHT_TOOL_TARGET_SIXTEEN_OK`
- new Phase2615 target seventeen emits `PHASE2615_TWENTY_EIGHT_TOOL_TARGET_SEVENTEEN_OK`
- new Phase2616 target eighteen emits `PHASE2616_TWENTY_EIGHT_TOOL_TARGET_EIGHTEEN_OK`
- new Phase2617 target nineteen emits `PHASE2617_TWENTY_EIGHT_TOOL_TARGET_NINETEEN_OK`
- new Phase2618 target twenty emits `PHASE2618_TWENTY_EIGHT_TOOL_TARGET_TWENTY_OK`
- new Phase2619 target twenty-one emits `PHASE2619_TWENTY_EIGHT_TOOL_TARGET_TWENTY_ONE_OK`
- new Phase2620 target twenty-two emits `PHASE2620_TWENTY_EIGHT_TOOL_TARGET_TWENTY_TWO_OK`
- new Phase2621 target twenty-three emits `PHASE2621_TWENTY_EIGHT_TOOL_TARGET_TWENTY_THREE_OK`
- new Phase2622 target twenty-four emits `PHASE2622_TWENTY_EIGHT_TOOL_TARGET_TWENTY_FOUR_OK`
- new Phase2623 target twenty-five emits `PHASE2623_TWENTY_EIGHT_TOOL_TARGET_TWENTY_FIVE_OK`
- new Phase2624 target twenty-six emits `PHASE2624_TWENTY_EIGHT_TOOL_TARGET_TWENTY_SIX_OK`
- new Phase2625 target twenty-seven emits `PHASE2625_TWENTY_EIGHT_TOOL_TARGET_TWENTY_SEVEN_OK`
- new Phase2626 target twenty-eight emits `PHASE2626_TWENTY_EIGHT_TOOL_TARGET_TWENTY_EIGHT_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2594-2626-controlled-twenty-eight-tool-mutation
cmd /c pnpm run apply:phase2594-2626-controlled-twenty-eight-tool-mutation
cmd /c pnpm run smoke:phase2594-2626-controlled-twenty-eight-tool-mutation
cmd /c pnpm run verify:phase2594-2626-controlled-twenty-eight-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the twenty-eight target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a twenty-seven-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
