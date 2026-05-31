# Phase2444A-2471A Controlled Twenty-Three Tool Mutation

## Goal

Phase2444A-2471A extends the controlled local mutation line from twenty-two files to twenty-three files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled twenty-three tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2417A-2443A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly twenty-three existing source-file mutations.
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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support twenty-three bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The twenty-three mutation batch must prove:
- new Phase2449 target one emits `PHASE2449_TWENTY_THREE_TOOL_TARGET_ONE_OK`
- new Phase2450 target two emits `PHASE2450_TWENTY_THREE_TOOL_TARGET_TWO_OK`
- new Phase2451 target three emits `PHASE2451_TWENTY_THREE_TOOL_TARGET_THREE_OK`
- new Phase2452 target four emits `PHASE2452_TWENTY_THREE_TOOL_TARGET_FOUR_OK`
- new Phase2453 target five emits `PHASE2453_TWENTY_THREE_TOOL_TARGET_FIVE_OK`
- new Phase2454 target six emits `PHASE2454_TWENTY_THREE_TOOL_TARGET_SIX_OK`
- new Phase2455 target seven emits `PHASE2455_TWENTY_THREE_TOOL_TARGET_SEVEN_OK`
- new Phase2456 target eight emits `PHASE2456_TWENTY_THREE_TOOL_TARGET_EIGHT_OK`
- new Phase2457 target nine emits `PHASE2457_TWENTY_THREE_TOOL_TARGET_NINE_OK`
- new Phase2458 target ten emits `PHASE2458_TWENTY_THREE_TOOL_TARGET_TEN_OK`
- new Phase2459 target eleven emits `PHASE2459_TWENTY_THREE_TOOL_TARGET_ELEVEN_OK`
- new Phase2460 target twelve emits `PHASE2460_TWENTY_THREE_TOOL_TARGET_TWELVE_OK`
- new Phase2461 target thirteen emits `PHASE2461_TWENTY_THREE_TOOL_TARGET_THIRTEEN_OK`
- new Phase2462 target fourteen emits `PHASE2462_TWENTY_THREE_TOOL_TARGET_FOURTEEN_OK`
- new Phase2463 target fifteen emits `PHASE2463_TWENTY_THREE_TOOL_TARGET_FIFTEEN_OK`
- new Phase2464 target sixteen emits `PHASE2464_TWENTY_THREE_TOOL_TARGET_SIXTEEN_OK`
- new Phase2465 target seventeen emits `PHASE2465_TWENTY_THREE_TOOL_TARGET_SEVENTEEN_OK`
- new Phase2466 target eighteen emits `PHASE2466_TWENTY_THREE_TOOL_TARGET_EIGHTEEN_OK`
- new Phase2467 target nineteen emits `PHASE2467_TWENTY_THREE_TOOL_TARGET_NINETEEN_OK`
- new Phase2468 target twenty emits `PHASE2468_TWENTY_THREE_TOOL_TARGET_TWENTY_OK`
- new Phase2469 target twenty-one emits `PHASE2469_TWENTY_THREE_TOOL_TARGET_TWENTY_ONE_OK`
- new Phase2470 target twenty-two emits `PHASE2470_TWENTY_THREE_TOOL_TARGET_TWENTY_TWO_OK`
- new Phase2471 target twenty-three emits `PHASE2471_TWENTY_THREE_TOOL_TARGET_TWENTY_THREE_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2444-2471-controlled-twenty-three-tool-mutation
cmd /c pnpm run apply:phase2444-2471-controlled-twenty-three-tool-mutation
cmd /c pnpm run smoke:phase2444-2471-controlled-twenty-three-tool-mutation
cmd /c pnpm run verify:phase2444-2471-controlled-twenty-three-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the twenty-three target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a twenty-four-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
