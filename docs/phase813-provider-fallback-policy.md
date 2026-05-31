# Phase813 Provider Fallback Policy

## Goal

Build a fallback chain from selectable smoke-passed runtime candidates.

## Verified facts

- fallbackCount=5
- selectedModelId=deepseek-ai/deepseek-v4-pro

## Boundaries

- fallback chain is recommendation only

## Outputs

- apps/ai-gateway-service/evidence/phase801_820/provider-fallback-policy-result.json

## Non-claims

- This phase is routing dry-run and recommendation only by default.
- This phase does not call providers or read secrets.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not add selectable models.
- Real route execution remains blocked until a future explicit approval gate.
