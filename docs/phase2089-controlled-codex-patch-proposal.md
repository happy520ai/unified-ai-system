# Phase2089A Controlled Codex Patch Proposal

## Goal

Phase2089A builds on Phase2088A by asking one real `codex exec` run to generate a reviewable unified diff proposal.

The phase proves that Codex can produce an engineering patch proposal as evidence without applying it to the repository.

## Scope

- Requires Phase632 preflight.
- Requires Phase2088A sealed evidence.
- Requires `approvalRecord.permissionMode=bounded-real-codex-patch-proposal`.
- Uses real `codex exec`.
- Uses an isolated temporary workspace outside the repository.
- Uses `--ephemeral`, `--sandbox read-only`, and approval policy `never`.
- Captures the final Codex message to an allowed evidence file.
- Allows credentialRef-style environment passthrough for `CRS_OAI_KEY` by variable name only when present; evidence records presence as a boolean and never records the value.
- Enforces maxExternalToolInvocations=1 and maxRequests=1.

## Boundaries

- patchProposalApplied=false.
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

Codex itself may use its configured external account/model for this one proposal. This phase does not route the AI Gateway project Provider runtime.

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run smoke:phase2089-controlled-codex-patch-proposal
cmd /c pnpm run verify:phase2089-controlled-codex-patch-proposal
```

## Next Gate

The next phase may classify the proposed patch and optionally prepare an apply gate, but applying it must remain behind explicit allowedFiles, rollback, no commit/push/deploy, and verifier gates.
