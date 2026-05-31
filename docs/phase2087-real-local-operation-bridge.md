# Phase2087A Real Local Operation Bridge

## Goal

Phase2087A turns the next execution step from preview-only into a bounded real local operation bridge.

The first sealed capability is intentionally narrow: it invokes a real child process through the local machine, writes an allowed evidence file, and records execution evidence. This proves the execution bridge, approval record, allowed file gate, forbidden path gate, and evidence ledger without calling Providers or changing the main chat runtime.

## Current Capability

- OpenCode detection is recorded as `opencodeDetected`.
- Codex detection is recorded as `codexDetected`.
- The sealed smoke uses `externalToolKind=local-node`.
- The smoke writes only `apps/ai-gateway-service/evidence/phase2087-real-local-operation-bridge/real-local-smoke-output.json`.
- The bridge result is written to `apps/ai-gateway-service/evidence/phase2087-real-local-operation-bridge/real-local-smoke-result.json`.

## Execution Boundary

- approvalRecordRequired=true.
- allowedFilesRequired=true.
- forbiddenPathsEnforced=true.
- maxExternalToolInvocations=1.
- maxRequests=0.
- maxCostUsd=0.
- providerCallsMade=false.
- paidProviderCallsMade=false.
- secretRead=false.
- authJsonRead=false.
- envRead=false.
- codexConfigModified=false.
- codexBaseUrlModified=false.
- default `/chat` unchanged.
- `/chat-gateway/execute` unchanged.
- deployExecuted=false.
- releaseExecuted=false.
- tagCreated=false.
- artifactUploaded=false.
- pushExecuted=false.
- commitCreated=false.
- legacyModified=false.
- projectContextCreated=false.
- workspaceCleanClaimed=false.

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run smoke:phase2087-real-local-operation-bridge-real-local
cmd /c pnpm run verify:phase2087-real-local-operation-bridge
```

## Next Gate

Future phases may route OpenCode or Codex prompt execution through this bridge, but only after they add their own approval packet, budget, output capture, timeout, rollback/evidence, and verifier coverage. Phase2087A itself does not execute an OpenCode/Codex model prompt.
