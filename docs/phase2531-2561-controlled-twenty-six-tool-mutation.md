# Phase2531A-2561A Controlled Twenty-Six Tool Mutation

## Goal

Phase2531A-2561A extends the controlled local mutation line from twenty-five files to twenty-six files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled twenty-six tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2501A-2530A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly twenty-six existing source-file mutations.
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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support twenty-six bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The twenty-six mutation batch must prove:
- new Phase2536 target one emits `PHASE2536_TWENTY_SIX_TOOL_TARGET_ONE_OK`
- new Phase2537 target two emits `PHASE2537_TWENTY_SIX_TOOL_TARGET_TWO_OK`
- new Phase2538 target three emits `PHASE2538_TWENTY_SIX_TOOL_TARGET_THREE_OK`
- new Phase2539 target four emits `PHASE2539_TWENTY_SIX_TOOL_TARGET_FOUR_OK`
- new Phase2540 target five emits `PHASE2540_TWENTY_SIX_TOOL_TARGET_FIVE_OK`
- new Phase2541 target six emits `PHASE2541_TWENTY_SIX_TOOL_TARGET_SIX_OK`
- new Phase2542 target seven emits `PHASE2542_TWENTY_SIX_TOOL_TARGET_SEVEN_OK`
- new Phase2543 target eight emits `PHASE2543_TWENTY_SIX_TOOL_TARGET_EIGHT_OK`
- new Phase2544 target nine emits `PHASE2544_TWENTY_SIX_TOOL_TARGET_NINE_OK`
- new Phase2545 target ten emits `PHASE2545_TWENTY_SIX_TOOL_TARGET_TEN_OK`
- new Phase2546 target eleven emits `PHASE2546_TWENTY_SIX_TOOL_TARGET_ELEVEN_OK`
- new Phase2547 target twelve emits `PHASE2547_TWENTY_SIX_TOOL_TARGET_TWELVE_OK`
- new Phase2548 target thirteen emits `PHASE2548_TWENTY_SIX_TOOL_TARGET_THIRTEEN_OK`
- new Phase2549 target fourteen emits `PHASE2549_TWENTY_SIX_TOOL_TARGET_FOURTEEN_OK`
- new Phase2550 target fifteen emits `PHASE2550_TWENTY_SIX_TOOL_TARGET_FIFTEEN_OK`
- new Phase2551 target sixteen emits `PHASE2551_TWENTY_SIX_TOOL_TARGET_SIXTEEN_OK`
- new Phase2552 target seventeen emits `PHASE2552_TWENTY_SIX_TOOL_TARGET_SEVENTEEN_OK`
- new Phase2553 target eighteen emits `PHASE2553_TWENTY_SIX_TOOL_TARGET_EIGHTEEN_OK`
- new Phase2554 target nineteen emits `PHASE2554_TWENTY_SIX_TOOL_TARGET_NINETEEN_OK`
- new Phase2555 target twenty emits `PHASE2555_TWENTY_SIX_TOOL_TARGET_TWENTY_OK`
- new Phase2556 target twenty-one emits `PHASE2556_TWENTY_SIX_TOOL_TARGET_TWENTY_ONE_OK`
- new Phase2557 target twenty-two emits `PHASE2557_TWENTY_SIX_TOOL_TARGET_TWENTY_TWO_OK`
- new Phase2558 target twenty-three emits `PHASE2558_TWENTY_SIX_TOOL_TARGET_TWENTY_THREE_OK`
- new Phase2559 target twenty-four emits `PHASE2559_TWENTY_SIX_TOOL_TARGET_TWENTY_FOUR_OK`
- new Phase2560 target twenty-five emits `PHASE2560_TWENTY_SIX_TOOL_TARGET_TWENTY_FIVE_OK`
- new Phase2561 target twenty-six emits `PHASE2561_TWENTY_SIX_TOOL_TARGET_TWENTY_SIX_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2531-2561-controlled-twenty-six-tool-mutation
cmd /c pnpm run apply:phase2531-2561-controlled-twenty-six-tool-mutation
cmd /c pnpm run smoke:phase2531-2561-controlled-twenty-six-tool-mutation
cmd /c pnpm run verify:phase2531-2561-controlled-twenty-six-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the twenty-six target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a twenty-seven-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
