# Phase3965A Codex Next Phase Selection Policy

## Goal

Force future Codex next-phase selection through a value gate before Product Work Mode is allowed to continue.

## Rejection Rules

- Proposed phase names containing controlled 57-file mutation expansion are rejected.
- Missing `valueClass` is rejected.
- Empty `expectedUserValue` is rejected.
- Marker-only, managed-block-only, file-count-only, or summary-only work is rejected by default.
- Owner daily-use blockers push selection toward Product Work Mode.
- Provider stability blockers may only create authorization packets, not real calls.
- UI dead-button blockers push selection toward scan/fix proposals.
- Secret, deploy, or chat-route risk requires human approval.

## Evidence

The verifier checks the policy module and the generated result evidence. This phase calls no Provider, reads no secret, and does not change /chat or /chat-gateway/execute.

## Rollback

- Delete `apps/ai-gateway-service/src/self-evolution/nextPhaseSelectionPolicy.js` only if no later phase depends on it.
- Delete `tools/phase3965a/`.
- Delete `docs/phase3965a-codex-next-phase-selection-policy.md`.
- Delete `apps/ai-gateway-service/evidence/phase3965a-codex-next-phase-selection-policy/`.
- Restore package.json scripts and README/AGENTS managed block entries.
