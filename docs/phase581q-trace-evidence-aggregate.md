# Phase581Q Trace Evidence Aggregate

## Scope

Phase581Q belongs to Debug Trace Evidence Query Maintenance Hardening. Make failures debuggable through traceRef, evidence query, failure taxonomy, maintenance ledger, debug snapshots, rollback guide, and operator runbook.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase581q/trace-evidence-aggregate-result.json
- verifier: tools/phase581q/validate-phase581q-trace-evidence-aggregate.mjs
- execution report: docs/phase581q-execution-report.md

## Preview Snapshot

- requiredFlag: traceEvidenceAggregatePassed
- traceRef: phase581q-trace-ref
- evidenceId: phase581q-evidence
- laneId: balanced-branch-fabric
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase581q-trace-evidence-aggregate.md, docs/phase581q-execution-report.md, tools/phase581q/validate-phase581q-trace-evidence-aggregate.mjs, and apps/ai-gateway-service/evidence/phase581q/trace-evidence-aggregate-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
