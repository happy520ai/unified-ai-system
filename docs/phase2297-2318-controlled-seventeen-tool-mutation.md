# Phase2297A-2318A Controlled Seventeen Tool Mutation

## Goal

Phase2297A-2318A extends the controlled local mutation line from sixteen files to seventeen files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled seventeen tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2276A-2296A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly seventeen existing source-file mutations.
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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support seventeen bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The seventeen mutation batch must prove:
- new Phase2302 target one emits `PHASE2302_SEVENTEEN_TOOL_TARGET_ONE_OK`
- new Phase2303 target two emits `PHASE2303_SEVENTEEN_TOOL_TARGET_TWO_OK`
- new Phase2304 target three emits `PHASE2304_SEVENTEEN_TOOL_TARGET_THREE_OK`
- new Phase2305 target four emits `PHASE2305_SEVENTEEN_TOOL_TARGET_FOUR_OK`
- new Phase2306 target five emits `PHASE2306_SEVENTEEN_TOOL_TARGET_FIVE_OK`
- new Phase2307 target six emits `PHASE2307_SEVENTEEN_TOOL_TARGET_SIX_OK`
- new Phase2308 target seven emits `PHASE2308_SEVENTEEN_TOOL_TARGET_SEVEN_OK`
- new Phase2309 target eight emits `PHASE2309_SEVENTEEN_TOOL_TARGET_EIGHT_OK`
- new Phase2310 target nine emits `PHASE2310_SEVENTEEN_TOOL_TARGET_NINE_OK`
- new Phase2311 target ten emits `PHASE2311_SEVENTEEN_TOOL_TARGET_TEN_OK`
- new Phase2312 target eleven emits `PHASE2312_SEVENTEEN_TOOL_TARGET_ELEVEN_OK`
- new Phase2313 target twelve emits `PHASE2313_SEVENTEEN_TOOL_TARGET_TWELVE_OK`
- new Phase2314 target thirteen emits `PHASE2314_SEVENTEEN_TOOL_TARGET_THIRTEEN_OK`
- new Phase2315 target fourteen emits `PHASE2315_SEVENTEEN_TOOL_TARGET_FOURTEEN_OK`
- new Phase2316 target fifteen emits `PHASE2316_SEVENTEEN_TOOL_TARGET_FIFTEEN_OK`
- new Phase2317 target sixteen emits `PHASE2317_SEVENTEEN_TOOL_TARGET_SIXTEEN_OK`
- new Phase2318 target seventeen emits `PHASE2318_SEVENTEEN_TOOL_TARGET_SEVENTEEN_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2297-2318-controlled-seventeen-tool-mutation
cmd /c pnpm run apply:phase2297-2318-controlled-seventeen-tool-mutation
cmd /c pnpm run smoke:phase2297-2318-controlled-seventeen-tool-mutation
cmd /c pnpm run verify:phase2297-2318-controlled-seventeen-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the seventeen target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or an eighteen-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
