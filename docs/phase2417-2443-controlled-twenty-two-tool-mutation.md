# Phase2417A-2443A Controlled Twenty-Two Tool Mutation

## Goal

Phase2417A-2443A extends the controlled local mutation line from twenty-one files to twenty-two files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled twenty-two tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2391A-2416A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly twenty-two existing source-file mutations.
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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support twenty-two bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The twenty-two mutation batch must prove:
- new Phase2422 target one emits `PHASE2422_TWENTY_TWO_TOOL_TARGET_ONE_OK`
- new Phase2423 target two emits `PHASE2423_TWENTY_TWO_TOOL_TARGET_TWO_OK`
- new Phase2424 target three emits `PHASE2424_TWENTY_TWO_TOOL_TARGET_THREE_OK`
- new Phase2425 target four emits `PHASE2425_TWENTY_TWO_TOOL_TARGET_FOUR_OK`
- new Phase2426 target five emits `PHASE2426_TWENTY_TWO_TOOL_TARGET_FIVE_OK`
- new Phase2427 target six emits `PHASE2427_TWENTY_TWO_TOOL_TARGET_SIX_OK`
- new Phase2428 target seven emits `PHASE2428_TWENTY_TWO_TOOL_TARGET_SEVEN_OK`
- new Phase2429 target eight emits `PHASE2429_TWENTY_TWO_TOOL_TARGET_EIGHT_OK`
- new Phase2430 target nine emits `PHASE2430_TWENTY_TWO_TOOL_TARGET_NINE_OK`
- new Phase2431 target ten emits `PHASE2431_TWENTY_TWO_TOOL_TARGET_TEN_OK`
- new Phase2432 target eleven emits `PHASE2432_TWENTY_TWO_TOOL_TARGET_ELEVEN_OK`
- new Phase2433 target twelve emits `PHASE2433_TWENTY_TWO_TOOL_TARGET_TWELVE_OK`
- new Phase2434 target thirteen emits `PHASE2434_TWENTY_TWO_TOOL_TARGET_THIRTEEN_OK`
- new Phase2435 target fourteen emits `PHASE2435_TWENTY_TWO_TOOL_TARGET_FOURTEEN_OK`
- new Phase2436 target fifteen emits `PHASE2436_TWENTY_TWO_TOOL_TARGET_FIFTEEN_OK`
- new Phase2437 target sixteen emits `PHASE2437_TWENTY_TWO_TOOL_TARGET_SIXTEEN_OK`
- new Phase2438 target seventeen emits `PHASE2438_TWENTY_TWO_TOOL_TARGET_SEVENTEEN_OK`
- new Phase2439 target eighteen emits `PHASE2439_TWENTY_TWO_TOOL_TARGET_EIGHTEEN_OK`
- new Phase2440 target nineteen emits `PHASE2440_TWENTY_TWO_TOOL_TARGET_NINETEEN_OK`
- new Phase2441 target twenty emits `PHASE2441_TWENTY_TWO_TOOL_TARGET_TWENTY_OK`
- new Phase2442 target twenty-one emits `PHASE2442_TWENTY_TWO_TOOL_TARGET_TWENTY_ONE_OK`
- new Phase2443 target twenty-two emits `PHASE2443_TWENTY_TWO_TOOL_TARGET_TWENTY_TWO_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2417-2443-controlled-twenty-two-tool-mutation
cmd /c pnpm run apply:phase2417-2443-controlled-twenty-two-tool-mutation
cmd /c pnpm run smoke:phase2417-2443-controlled-twenty-two-tool-mutation
cmd /c pnpm run verify:phase2417-2443-controlled-twenty-two-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the twenty-two target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a twenty-three-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
