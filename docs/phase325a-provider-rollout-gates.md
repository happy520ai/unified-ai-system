# Phase325A Provider Rollout Gates

## Gate 0: Current State

- NVIDIA: active real provider.
- OpenAI: future-provider-slot.
- Claude: future-provider-slot.
- OpenRouter: future-provider-slot.
- MiMo: future-provider-slot.
- local: future-provider-slot.

No non-NVIDIA provider is open in the current product.

## Gate 1: Phase325B Config Schema Design

Allowed:

- Provider config schema design.
- Credential presence field design.
- Enable flag design.
- Kill switch design.
- Budget field design.

Blocked:

- Real provider calls.
- Provider client edits.
- UI enable buttons.

Exit criteria:

- Design docs written.
- No API calls performed.
- No secrets read or exposed.

## Gate 2: Phase325C Adapter Contract Tests

Allowed:

- Contract-test fixtures.
- Mocked adapter behavior.
- Redaction behavior tests.
- Routing safety tests.

Blocked:

- Real provider calls.
- Paid provider retries.
- Provider key setup.

Exit criteria:

- Contract tests pass.
- Real-call path remains disabled.
- Evidence confirms mocked-only coverage.

## Gate 3: Phase325D Dry-Run Routing Simulation

Allowed:

- Simulated route selection.
- Provider allowlist tests.
- Kill switch tests.
- User-visible dry-run explanations.

Blocked:

- Real OpenAI, Claude, OpenRouter, MiMo, or local execution.
- Production provider fallback.

Exit criteria:

- Dry-run and real-run paths are clearly separated.
- Dry-run never triggers providerCalled=true.
- UI states remain honest.

## Gate 4: Phase325E One-Provider Real Smoke

Allowed only after explicit user authorization:

- One provider at a time.
- One small smoke batch.
- Evidence generation.
- Secret-safe audit logs.

Blocked:

- Multi-provider real rollout in one phase.
- Automatic fallback to another paid provider.
- Batch quota burn.

Exit criteria:

- User gave explicit authorization.
- Request limits are enforced.
- Evidence is complete.
- Backout path is documented.

## Gate 5: Limited Rollout

Allowed:

- Provider enabled for a narrow route or approved operator path.
- Provider-specific budget, timeout, and retry policy.
- Provider kill switch.

Blocked:

- Broad default `/chat` fallback.
- Silent provider swaps.
- Unbounded retries.

Exit criteria:

- Evidence-backed route behavior.
- Operator-visible provider status.
- Rollback tested.

## Gate 6: Broader Availability

Allowed only after earlier gates prove stable:

- Additional model onboarding for the same provider.
- UI exposure for approved provider surfaces.
- More complete route policies.

Blocked:

- Claiming all-provider production readiness without evidence.
- Hiding provider cost/risk boundaries from the user.

Exit criteria:

- Repeated verified smokes.
- Stable verifier chain.
- No secret leaks.
- Cost controls validated.

## Mandatory Real-Call Gate

A real non-NVIDIA provider call requires all of these:

- Explicit user authorization in that phase.
- Provider status not equal to `future-provider-slot`.
- Provider enable flag on.
- Real-run flag on.
- Credential presence validated without exposing the secret.
- Budget not hard-stopped.
- Audit sink enabled.
- Verifier plan defined for that provider.

If any item fails, the system must reject the real call and return a clear reason.

