# Phase2366A-2390A Controlled Twenty Tool Mutation

## Goal

Phase2342A-2365A extends the controlled local mutation line from nineteen files to twenty files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled twenty tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2342A-2365A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly twenty existing source-file mutations.
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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support twenty bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The twenty mutation batch must prove:
- new Phase2371 target one emits `PHASE2371_TWENTY_TOOL_TARGET_ONE_OK`
- new Phase2372 target two emits `PHASE2372_TWENTY_TOOL_TARGET_TWO_OK`
- new Phase2373 target three emits `PHASE2373_TWENTY_TOOL_TARGET_THREE_OK`
- new Phase2374 target four emits `PHASE2374_TWENTY_TOOL_TARGET_FOUR_OK`
- new Phase2375 target five emits `PHASE2375_TWENTY_TOOL_TARGET_FIVE_OK`
- new Phase2376 target six emits `PHASE2376_TWENTY_TOOL_TARGET_SIX_OK`
- new Phase2377 target seven emits `PHASE2377_TWENTY_TOOL_TARGET_SEVEN_OK`
- new Phase2378 target eight emits `PHASE2378_TWENTY_TOOL_TARGET_EIGHT_OK`
- new Phase2379 target nine emits `PHASE2379_TWENTY_TOOL_TARGET_NINE_OK`
- new Phase2380 target ten emits `PHASE2380_TWENTY_TOOL_TARGET_TEN_OK`
- new Phase2381 target eleven emits `PHASE2381_TWENTY_TOOL_TARGET_ELEVEN_OK`
- new Phase2382 target twelve emits `PHASE2382_TWENTY_TOOL_TARGET_TWELVE_OK`
- new Phase2383 target thirteen emits `PHASE2383_TWENTY_TOOL_TARGET_THIRTEEN_OK`
- new Phase2384 target fourteen emits `PHASE2384_TWENTY_TOOL_TARGET_FOURTEEN_OK`
- new Phase2385 target fifteen emits `PHASE2385_TWENTY_TOOL_TARGET_FIFTEEN_OK`
- new Phase2386 target sixteen emits `PHASE2386_TWENTY_TOOL_TARGET_SIXTEEN_OK`
- new Phase2387 target seventeen emits `PHASE2387_TWENTY_TOOL_TARGET_SEVENTEEN_OK`
- new Phase2388 target eighteen emits `PHASE2388_TWENTY_TOOL_TARGET_EIGHTEEN_OK`
- new Phase2389 target nineteen emits `PHASE2389_TWENTY_TOOL_TARGET_NINETEEN_OK`
- new Phase2390 target twenty emits `PHASE2390_TWENTY_TOOL_TARGET_TWENTY_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2366-2390-controlled-twenty-tool-mutation
cmd /c pnpm run apply:phase2366-2390-controlled-twenty-tool-mutation
cmd /c pnpm run smoke:phase2366-2390-controlled-twenty-tool-mutation
cmd /c pnpm run verify:phase2366-2390-controlled-twenty-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the twenty target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a twenty-one-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
