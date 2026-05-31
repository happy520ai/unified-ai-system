# Phase587Q Product Recovery Repeated Run

## Scope

Phase587Q belongs to Long-Run Soak Regression Chaos Dry-Run. Run dry-run soak and chaos previews with random inputs, lane failures, unavailable employees, output failures, conflicts, safety blocks, drift guards, and repeated regression checks.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase587q/product-recovery-repeated-run-result.json
- verifier: tools/phase587q/validate-phase587q-product-recovery-repeated-run.mjs
- execution report: docs/phase587q-execution-report.md

## Preview Snapshot

- requiredFlag: productRecoveryRepeatedRunPassed
- traceRef: phase587q-trace-ref
- evidenceId: phase587q-evidence
- laneId: balanced-branch-fabric
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase587q-product-recovery-repeated-run.md, docs/phase587q-execution-report.md, tools/phase587q/validate-phase587q-product-recovery-repeated-run.mjs, and apps/ai-gateway-service/evidence/phase587q/product-recovery-repeated-run-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
