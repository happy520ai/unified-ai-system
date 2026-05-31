# Phase581S Mission Control Debug Preview

## Scope

Phase581S belongs to Debug Trace Evidence Query Maintenance Hardening. Make failures debuggable through traceRef, evidence query, failure taxonomy, maintenance ledger, debug snapshots, rollback guide, and operator runbook.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase581s/mission-control-debug-preview-result.json
- verifier: tools/phase581s/validate-phase581s-mission-control-debug-preview.mjs
- execution report: docs/phase581s-execution-report.md

## Preview Snapshot

- requiredFlag: debugPreviewVisible
- traceRef: phase581s-trace-ref
- evidenceId: phase581s-evidence
- laneId: balanced-branch-fabric
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase581s-mission-control-debug-preview.md, docs/phase581s-execution-report.md, tools/phase581s/validate-phase581s-mission-control-debug-preview.mjs, and apps/ai-gateway-service/evidence/phase581s/mission-control-debug-preview-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
