# Phase591F Mission Control Adapter UI Test

## Scope

Phase591F belongs to UI UX Operator Acceptance Test Expansion. Expand Mission Control UI, dead button, screenshot, operator comprehension, runbook, and acceptance tests.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase591f/mission-control-adapter-ui-test-result.json
- verifier: tools/phase591f/validate-phase591f-mission-control-adapter-ui-test.mjs
- execution report: docs/phase591f-execution-report.md

## Preview Snapshot

- requiredFlag: missionControlAdapterUiTestPassed
- traceRef: phase591f-trace-ref
- evidenceId: phase591f-evidence
- laneId: adapter-readiness
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase591f-mission-control-adapter-ui-test.md, docs/phase591f-execution-report.md, tools/phase591f/validate-phase591f-mission-control-adapter-ui-test.mjs, and apps/ai-gateway-service/evidence/phase591f/mission-control-adapter-ui-test-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
