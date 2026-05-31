# Phase808 Tianshu Planner / Executor Selector

## Goal

Select dry-run planner and executor recommendations for complex tasks.

## Verified facts

- plannerModelId=deepseek-ai/deepseek-v4-pro
- executorCount=3

## Boundaries

- planner/executor recommendations are not runtime calls

## Outputs

- apps/ai-gateway-service/evidence/phase801_820/tianshu-planner-executor-selector-result.json

## Non-claims

- This phase is routing dry-run and recommendation only by default.
- This phase does not call providers or read secrets.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not add selectable models.
- Real route execution remains blocked until a future explicit approval gate.
