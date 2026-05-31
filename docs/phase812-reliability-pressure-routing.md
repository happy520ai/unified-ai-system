# Phase812 Reliability Pressure Routing

## Goal

Apply reliability pressure routing adjustments to dry-run routing candidates.

## Verified facts

- reliabilityPressureRoutingReady=true
- adjustedCandidateCount=17

## Boundaries

- pressure adjustment does not execute a route

## Outputs

- apps/ai-gateway-service/evidence/phase801_820/pressure-routing-pack-result.json

## Non-claims

- This phase is routing dry-run and recommendation only by default.
- This phase does not call providers or read secrets.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not add selectable models.
- Real route execution remains blocked until a future explicit approval gate.
