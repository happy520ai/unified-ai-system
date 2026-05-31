# Phase579F Urgent Model-Race Preview Scenario Pack

## Scope

Phase579F belongs to Scenario Matrix Hardening. Cover Phase578 execution fabric with simple, standard, complex, urgent, high-risk, background, employee, conflict, invalid input, duplicate, and fallback scenario previews.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase579f/urgent-model-race-preview-scenario-pack-result.json
- verifier: tools/phase579f/validate-phase579f-urgent-model-race-preview-scenario-pack.mjs
- execution report: docs/phase579f-execution-report.md

## Preview Snapshot

- requiredFlag: urgentRacePreviewWorks
- traceRef: phase579f-trace-ref
- evidenceId: phase579f-evidence
- laneId: fast-race-preview
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase579f-urgent-model-race-preview-scenario-pack.md, docs/phase579f-execution-report.md, tools/phase579f/validate-phase579f-urgent-model-race-preview-scenario-pack.mjs, and apps/ai-gateway-service/evidence/phase579f/urgent-model-race-preview-scenario-pack-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
