# Phase902 Provider Evidence Source Classifier

## Goal

Classify Phase821-900 route evidence sources without reading secrets.

## Verified facts

- routeExecutionEvidenceCount=5
- providerCallClaimCount=5

## Boundaries

- allowed evidence files only
- no auth.json read

## Outputs

- apps/ai-gateway-service/evidence/phase901_910/provider-evidence-source-classifier-result.json

## Non-claims

- Local guarded executor attempts are not external Provider API proof.
- Mock, simulated, dry-run, or unknown evidence is never promoted to confirmed Provider response.
- This phase does not read raw secret values or auth.json.
- This phase does not modify default /chat or /chat-gateway/execute behavior.
