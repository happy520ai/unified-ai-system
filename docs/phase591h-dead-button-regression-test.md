# Phase591H Dead Button Regression Test

## Scope

Phase591H belongs to UI UX Operator Acceptance Test Expansion. Expand Mission Control UI, dead button, screenshot, operator comprehension, runbook, and acceptance tests.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase591h/dead-button-regression-test-result.json
- verifier: tools/phase591h/validate-phase591h-dead-button-regression-test.mjs
- execution report: docs/phase591h-execution-report.md

## Preview Snapshot

- requiredFlag: deadButtonRegressionTestPassed
- traceRef: phase591h-trace-ref
- evidenceId: phase591h-evidence
- laneId: balanced-branch-fabric
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase591h-dead-button-regression-test.md, docs/phase591h-execution-report.md, tools/phase591h/validate-phase591h-dead-button-regression-test.mjs, and apps/ai-gateway-service/evidence/phase591h/dead-button-regression-test-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
