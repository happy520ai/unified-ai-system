# Phase2000-GVC-OS: Governed Vibe Coding OS

## Goal

Phase2000 creates a local, risk-gated autonomous execution loop for unified-ai-system / PME AI Gateway. It lets Codex pick bounded L0/L1/L2 work from project-brain state, write sanitized evidence, and block L3 work behind approval packets.

## Scope

This phase is docs, local tools, evidence, and verifier only.

Allowed:

- Maintain `docs/project-brain/*.json`.
- Read project-brain JSON and select low/medium-risk local next actions.
- Validate task risk using declared paths and operations.
- Write sanitized local evidence.
- Generate approval-required packets for L3 work.

Forbidden:

- Provider calls.
- Secret, raw API key, Authorization header, `.env`, or `auth.json` reads.
- Deploy, release, tag, push, commit, or artifact upload.
- `legacy/` modification.
- `PROJECT_CONTEXT.md` creation or modification.
- Default `/chat` or `/chat-gateway/execute` modification.
- Production-ready, commercial-ready, owner-feedback, or workspace-clean claims.

## Project Brain Files

- `docs/project-brain/current-state.json` records the current local autonomous mode, blockers, and hard boundaries.
- `docs/project-brain/goals.json` records local self-use goals and not-goals.
- `docs/project-brain/risk-policy.json` defines `allowed`, `approval_required`, and `forbidden` decisions.
- `docs/project-brain/next-actions.json` lists candidate L0/L1/L2/L3 actions.
- `docs/project-brain/completion-definition.json` defines the Phase2000 seal criteria.

## Local Tools

- `tools/gvc/read-project-brain.mjs` parses project-brain JSON files.
- `tools/gvc/select-next-action.mjs` selects the next allowed L0/L1/L2 action.
- `tools/gvc/validate-risk-gate.mjs` classifies tasks as `allowed`, `approval_required`, or `forbidden`.
- `tools/gvc/write-execution-result.mjs` writes sanitized execution evidence.
- `tools/gvc/verify-gvc-os.mjs` verifies Phase2000 behavior and writes final evidence.

## Risk Gate Behavior

L0, L1, and L2 tasks can be allowed when they avoid forbidden paths and forbidden operations.

L3 tasks require owner approval and generate `docs/approvals/<task-id>-approval-required.json`. The generated packet contains required fields such as `provider`, `model`, `credentialRef`, `maxRequests`, `maxCostUsd`, `timeoutMs`, `retryPolicy`, `prompt`, `expectedResult`, and `rollbackPlan`.

L4 or forbidden operations are blocked. Forbidden operations include raw secret reads, deploy/release, push/commit, destructive git operations, legacy modification, `PROJECT_CONTEXT.md` modification, and workspace-clean claims.

## Evidence

Phase2000 writes:

- `apps/ai-gateway-service/evidence/phase2000-gvc-os/gvc-os-result.json`

The evidence must show:

- `providerCallsMade=false`
- `secretRead=false`
- `deployReleasePerformed=false`
- `chatModified=false`
- `chatGatewayExecuteModified=false`
- `legacyModified=false`
- `projectContextModified=false`
- `workspaceCleanClaimed=false`

## Verification

Required commands:

```powershell
node --check tools/gvc/read-project-brain.mjs
node --check tools/gvc/select-next-action.mjs
node --check tools/gvc/validate-risk-gate.mjs
node --check tools/gvc/write-execution-result.mjs
node --check tools/gvc/verify-gvc-os.mjs
pnpm run verify:phase2000-gvc-os
pnpm run verify:phase107a-secret-safety
pnpm run verify:phase321a-workbench-product-recovery
pnpm -r --if-present check
```

UI smoke is not required for Phase2000 because this phase does not modify UI.

## Seal Decision

Phase2000 is recommended sealed only when the verifier and required base validations pass. It does not make the product production-ready or commercial-ready.
