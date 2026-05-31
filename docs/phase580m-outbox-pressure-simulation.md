# Phase580M Outbox Pressure Simulation

## Scope

Phase580M belongs to Concurrency Load Branch Pressure Hardening. Prove dry-run load pressure is governed without provider calls, full broadcast, foreground starvation, or uncontrolled branch fanout.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase580m/outbox-pressure-simulation-result.json
- verifier: tools/phase580m/validate-phase580m-outbox-pressure-simulation.mjs
- execution report: docs/phase580m-execution-report.md

## Preview Snapshot

- requiredFlag: outboxPressureHandled
- traceRef: phase580m-trace-ref
- evidenceId: phase580m-evidence
- laneId: load-governed
- inputCount: 64
- accepted: 64
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase580m-outbox-pressure-simulation.md, docs/phase580m-execution-report.md, tools/phase580m/validate-phase580m-outbox-pressure-simulation.mjs, and apps/ai-gateway-service/evidence/phase580m/outbox-pressure-simulation-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
