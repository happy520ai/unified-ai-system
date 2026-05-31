# Phase587R Soak Failure Report

## Scope

Phase587R belongs to Long-Run Soak Regression Chaos Dry-Run. Run dry-run soak and chaos previews with random inputs, lane failures, unavailable employees, output failures, conflicts, safety blocks, drift guards, and repeated regression checks.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase587r/soak-failure-report-result.json
- verifier: tools/phase587r/validate-phase587r-soak-failure-report.mjs
- execution report: docs/phase587r-execution-report.md

## Preview Snapshot

- requiredFlag: soakFailureReportExists
- traceRef: phase587r-trace-ref
- evidenceId: phase587r-evidence
- laneId: balanced-branch-fabric
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase587r-soak-failure-report.md, docs/phase587r-execution-report.md, tools/phase587r/validate-phase587r-soak-failure-report.mjs, and apps/ai-gateway-service/evidence/phase587r/soak-failure-report-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
