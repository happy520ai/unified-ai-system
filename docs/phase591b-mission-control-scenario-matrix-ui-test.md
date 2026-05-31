# Phase591B Mission Control Scenario Matrix UI Test

## Scope

Phase591B belongs to UI UX Operator Acceptance Test Expansion. Expand Mission Control UI, dead button, screenshot, operator comprehension, runbook, and acceptance tests.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase591b/mission-control-scenario-matrix-ui-test-result.json
- verifier: tools/phase591b/validate-phase591b-mission-control-scenario-matrix-ui-test.mjs
- execution report: docs/phase591b-execution-report.md

## Preview Snapshot

- requiredFlag: missionControlScenarioMatrixUiTestPassed
- traceRef: phase591b-trace-ref
- evidenceId: phase591b-evidence
- laneId: balanced-branch-fabric
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase591b-mission-control-scenario-matrix-ui-test.md, docs/phase591b-execution-report.md, tools/phase591b/validate-phase591b-mission-control-scenario-matrix-ui-test.mjs, and apps/ai-gateway-service/evidence/phase591b/mission-control-scenario-matrix-ui-test-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
