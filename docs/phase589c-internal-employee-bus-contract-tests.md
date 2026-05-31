# Phase589C Internal Employee Bus Contract Tests

## Scope

Phase589C belongs to Contract Unit Integration Test Expansion. Expand contract, unit, and integration dry-run tests for unified IO, employee bus, branch fabric, merger, load, failure injection, safety, adapters, trace, evidence, and maintenance ledgers.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase589c/internal-employee-bus-contract-tests-result.json
- verifier: tools/phase589c/validate-phase589c-internal-employee-bus-contract-tests.mjs
- execution report: docs/phase589c-execution-report.md

## Preview Snapshot

- requiredFlag: internalEmployeeBusContractTestsPassed
- traceRef: phase589c-trace-ref
- evidenceId: phase589c-evidence
- laneId: balanced-branch-fabric
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase589c-internal-employee-bus-contract-tests.md, docs/phase589c-execution-report.md, tools/phase589c/validate-phase589c-internal-employee-bus-contract-tests.mjs, and apps/ai-gateway-service/evidence/phase589c/internal-employee-bus-contract-tests-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
