# Phase803 Mode-based Routing Policy

## Goal

Resolve normal, god, and tianshu mode routing policy from requested mode and task pressure.

## Verified facts

- policyCount=10
- auto mode resolves to normal/god/tianshu

## Boundaries

- runtimeEnabled=false
- dry-run only

## Outputs

- apps/ai-gateway-service/evidence/phase801_820/mode-routing-policy-result.json

## Non-claims

- This phase is routing dry-run and recommendation only by default.
- This phase does not call providers or read secrets.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not add selectable models.
- Real route execution remains blocked until a future explicit approval gate.
