# Phase590E Employee Unavailable Chaos Test

## Scope

Phase590E belongs to Load Chaos Failure Injection Test Expansion. Expand load, chaos, lane fallback, trace consistency, and failure injection dry-run tests without external side effects.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase590e/employee-unavailable-chaos-test-result.json
- verifier: tools/phase590e/validate-phase590e-employee-unavailable-chaos-test.mjs
- execution report: docs/phase590e-execution-report.md

## Preview Snapshot

- requiredFlag: employeeUnavailableChaosTestPassed
- traceRef: phase590e-trace-ref
- evidenceId: phase590e-evidence
- laneId: load-governed
- inputCount: 64
- accepted: 12
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase590e-employee-unavailable-chaos-test.md, docs/phase590e-execution-report.md, tools/phase590e/validate-phase590e-employee-unavailable-chaos-test.mjs, and apps/ai-gateway-service/evidence/phase590e/employee-unavailable-chaos-test-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
