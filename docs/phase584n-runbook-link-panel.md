# Phase584N Runbook Link Panel

## Scope

Phase584N belongs to Mission Control Observability Operator UX. Expose unified IO, branch fabric, merger, safety, trace, load, adapter, and runbook observability in Mission Control without dead buttons.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase584n/runbook-link-panel-result.json
- verifier: tools/phase584n/validate-phase584n-runbook-link-panel.mjs
- execution report: docs/phase584n-execution-report.md

## Preview Snapshot

- requiredFlag: runbookLinkPanelVisible
- traceRef: phase584n-trace-ref
- evidenceId: phase584n-evidence
- laneId: balanced-branch-fabric
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase584n-runbook-link-panel.md, docs/phase584n-execution-report.md, tools/phase584n/validate-phase584n-runbook-link-panel.mjs, and apps/ai-gateway-service/evidence/phase584n/runbook-link-panel-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
