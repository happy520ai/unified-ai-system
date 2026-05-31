# Phase815 Route Explanation Builder

## Goal

Build user-visible route explanations with pressure, mode, selected model, and dry-run boundary.

## Verified facts

- mode=normal; selected=nvidia/llama-3.1-nemotron-nano-8b-v1; tokenPressure=low; costPressure=medium; latencyPressure=high; reasoningPressure=low; dryRunOnly=true; providerCallsMade=false

## Boundaries

- route explanation is not execution evidence

## Outputs

- apps/ai-gateway-service/evidence/phase801_820/route-explanation-builder-result.json

## Non-claims

- This phase is routing dry-run and recommendation only by default.
- This phase does not call providers or read secrets.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not add selectable models.
- Real route execution remains blocked until a future explicit approval gate.
