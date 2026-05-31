# Phase587I Evidence Consistency Loop

## Scope

Phase587I belongs to Long-Run Soak Regression Chaos Dry-Run. Run dry-run soak and chaos previews with random inputs, lane failures, unavailable employees, output failures, conflicts, safety blocks, drift guards, and repeated regression checks.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase587i/evidence-consistency-loop-result.json
- verifier: tools/phase587i/validate-phase587i-evidence-consistency-loop.mjs
- execution report: docs/phase587i-execution-report.md

## Preview Snapshot

- requiredFlag: evidenceConsistencyLoopPassed
- traceRef: phase587i-trace-ref
- evidenceId: phase587i-evidence
- laneId: balanced-branch-fabric
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase587i-evidence-consistency-loop.md, docs/phase587i-execution-report.md, tools/phase587i/validate-phase587i-evidence-consistency-loop.mjs, and apps/ai-gateway-service/evidence/phase587i/evidence-consistency-loop-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
