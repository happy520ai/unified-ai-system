# Phase585N Regression Pack

## Scope

Phase585N belongs to Internal Beta Stability Gate. Create an internal beta stability gate with dry-run auto-verification, manual owner trial templates, severity classes, known limits, rollback drill, and blocker remediation.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase585n/regression-pack-result.json
- verifier: tools/phase585n/validate-phase585n-regression-pack.mjs
- execution report: docs/phase585n-execution-report.md

## Preview Snapshot

- requiredFlag: internalBetaRegressionPackPassed
- traceRef: phase585n-trace-ref
- evidenceId: phase585n-evidence
- laneId: balanced-branch-fabric
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase585n-regression-pack.md, docs/phase585n-execution-report.md, tools/phase585n/validate-phase585n-regression-pack.mjs, and apps/ai-gateway-service/evidence/phase585n/regression-pack-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
