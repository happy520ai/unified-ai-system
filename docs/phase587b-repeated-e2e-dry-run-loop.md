# Phase587B Repeated E2E Dry-Run Loop

## Scope

Phase587B belongs to Long-Run Soak Regression Chaos Dry-Run. Run dry-run soak and chaos previews with random inputs, lane failures, unavailable employees, output failures, conflicts, safety blocks, drift guards, and repeated regression checks.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase587b/repeated-e2e-dry-run-loop-result.json
- verifier: tools/phase587b/validate-phase587b-repeated-e2e-dry-run-loop.mjs
- execution report: docs/phase587b-execution-report.md

## Preview Snapshot

- requiredFlag: repeatedE2eDryRunLoopPassed
- traceRef: phase587b-trace-ref
- evidenceId: phase587b-evidence
- laneId: balanced-branch-fabric
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase587b-repeated-e2e-dry-run-loop.md, docs/phase587b-execution-report.md, tools/phase587b/validate-phase587b-repeated-e2e-dry-run-loop.mjs, and apps/ai-gateway-service/evidence/phase587b/repeated-e2e-dry-run-loop-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
