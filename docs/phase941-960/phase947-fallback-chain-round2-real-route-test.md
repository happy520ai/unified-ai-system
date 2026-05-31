# Phase947 Fallback Chain Round 2 Real Route Test

## Goal

Run or block fallback Round 2 routes while keeping failed primary models excluded.

## Facts

- providerCallsMade=true
- realProviderRequestCount=2
- blocker=null

## Boundaries

- Failed primary is simulated/excluded before runtime.
- Fallback uses eligible NVIDIA models only.

## Outputs

- apps/ai-gateway-service/evidence/phase941_960/fallback-chain-round2-real-route-result.json

## Non-claims

- This phase is not production traffic, not human review, and not a seven-day soak.
- This phase does not modify selectable model state.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
- When approval is missing, no Provider request is executed.
