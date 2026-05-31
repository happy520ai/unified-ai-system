# Phase2391A-2416A Controlled Twenty-One Tool Mutation

## Goal

Phase2391A-2416A extends the controlled local mutation line from twenty files to twenty-one files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled twenty-one tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2366A-2390A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly twenty-one existing source-file mutations.
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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support twenty-one bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The twenty-one mutation batch must prove:
- new Phase2396 target one emits `PHASE2396_TWENTY_ONE_TOOL_TARGET_ONE_OK`
- new Phase2397 target two emits `PHASE2397_TWENTY_ONE_TOOL_TARGET_TWO_OK`
- new Phase2398 target three emits `PHASE2398_TWENTY_ONE_TOOL_TARGET_THREE_OK`
- new Phase2399 target four emits `PHASE2399_TWENTY_ONE_TOOL_TARGET_FOUR_OK`
- new Phase2400 target five emits `PHASE2400_TWENTY_ONE_TOOL_TARGET_FIVE_OK`
- new Phase2401 target six emits `PHASE2401_TWENTY_ONE_TOOL_TARGET_SIX_OK`
- new Phase2402 target seven emits `PHASE2402_TWENTY_ONE_TOOL_TARGET_SEVEN_OK`
- new Phase2403 target eight emits `PHASE2403_TWENTY_ONE_TOOL_TARGET_EIGHT_OK`
- new Phase2404 target nine emits `PHASE2404_TWENTY_ONE_TOOL_TARGET_NINE_OK`
- new Phase2405 target ten emits `PHASE2405_TWENTY_ONE_TOOL_TARGET_TEN_OK`
- new Phase2406 target eleven emits `PHASE2406_TWENTY_ONE_TOOL_TARGET_ELEVEN_OK`
- new Phase2407 target twelve emits `PHASE2407_TWENTY_ONE_TOOL_TARGET_TWELVE_OK`
- new Phase2408 target thirteen emits `PHASE2408_TWENTY_ONE_TOOL_TARGET_THIRTEEN_OK`
- new Phase2409 target fourteen emits `PHASE2409_TWENTY_ONE_TOOL_TARGET_FOURTEEN_OK`
- new Phase2410 target fifteen emits `PHASE2410_TWENTY_ONE_TOOL_TARGET_FIFTEEN_OK`
- new Phase2411 target sixteen emits `PHASE2411_TWENTY_ONE_TOOL_TARGET_SIXTEEN_OK`
- new Phase2412 target seventeen emits `PHASE2412_TWENTY_ONE_TOOL_TARGET_SEVENTEEN_OK`
- new Phase2413 target eighteen emits `PHASE2413_TWENTY_ONE_TOOL_TARGET_EIGHTEEN_OK`
- new Phase2414 target nineteen emits `PHASE2414_TWENTY_ONE_TOOL_TARGET_NINETEEN_OK`
- new Phase2415 target twenty emits `PHASE2415_TWENTY_ONE_TOOL_TARGET_TWENTY_OK`
- new Phase2416 target twenty-one emits `PHASE2416_TWENTY_ONE_TOOL_TARGET_TWENTY_ONE_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2391-2416-controlled-twenty-one-tool-mutation
cmd /c pnpm run apply:phase2391-2416-controlled-twenty-one-tool-mutation
cmd /c pnpm run smoke:phase2391-2416-controlled-twenty-one-tool-mutation
cmd /c pnpm run verify:phase2391-2416-controlled-twenty-one-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the twenty-one target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a twenty-two-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
