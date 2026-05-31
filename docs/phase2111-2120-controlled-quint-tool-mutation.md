# Phase2111A-2120A Controlled Quint Tool Mutation

## Goal

Phase2111A-2120A extends the controlled local mutation line from four files to five files, while also adding a reusable **JSON smoke helper** into the existing controlled mutation substrate.

This phase is the current **controlled quint tool mutation** batch.

This is still a real local-write phase. It is not a dry-run design pack, and it still stays outside default `/chat`, outside `/chat-gateway/execute`, outside provider runtime, and outside any paid provider lane.

## Scope

- Requires Phase632 preflight.
- Requires Phase2101A-2110A sealed evidence.
- Extends `tools/phase2101_2110/controlled-mutation-substrate.mjs` with reusable JSON smoke execution support.
- Applies exactly five existing source-file mutations.
- Targets only:
  - `tools/phase2091/generated-source-patch-target.mjs`
  - `tools/phase2092/apply-controlled-existing-tool-mutation.mjs`
  - `tools/phase2093_2095/apply-controlled-batch-tool-mutation.mjs`
  - `tools/phase2096_2100/apply-controlled-triple-tool-mutation.mjs`
  - `tools/phase2101_2110/apply-controlled-quad-tool-mutation.mjs`

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

The existing controlled mutation substrate must now also provide a reusable **JSON smoke helper** that:

- runs bounded local commands
- captures JSON stdout safely
- preserves providerCallsMade=false expectations
- supports the next mutation batch without duplicating smoke boilerplate

## Verification

The quint mutation batch must prove:

- new Phase2116 target one emits `PHASE2116_QUINT_TOOL_TARGET_ONE_OK`
- new Phase2117 target two emits `PHASE2117_QUINT_TOOL_TARGET_TWO_OK`
- new Phase2118 target three emits `PHASE2118_QUINT_TOOL_TARGET_THREE_OK`
- new Phase2119 target four emits `PHASE2119_QUINT_TOOL_TARGET_FOUR_OK`
- new Phase2120 target five emits `PHASE2120_QUINT_TOOL_TARGET_FIVE_OK`

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run verify:phase2111-2120-controlled-quint-tool-mutation
cmd /c pnpm run apply:phase2111-2120-controlled-quint-tool-mutation
cmd /c pnpm run smoke:phase2111-2120-controlled-quint-tool-mutation
cmd /c pnpm run verify:phase2111-2120-controlled-quint-tool-mutation
```

The first verifier run is expected to fail before apply because result evidence does not exist yet. That red state is intentional.

## Next Gate

The next round may lift this into a six-file bounded batch or a rollback replay audit batch, but it must remain approval-bound, SHA-bound, rollback-bound, verifier-bound, provider-free, and outside default `/chat`.
