# Phase599 Authorization Packet Template

This template is placeholder-only. It is not a completed authorization packet and must not be treated as human approval.

## Required Fields
- `authorizationId`
- `allowCodexBaseUrlChange`
- `configScope`
- `relayRef`
- `credentialRef`
- `accountPoolRef`
- `maxRequests`
- `maxEstimatedCostUsd`
- `maxDurationMinutes`
- `rollbackOwner`
- `approvalReason`
- `approvalRecordRef`
- `emergencyDisablePlan`
- `humanApprovalReviewer`
- `humanApprovalTimestamp`
- `humanApprovalDecision`
- `guardedRealTestScope`
- `rollbackWindowMinutes`
- `createdAt`
- `dryRunOnly`

## Boundary
- raw API keys, raw secrets, raw webhooks, and raw base_url tokens are forbidden.
- Real Codex config writes remain blocked until a later explicitly authorized phase.
- A complete packet must be supplied separately as docs/phase599-authorization-packet.input.json.
