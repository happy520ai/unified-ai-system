# Phase942 Round 2 Scenario Matrix

## Goal

Prepare at least 12 Round 2 scenarios with mixed real and dry-run coverage under the 20-request cap.

## Facts

- scenarioCount=15
- plannedRealProviderRequestCount=8
- plannedDryRunScenarioCount=7

## Boundaries

- Scenario build does not call Provider.
- Dry-run scenarios are marked dryRunOnly.

## Outputs

- apps/ai-gateway-service/evidence/phase941_960/round2-scenario-matrix-result.json

## Non-claims

- This phase is not production traffic, not human review, and not a seven-day soak.
- This phase does not modify selectable model state.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
- When approval is missing, no Provider request is executed.
