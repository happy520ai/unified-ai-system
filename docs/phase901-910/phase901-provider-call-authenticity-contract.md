# Phase901 Provider Call Authenticity Contract

## Goal

Define the evidence fields required to distinguish local executor attempts from external Provider API calls.

## Verified facts

- providerCallClaimed=true
- authenticityClassification=authenticity_unknown

## Boundaries

- no Provider call
- no secret/auth.json read

## Outputs

- apps/ai-gateway-service/evidence/phase901_910/provider-call-authenticity-contract-result.json

## Non-claims

- Local guarded executor attempts are not external Provider API proof.
- Mock, simulated, dry-run, or unknown evidence is never promoted to confirmed Provider response.
- This phase does not read raw secret values or auth.json.
- This phase does not modify default /chat or /chat-gateway/execute behavior.
