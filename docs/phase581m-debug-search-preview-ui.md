# Phase581M Debug Search Preview UI

## Scope

Phase581M belongs to Debug Trace Evidence Query Maintenance Hardening. Make failures debuggable through traceRef, evidence query, failure taxonomy, maintenance ledger, debug snapshots, rollback guide, and operator runbook.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase581m/debug-search-preview-ui-result.json
- verifier: tools/phase581m/validate-phase581m-debug-search-preview-ui.mjs
- execution report: docs/phase581m-execution-report.md

## Preview Snapshot

- requiredFlag: debugSearchPreviewVisible
- traceRef: phase581m-trace-ref
- evidenceId: phase581m-evidence
- laneId: balanced-branch-fabric
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase581m-debug-search-preview-ui.md, docs/phase581m-execution-report.md, tools/phase581m/validate-phase581m-debug-search-preview-ui.mjs, and apps/ai-gateway-service/evidence/phase581m/debug-search-preview-ui-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
