# Phase3964A Self Evolution Governance Kernel

## Goal

Define a governed self-evolution kernel for observation, diagnosis, proposal generation, dry-run checks, and human approval gates.

## Kernel Policy

```json
{
  "evolutionMode": "governed",
  "autonomousCodeMutationAllowed": false,
  "autonomousProviderCallAllowed": false,
  "autonomousSecretReadAllowed": false,
  "autonomousDeployAllowed": false,
  "autonomousChatRouteChangeAllowed": false,
  "autonomousChatGatewayExecuteChangeAllowed": false,
  "humanApprovalRequiredForHighRisk": true,
  "lowValuePhaseExpansionBlocked": true
}
```

## Allowed

- Observe product evidence and blockers.
- Diagnose likely next Product Work Mode tasks.
- Propose low-risk dry-run repairs.
- Run verifiers and write evidence.

## Blocked

- Autonomous code mutation.
- Autonomous Provider calls.
- Autonomous secret reads.
- Autonomous deploy/release/tag/artifact actions.
- Autonomous /chat or /chat-gateway/execute changes.
- Low-value phase expansion.

## Rollback

- Delete `apps/ai-gateway-service/src/self-evolution/selfEvolutionPolicy.js` only if no later phase depends on it.
- Delete `apps/ai-gateway-service/src/self-evolution/selfEvolutionLedgerSchema.js` only if no later phase depends on it.
- Delete `apps/ai-gateway-service/src/self-evolution/selfEvolutionValueGate.js` only if no later phase depends on it.
- Delete `tools/phase3964a/`.
- Delete `docs/phase3964a-self-evolution-governance-kernel.md`.
- Delete `apps/ai-gateway-service/evidence/phase3964a-self-evolution-governance-kernel/`.
- Restore package.json scripts and README/AGENTS managed block entries.
