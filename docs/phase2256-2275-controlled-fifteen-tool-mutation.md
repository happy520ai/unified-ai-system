# Phase2256A-2275A Controlled Fifteen Tool Mutation

## Goal

Phase2256A-2275A extends the controlled local mutation line from fourteen files to fifteen files while continuing to reuse the existing **JSON smoke helper** in the controlled mutation substrate.

This phase is the current **controlled fifteen tool mutation** batch.

## Scope

- Requires Phase632 preflight.
- Requires Phase2237A-2255A sealed evidence.
- Reuses `tools/phase2101_2110/controlled-mutation-substrate.mjs`.
- Applies exactly fifteen existing source-file mutations.
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

The controlled mutation substrate keeps the reusable **JSON smoke helper** and this phase must prove it can support fifteen bounded local smoke commands without duplicating smoke boilerplate.

## Verification

The fifteen mutation batch must prove:
- new Phase2261 target one emits `PHASE2261_FIFTEEN_TOOL_TARGET_ONE_OK`
- new Phase2262 target two emits `PHASE2262_FIFTEEN_TOOL_TARGET_TWO_OK`
- new Phase2263 target three emits `PHASE2263_FIFTEEN_TOOL_TARGET_THREE_OK`
- new Phase2264 target four emits `PHASE2264_FIFTEEN_TOOL_TARGET_FOUR_OK`
- new Phase2265 target five emits `PHASE2265_FIFTEEN_TOOL_TARGET_FIVE_OK`
- new Phase2266 target six emits `PHASE2266_FIFTEEN_TOOL_TARGET_SIX_OK`
- new Phase2267 target seven emits `PHASE2267_FIFTEEN_TOOL_TARGET_SEVEN_OK`
- new Phase2268 target eight emits `PHASE2268_FIFTEEN_TOOL_TARGET_EIGHT_OK`
- new Phase2269 target nine emits `PHASE2269_FIFTEEN_TOOL_TARGET_NINE_OK`
- new Phase2270 target ten emits `PHASE2270_FIFTEEN_TOOL_TARGET_TEN_OK`
- new Phase2271 target eleven emits `PHASE2271_FIFTEEN_TOOL_TARGET_ELEVEN_OK`
- new Phase2272 target twelve emits `PHASE2272_FIFTEEN_TOOL_TARGET_TWELVE_OK`
- new Phase2273 target thirteen emits `PHASE2273_FIFTEEN_TOOL_TARGET_THIRTEEN_OK`
- new Phase2274 target fourteen emits `PHASE2274_FIFTEEN_TOOL_TARGET_FOURTEEN_OK`
- new Phase2275 target fifteen emits `PHASE2275_FIFTEEN_TOOL_TARGET_FIFTEEN_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2256-2275-controlled-fifteen-tool-mutation
cmd /c pnpm run apply:phase2256-2275-controlled-fifteen-tool-mutation
cmd /c pnpm run smoke:phase2256-2275-controlled-fifteen-tool-mutation
cmd /c pnpm run verify:phase2256-2275-controlled-fifteen-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet and the fifteen target markers are not present. That red state is intentional.

## Next Gate

The next round may lift this into a rollback replay audit batch or a sixteen-file bounded batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
