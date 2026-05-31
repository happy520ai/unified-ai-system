# Phase2562A-2593A Controlled Twenty-Seven Tool Mutation

## Goal

Phase2562A-2593A extends the controlled local mutation line from twenty-six files to twenty-seven files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled twenty-seven tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2531A-2561A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly twenty-seven existing source-file mutations.
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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support twenty-seven bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The twenty-seven mutation batch must prove:
- new Phase2567 target one emits `PHASE2567_TWENTY_SEVEN_TOOL_TARGET_ONE_OK`
- new Phase2568 target two emits `PHASE2568_TWENTY_SEVEN_TOOL_TARGET_TWO_OK`
- new Phase2569 target three emits `PHASE2569_TWENTY_SEVEN_TOOL_TARGET_THREE_OK`
- new Phase2570 target four emits `PHASE2570_TWENTY_SEVEN_TOOL_TARGET_FOUR_OK`
- new Phase2571 target five emits `PHASE2571_TWENTY_SEVEN_TOOL_TARGET_FIVE_OK`
- new Phase2572 target six emits `PHASE2572_TWENTY_SEVEN_TOOL_TARGET_SIX_OK`
- new Phase2573 target seven emits `PHASE2573_TWENTY_SEVEN_TOOL_TARGET_SEVEN_OK`
- new Phase2574 target eight emits `PHASE2574_TWENTY_SEVEN_TOOL_TARGET_EIGHT_OK`
- new Phase2575 target nine emits `PHASE2575_TWENTY_SEVEN_TOOL_TARGET_NINE_OK`
- new Phase2576 target ten emits `PHASE2576_TWENTY_SEVEN_TOOL_TARGET_TEN_OK`
- new Phase2577 target eleven emits `PHASE2577_TWENTY_SEVEN_TOOL_TARGET_ELEVEN_OK`
- new Phase2578 target twelve emits `PHASE2578_TWENTY_SEVEN_TOOL_TARGET_TWELVE_OK`
- new Phase2579 target thirteen emits `PHASE2579_TWENTY_SEVEN_TOOL_TARGET_THIRTEEN_OK`
- new Phase2580 target fourteen emits `PHASE2580_TWENTY_SEVEN_TOOL_TARGET_FOURTEEN_OK`
- new Phase2581 target fifteen emits `PHASE2581_TWENTY_SEVEN_TOOL_TARGET_FIFTEEN_OK`
- new Phase2582 target sixteen emits `PHASE2582_TWENTY_SEVEN_TOOL_TARGET_SIXTEEN_OK`
- new Phase2583 target seventeen emits `PHASE2583_TWENTY_SEVEN_TOOL_TARGET_SEVENTEEN_OK`
- new Phase2584 target eighteen emits `PHASE2584_TWENTY_SEVEN_TOOL_TARGET_EIGHTEEN_OK`
- new Phase2585 target nineteen emits `PHASE2585_TWENTY_SEVEN_TOOL_TARGET_NINETEEN_OK`
- new Phase2586 target twenty emits `PHASE2586_TWENTY_SEVEN_TOOL_TARGET_TWENTY_OK`
- new Phase2587 target twenty-one emits `PHASE2587_TWENTY_SEVEN_TOOL_TARGET_TWENTY_ONE_OK`
- new Phase2588 target twenty-two emits `PHASE2588_TWENTY_SEVEN_TOOL_TARGET_TWENTY_TWO_OK`
- new Phase2589 target twenty-three emits `PHASE2589_TWENTY_SEVEN_TOOL_TARGET_TWENTY_THREE_OK`
- new Phase2590 target twenty-four emits `PHASE2590_TWENTY_SEVEN_TOOL_TARGET_TWENTY_FOUR_OK`
- new Phase2591 target twenty-five emits `PHASE2591_TWENTY_SEVEN_TOOL_TARGET_TWENTY_FIVE_OK`
- new Phase2592 target twenty-six emits `PHASE2592_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SIX_OK`
- new Phase2593 target twenty-seven emits `PHASE2593_TWENTY_SEVEN_TOOL_TARGET_TWENTY_SEVEN_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2562-2593-controlled-twenty-seven-tool-mutation
cmd /c pnpm run apply:phase2562-2593-controlled-twenty-seven-tool-mutation
cmd /c pnpm run smoke:phase2562-2593-controlled-twenty-seven-tool-mutation
cmd /c pnpm run verify:phase2562-2593-controlled-twenty-seven-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the twenty-seven target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a twenty-seven-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
