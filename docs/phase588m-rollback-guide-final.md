# Phase588M Rollback Guide Final

## Scope

Phase588M belongs to Architecture Lock Final Maintenance Pack. Lock final architecture and maintenance handoff boundaries, including package, contract, unified IO, employee bus, branch fabric, merger, safety, adapter, Mission Control, runbooks, rollback, known limits, and authorization gates.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase588m/rollback-guide-final-result.json
- verifier: tools/phase588m/validate-phase588m-rollback-guide-final.mjs
- execution report: docs/phase588m-execution-report.md

## Preview Snapshot

- requiredFlag: rollbackGuideFinalExists
- traceRef: phase588m-trace-ref
- evidenceId: phase588m-evidence
- laneId: balanced-branch-fabric
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase588m-rollback-guide-final.md, docs/phase588m-execution-report.md, tools/phase588m/validate-phase588m-rollback-guide-final.mjs, and apps/ai-gateway-service/evidence/phase588m/rollback-guide-final-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
