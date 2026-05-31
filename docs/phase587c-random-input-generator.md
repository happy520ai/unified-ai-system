# Phase587C Random Input Generator

## Scope

Phase587C belongs to Long-Run Soak Regression Chaos Dry-Run. Run dry-run soak and chaos previews with random inputs, lane failures, unavailable employees, output failures, conflicts, safety blocks, drift guards, and repeated regression checks.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase587c/random-input-generator-result.json
- verifier: tools/phase587c/validate-phase587c-random-input-generator.mjs
- execution report: docs/phase587c-execution-report.md

## Preview Snapshot

- requiredFlag: randomInputGeneratorWorks
- traceRef: phase587c-trace-ref
- evidenceId: phase587c-evidence
- laneId: balanced-branch-fabric
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase587c-random-input-generator.md, docs/phase587c-execution-report.md, tools/phase587c/validate-phase587c-random-input-generator.mjs, and apps/ai-gateway-service/evidence/phase587c/random-input-generator-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
