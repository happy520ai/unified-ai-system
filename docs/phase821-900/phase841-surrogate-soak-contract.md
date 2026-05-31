# Phase841 Surrogate Soak Contract

## Goal

Surrogate Soak Contract for Phase821-900 guarded routing, surrogate soak, ensemble optimization, or continuous learning.

## Verified facts

- completed=true
- recommended_sealed=true
- blocker=null
- providerCallsMade=true

## Boundaries

- CredentialRef-only; raw secret/auth.json read is forbidden.
- Default /chat and /chat-gateway/execute behavior stays unchanged.
- Codex surrogate output is not human review.
- Selectable state is unchanged without explicit admission.

## Outputs

- apps/ai-gateway-service/evidence/phase821_900/global-model-routing-system-final-result.json

## Non-claims

- Codex surrogate testing is not human testing.
- Accelerated surrogate soak is not seven-day or thirty-day production soak.
- Route dry-run is not a Provider call.
- Real Provider route execution is blocked unless CredentialRef-only and budget gates pass.
- This phase does not change default /chat or /chat-gateway/execute behavior.
