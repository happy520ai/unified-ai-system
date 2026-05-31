# Phase587T Long-Run Stability Closure

## Scope

Phase587T belongs to Long-Run Soak Regression Chaos Dry-Run. Run dry-run soak and chaos previews with random inputs, lane failures, unavailable employees, output failures, conflicts, safety blocks, drift guards, and repeated regression checks.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase587t/long-run-stability-closure-result.json
- verifier: tools/phase587t/validate-phase587t-long-run-stability-closure.mjs
- execution report: docs/phase587t-execution-report.md

## Preview Snapshot

- requiredFlag: phase587RecommendedSealed
- traceRef: phase587t-trace-ref
- evidenceId: phase587t-evidence
- laneId: balanced-branch-fabric
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase587t-long-run-stability-closure.md, docs/phase587t-execution-report.md, tools/phase587t/validate-phase587t-long-run-stability-closure.mjs, and apps/ai-gateway-service/evidence/phase587t/long-run-stability-closure-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
