# Phase841-860 Real Routing Local Self-use Surrogate Soak

## Goal

Run accelerated Codex surrogate routing checks without claiming human or long-duration soak.

## Verified facts

- scenarioCount=30
- codexSurrogateReviewed=true
- humanReviewed=false
- realSevenDaySoakCompleted=false

## Boundaries

- surrogate soak is accelerated local automation
- no Provider calls are made by surrogate dry-run scenarios
- blocked and credential-missing red-team cases remain blocked

## Outputs

- apps/ai-gateway-service/evidence/phase841_860/real-routing-surrogate-soak-final-result.json

## Non-claims

- Codex surrogate testing is not human testing.
- Accelerated surrogate soak is not seven-day or thirty-day production soak.
- Route dry-run is not a Provider call.
- Real Provider route execution is blocked unless CredentialRef-only and budget gates pass.
- This phase does not change default /chat or /chat-gateway/execute behavior.
