# Phase587A Long-Run Soak Plan

## Scope

Phase587A belongs to Long-Run Soak Regression Chaos Dry-Run. Run dry-run soak and chaos previews with random inputs, lane failures, unavailable employees, output failures, conflicts, safety blocks, drift guards, and repeated regression checks.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase587a/long-run-soak-plan-result.json
- verifier: tools/phase587a/validate-phase587a-long-run-soak-plan.mjs
- execution report: docs/phase587a-execution-report.md

## Preview Snapshot

- requiredFlag: longRunSoakPlanExists
- traceRef: phase587a-trace-ref
- evidenceId: phase587a-evidence
- laneId: balanced-branch-fabric
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase587a-long-run-soak-plan.md, docs/phase587a-execution-report.md, tools/phase587a/validate-phase587a-long-run-soak-plan.mjs, and apps/ai-gateway-service/evidence/phase587a/long-run-soak-plan-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
