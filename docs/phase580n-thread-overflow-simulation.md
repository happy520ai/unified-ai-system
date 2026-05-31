# Phase580N Thread Overflow Simulation

## Scope

Phase580N belongs to Concurrency Load Branch Pressure Hardening. Prove dry-run load pressure is governed without provider calls, full broadcast, foreground starvation, or uncontrolled branch fanout.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase580n/thread-overflow-simulation-result.json
- verifier: tools/phase580n/validate-phase580n-thread-overflow-simulation.mjs
- execution report: docs/phase580n-execution-report.md

## Preview Snapshot

- requiredFlag: threadOverflowHandled
- traceRef: phase580n-trace-ref
- evidenceId: phase580n-evidence
- laneId: load-governed
- inputCount: 64
- accepted: 64
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase580n-thread-overflow-simulation.md, docs/phase580n-execution-report.md, tools/phase580n/validate-phase580n-thread-overflow-simulation.mjs, and apps/ai-gateway-service/evidence/phase580n/thread-overflow-simulation-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
