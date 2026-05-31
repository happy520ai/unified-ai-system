# Phase584E Branch Router Viewer

## Scope

Phase584E belongs to Mission Control Observability Operator UX. Expose unified IO, branch fabric, merger, safety, trace, load, adapter, and runbook observability in Mission Control without dead buttons.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase584e/branch-router-viewer-result.json
- verifier: tools/phase584e/validate-phase584e-branch-router-viewer.mjs
- execution report: docs/phase584e-execution-report.md

## Preview Snapshot

- requiredFlag: branchRouterViewerVisible
- traceRef: phase584e-trace-ref
- evidenceId: phase584e-evidence
- laneId: balanced-branch-fabric
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase584e-branch-router-viewer.md, docs/phase584e-execution-report.md, tools/phase584e/validate-phase584e-branch-router-viewer.mjs, and apps/ai-gateway-service/evidence/phase584e/branch-router-viewer-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
