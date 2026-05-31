# Phase589P Adapter Readiness Integration Tests

## Scope

Phase589P belongs to Contract Unit Integration Test Expansion. Expand contract, unit, and integration dry-run tests for unified IO, employee bus, branch fabric, merger, load, failure injection, safety, adapters, trace, evidence, and maintenance ledgers.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase589p/adapter-readiness-integration-tests-result.json
- verifier: tools/phase589p/validate-phase589p-adapter-readiness-integration-tests.mjs
- execution report: docs/phase589p-execution-report.md

## Preview Snapshot

- requiredFlag: adapterReadinessIntegrationTestsPassed
- traceRef: phase589p-trace-ref
- evidenceId: phase589p-evidence
- laneId: adapter-readiness
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase589p-adapter-readiness-integration-tests.md, docs/phase589p-execution-report.md, tools/phase589p/validate-phase589p-adapter-readiness-integration-tests.mjs, and apps/ai-gateway-service/evidence/phase589p/adapter-readiness-integration-tests-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
