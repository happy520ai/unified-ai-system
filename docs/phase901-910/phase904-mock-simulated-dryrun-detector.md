# Phase904 Mock / Simulated / Dry-run Detector

## Goal

Detect mock, simulated, dry-run, local executor, fixture, static, and synthetic response markers.

## Verified facts

- externalProviderConfirmationBlocked=true

## Boundaries

- detector only
- does not mutate Phase821-900 evidence

## Outputs

- apps/ai-gateway-service/evidence/phase901_910/mock-simulated-dryrun-detector-result.json

## Non-claims

- Local guarded executor attempts are not external Provider API proof.
- Mock, simulated, dry-run, or unknown evidence is never promoted to confirmed Provider response.
- This phase does not read raw secret values or auth.json.
- This phase does not modify default /chat or /chat-gateway/execute behavior.
