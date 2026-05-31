# Phase814 Candidate Scoring Engine

## Goal

Score candidates by capability match, mode fit, pressure fit, reliability, latency, cost, context, and risk.

## Verified facts

- scoredCandidateCount=17
- score range is 0-100

## Boundaries

- score is advisory and not a provider call

## Outputs

- apps/ai-gateway-service/evidence/phase801_820/candidate-scoring-engine-result.json

## Non-claims

- This phase is routing dry-run and recommendation only by default.
- This phase does not call providers or read secrets.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not add selectable models.
- Real route execution remains blocked until a future explicit approval gate.
