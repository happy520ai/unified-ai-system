# Phase2237A-2255A Controlled Fourteen Tool Mutation

## Goal

Phase2237A-2255A extends the controlled local mutation line from thirteen files to fourteen files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled fourteen tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2202A-2218A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly fourteen existing source-file mutations.
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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support fourteen bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The fourteen mutation batch must prove:
- new Phase2242 target one emits `PHASE2242_FOURTEEN_TOOL_TARGET_ONE_OK`
- new Phase2243 target two emits `PHASE2243_FOURTEEN_TOOL_TARGET_TWO_OK`
- new Phase2244 target three emits `PHASE2244_FOURTEEN_TOOL_TARGET_THREE_OK`
- new Phase2245 target four emits `PHASE2245_FOURTEEN_TOOL_TARGET_FOUR_OK`
- new Phase2246 target five emits `PHASE2246_FOURTEEN_TOOL_TARGET_FIVE_OK`
- new Phase2247 target six emits `PHASE2247_FOURTEEN_TOOL_TARGET_SIX_OK`
- new Phase2248 target seven emits `PHASE2248_FOURTEEN_TOOL_TARGET_SEVEN_OK`
- new Phase2249 target eight emits `PHASE2249_FOURTEEN_TOOL_TARGET_EIGHT_OK`
- new Phase2250 target nine emits `PHASE2250_FOURTEEN_TOOL_TARGET_NINE_OK`
- new Phase2251 target ten emits `PHASE2251_FOURTEEN_TOOL_TARGET_TEN_OK`
- new Phase2252 target eleven emits `PHASE2252_FOURTEEN_TOOL_TARGET_ELEVEN_OK`
- new Phase2253 target twelve emits `PHASE2253_FOURTEEN_TOOL_TARGET_TWELVE_OK`
- new Phase2254 target thirteen emits `PHASE2254_FOURTEEN_TOOL_TARGET_THIRTEEN_OK`
- new Phase2255 target fourteen emits `PHASE2255_FOURTEEN_TOOL_TARGET_FOURTEEN_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2237-2255-controlled-fourteen-tool-mutation
cmd /c pnpm run apply:phase2237-2255-controlled-fourteen-tool-mutation
cmd /c pnpm run smoke:phase2237-2255-controlled-fourteen-tool-mutation
cmd /c pnpm run verify:phase2237-2255-controlled-fourteen-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the fourteen target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a fifteen-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
