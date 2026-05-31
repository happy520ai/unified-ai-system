# Phase589I Adapter Contract Tests

## Scope

Phase589I belongs to Contract Unit Integration Test Expansion. Expand contract, unit, and integration dry-run tests for unified IO, employee bus, branch fabric, merger, load, failure injection, safety, adapters, trace, evidence, and maintenance ledgers.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase589i/adapter-contract-tests-result.json
- verifier: tools/phase589i/validate-phase589i-adapter-contract-tests.mjs
- execution report: docs/phase589i-execution-report.md

## Preview Snapshot

- requiredFlag: adapterContractTestsPassed
- traceRef: phase589i-trace-ref
- evidenceId: phase589i-evidence
- laneId: adapter-readiness
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase589i-adapter-contract-tests.md, docs/phase589i-execution-report.md, tools/phase589i/validate-phase589i-adapter-contract-tests.mjs, and apps/ai-gateway-service/evidence/phase589i/adapter-contract-tests-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
