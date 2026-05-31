# Phase589K Evidence Query Unit Tests

## Scope

Phase589K belongs to Contract Unit Integration Test Expansion. Expand contract, unit, and integration dry-run tests for unified IO, employee bus, branch fabric, merger, load, failure injection, safety, adapters, trace, evidence, and maintenance ledgers.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase589k/evidence-query-unit-tests-result.json
- verifier: tools/phase589k/validate-phase589k-evidence-query-unit-tests.mjs
- execution report: docs/phase589k-execution-report.md

## Preview Snapshot

- requiredFlag: evidenceQueryUnitTestsPassed
- traceRef: phase589k-trace-ref
- evidenceId: phase589k-evidence
- laneId: balanced-branch-fabric
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase589k-evidence-query-unit-tests.md, docs/phase589k-execution-report.md, tools/phase589k/validate-phase589k-evidence-query-unit-tests.mjs, and apps/ai-gateway-service/evidence/phase589k/evidence-query-unit-tests-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
