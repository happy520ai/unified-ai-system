# Phase2088A Controlled Codex Prompt Execution

## Goal

Phase2088A builds on Phase2087A by running one real `codex exec` prompt through a bounded local runner.

The phase proves that the project can hand a tiny, safe prompt to Codex, capture the final response, and preserve evidence without integrating Codex into the AI Gateway main chain.

## Scope

- Requires Phase632 preflight.
- Requires Phase2087A sealed evidence.
- Requires `approvalRecord.permissionMode=bounded-real-codex-prompt`.
- Uses `codex exec --ephemeral --sandbox read-only --ask-for-approval never`.
- Uses an isolated temporary workspace outside the repository.
- Captures the last Codex message to an allowed evidence file.
- Enforces maxExternalToolInvocations=1 and maxRequests=1.
- Allows credentialRef-style environment passthrough for `CRS_OAI_KEY` by variable name only when present; evidence records presence as a boolean and never records the value.

## Boundaries

- projectProviderCallsMade=false.
- paidProviderCallsMadeByProject=false.
- secretRead=false.
- envRead=false.
- credentialEnvAllowlist=["CRS_OAI_KEY"] by name only.
- authJsonReadByRunner=false.
- authJsonContentExposed=false.
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

Codex itself may use its configured external account/model to answer this one prompt. This phase does not read or expose Codex auth files and does not route the AI Gateway project Provider runtime.

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run smoke:phase2088-controlled-codex-prompt-once
cmd /c pnpm run verify:phase2088-controlled-codex-prompt-execution
```

## Next Gate

The next phase may allow Codex/OpenCode to produce a patch proposal, but applying that patch must stay behind explicit allowedFiles, rollback, no commit/push/deploy, and verifier gates.
