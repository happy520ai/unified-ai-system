# Phase913 Rerun Phase911 Real External Provider One-shot

## Goal

Rerun the Phase911 one-shot through the Phase912 credentialRef secure injection boundary.

## Facts

- externalProviderApiCallConfirmed=true
- networkAttemptRecorded=true
- providerResponseReceived=true
- responseClassification=pass

## Boundaries

- Exactly one Provider request maximum.
- No retries.
- No non-NVIDIA Provider.

## Outputs

- apps/ai-gateway-service/evidence/phase912_915/phase913-real-external-provider-one-shot-result.json
- apps/ai-gateway-service/evidence/phase912_915/phase913-authenticity-evidence.json

## Non-claims

- Phase913 is a later supplemental authenticity proof; it does not rewrite Phase821-900 as originally external.
- This phase does not expose API keys, auth.json, webhooks, or raw endpoint values.
- Default /chat and /chat-gateway/execute behavior is unchanged.
- Broader real route quality testing requires a new approval.
