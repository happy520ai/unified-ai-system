# Phase805 Model Role Assignment Taxonomy

## Goal

Assign routing roles such as default_chat, reasoning, god_reviewer, and tianshu_planner.

## Verified facts

- roleCount=14
- assignmentCount=17

## Boundaries

- role assignment does not imply runtime execution

## Outputs

- apps/ai-gateway-service/evidence/phase801_820/model-role-assignment-result.json

## Non-claims

- This phase is routing dry-run and recommendation only by default.
- This phase does not call providers or read secrets.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not add selectable models.
- Real route execution remains blocked until a future explicit approval gate.
