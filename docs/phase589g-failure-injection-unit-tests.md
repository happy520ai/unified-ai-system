# Phase589G Failure Injection Unit Tests

## Scope

Phase589G belongs to Contract Unit Integration Test Expansion. Expand contract, unit, and integration dry-run tests for unified IO, employee bus, branch fabric, merger, load, failure injection, safety, adapters, trace, evidence, and maintenance ledgers.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase589g/failure-injection-unit-tests-result.json
- verifier: tools/phase589g/validate-phase589g-failure-injection-unit-tests.mjs
- execution report: docs/phase589g-execution-report.md

## Preview Snapshot

- requiredFlag: failureInjectionUnitTestsPassed
- traceRef: phase589g-trace-ref
- evidenceId: phase589g-evidence
- laneId: balanced-branch-fabric
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase589g-failure-injection-unit-tests.md, docs/phase589g-execution-report.md, tools/phase589g/validate-phase589g-failure-injection-unit-tests.mjs, and apps/ai-gateway-service/evidence/phase589g/failure-injection-unit-tests-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
