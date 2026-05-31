# Phase2219A-2236A Controlled Thirteen Tool Mutation

## Goal

Phase2219A-2236A extends the controlled local mutation line from twelve files to thirteen files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled thirteen tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2202A-2218A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly thirteen existing source-file mutations.
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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support thirteen bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The thirteen mutation batch must prove:
- new Phase2224 target one emits `PHASE2224_THIRTEEN_TOOL_TARGET_ONE_OK`
- new Phase2225 target two emits `PHASE2225_THIRTEEN_TOOL_TARGET_TWO_OK`
- new Phase2226 target three emits `PHASE2226_THIRTEEN_TOOL_TARGET_THREE_OK`
- new Phase2227 target four emits `PHASE2227_THIRTEEN_TOOL_TARGET_FOUR_OK`
- new Phase2228 target five emits `PHASE2228_THIRTEEN_TOOL_TARGET_FIVE_OK`
- new Phase2229 target six emits `PHASE2229_THIRTEEN_TOOL_TARGET_SIX_OK`
- new Phase2230 target seven emits `PHASE2230_THIRTEEN_TOOL_TARGET_SEVEN_OK`
- new Phase2231 target eight emits `PHASE2231_THIRTEEN_TOOL_TARGET_EIGHT_OK`
- new Phase2232 target nine emits `PHASE2232_THIRTEEN_TOOL_TARGET_NINE_OK`
- new Phase2233 target ten emits `PHASE2233_THIRTEEN_TOOL_TARGET_TEN_OK`
- new Phase2234 target eleven emits `PHASE2234_THIRTEEN_TOOL_TARGET_ELEVEN_OK`
- new Phase2235 target twelve emits `PHASE2235_THIRTEEN_TOOL_TARGET_TWELVE_OK`
- new Phase2236 target thirteen emits `PHASE2236_THIRTEEN_TOOL_TARGET_THIRTEEN_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2219-2236-controlled-thirteen-tool-mutation
cmd /c pnpm run apply:phase2219-2236-controlled-thirteen-tool-mutation
cmd /c pnpm run smoke:phase2219-2236-controlled-thirteen-tool-mutation
cmd /c pnpm run verify:phase2219-2236-controlled-thirteen-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the thirteen target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a fourteen-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
