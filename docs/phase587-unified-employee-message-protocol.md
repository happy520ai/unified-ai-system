# Phase587 Unified Employee Message Protocol

`EmployeeMessageEnvelope` is the internal source of truth for employee
communication.

Required fields:

- `messageId`
- `threadId`
- `fromEmployeeId`
- `toEmployeeIds`
- `ccEmployeeIds`
- `messageType`
- `intent`
- `title`
- `body`
- `taskRef`
- `evidenceRef`
- `requiresResponse`
- `responseDeadlineMs`
- `riskLevel`
- `dryRunOnly`
- `createdAt`

Supported message types:

- `ask`
- `reply`
- `review_request`
- `review_result`
- `handoff`
- `clarification`
- `objection`
- `approval_request`
- `approval_result`
- `reject`
- `summary`
- `final_recommendation`

All Phase587 messages must set `dryRunOnly=true`.

