# Phase584D Employee Inbox Outbox Viewer

## Scope

Phase584D belongs to Mission Control Observability Operator UX. Expose unified IO, branch fabric, merger, safety, trace, load, adapter, and runbook observability in Mission Control without dead buttons.

## Boundary

- dry-run / preview only
- no provider call
- no raw secret or raw webhook read
- no external IM / email send
- no deploy, release, tag, or artifact upload
- no billing or invoice action
- no /chat modification
- no /chat-gateway/execute modification
- no Yiyi / Character / Guided Showcase / floating avatar restoration

## Evidence

- evidence JSON: apps/ai-gateway-service/evidence/phase584d/employee-inbox-outbox-viewer-result.json
- verifier: tools/phase584d/validate-phase584d-employee-inbox-outbox-viewer.mjs
- execution report: docs/phase584d-execution-report.md

## Preview Snapshot

- requiredFlag: employeeInboxOutboxViewerVisible
- traceRef: phase584d-trace-ref
- evidenceId: phase584d-evidence
- laneId: balanced-branch-fabric
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase584d-employee-inbox-outbox-viewer.md, docs/phase584d-execution-report.md, tools/phase584d/validate-phase584d-employee-inbox-outbox-viewer.mjs, and apps/ai-gateway-service/evidence/phase584d/employee-inbox-outbox-viewer-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
