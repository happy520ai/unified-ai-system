# Phase3980A OpenCode Phase Candidate Bridge

## Goal

Upgrade the OpenCode autopilot from a static example queue to a real project-phase candidate bridge.

## What It Reads

- `docs/phase-orchestrator/current-phase-state.json`
- `docs/phase-orchestrator/safety-brake-decision.json`
- `docs/phase-orchestrator/phase-registry.json`
- `docs/phase-orchestrator/next-codex-prompt.meta.json`

## What It Produces

- `docs/project-brain/opencode-autopilot-phase-candidates.json`
- `apps/ai-gateway-service/evidence/phase3980a-opencode-phase-candidate-bridge/latest-summary.md`

## Rules

- Low-risk phase candidates may be marked `pending`.
- High-risk or approval-required phase candidates must stay `blocked`.
- This phase does not run a provider, does not read secrets, and does not change `/chat`.
- This phase only builds the bridge between phase-orchestrator outputs and autopilot-readable candidate tasks.

## Verification

```powershell
node --check tools/phase3980a/build-opencode-phase-candidates.mjs
node --check tools/phase3980a/verify-opencode-phase-candidates.mjs
node tools/phase3980a/verify-opencode-phase-candidates.mjs
cmd /c pnpm run verify:phase3980a-opencode-phase-candidate-bridge
```
