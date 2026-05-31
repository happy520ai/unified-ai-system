# Phase818 Mission Control Model Routing Panel

## Goal

Expose a read-only model routing panel in Mission Control.

## Verified facts

- missionControlModelRoutingPanelReady=true
- providerCallsMade=false
- default behavior unchanged

## Boundaries

- read-only UI
- no execution controls

## Outputs

- apps/ai-gateway-service/src/ui/components/ModelRoutingPanel.js

## Non-claims

- This phase is routing dry-run and recommendation only by default.
- This phase does not call providers or read secrets.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not add selectable models.
- Real route execution remains blocked until a future explicit approval gate.
