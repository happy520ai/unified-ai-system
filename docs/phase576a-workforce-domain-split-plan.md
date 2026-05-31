# Phase576A Workforce Domain Split Plan

## Domain Split

Workforce is introduced as a dedicated architecture domain under `packages/workforce-*`, `packages/position-library`, and later `apps/ai-gateway-service/src/workforce-preview`.

## Data Flow

`Workforce Scheduler -> Employee Brain Adapter -> Existing Gateway Adapter Preview -> Model Library / CredentialRef boundary`

This flow is preview-only in Phase576A-F. It does not call `/chat-gateway/execute`, does not mutate provider runtime, and does not read raw credentials.

## Non-Goals

- No production execution.
- No all-employee broadcast.
- No automatic model request per employee.
- No copied Gateway core.
- No global complete occupation library claim.
