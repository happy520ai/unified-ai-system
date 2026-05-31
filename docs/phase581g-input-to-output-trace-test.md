# Phase581G Input-to-Output Trace Test

## Scope

Phase581G belongs to Debug Trace Evidence Query Maintenance Hardening. Make failures debuggable through traceRef, evidence query, failure taxonomy, maintenance ledger, debug snapshots, rollback guide, and operator runbook.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase581g/input-to-output-trace-test-result.json
- verifier: tools/phase581g/validate-phase581g-input-to-output-trace-test.mjs
- execution report: docs/phase581g-execution-report.md

## Preview Snapshot

- requiredFlag: inputToOutputTraceWorks
- traceRef: phase581g-trace-ref
- evidenceId: phase581g-evidence
- laneId: balanced-branch-fabric
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase581g-input-to-output-trace-test.md, docs/phase581g-execution-report.md, tools/phase581g/validate-phase581g-input-to-output-trace-test.mjs, and apps/ai-gateway-service/evidence/phase581g/input-to-output-trace-test-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
