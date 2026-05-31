# Phase3966A Low Risk Self Patch Dry-Run Loop

## Goal

Prepare a low-risk self-patch dry-run loop. This phase generates patch proposals only and applies no business repair.

## Allowed Proposal Types

- README/AGENTS managed block drift.
- Evidence schema missing field.
- Verifier output missing field.
- Package script name drift.
- Small node --check syntax error.
- Docs/report internal reference error.

## Blocked Proposal Types

- Provider adapter.
- Credential secret logic.
- /chat.
- /chat-gateway/execute.
- deploy/release.
- real Provider call.
- UI real button behavior.

## Result

- lowRiskSelfPatchDryRunReady=true
- patchesApplied=false
- proposalOnly=true
- highRiskPatchBlocked=true

## Rollback

- Delete `apps/ai-gateway-service/src/self-evolution/lowRiskSelfPatchPolicy.js` only if no later phase depends on it.
- Delete `tools/phase3966a/`.
- Delete `docs/phase3966a-low-risk-self-patch-dry-run-loop.md`.
- Delete `apps/ai-gateway-service/evidence/phase3966a-low-risk-self-patch-dry-run-loop/`.
- Restore package.json scripts and README/AGENTS managed block entries.
