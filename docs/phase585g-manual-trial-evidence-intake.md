# Phase585G Manual Trial Evidence Intake

## Scope

Phase585G belongs to Internal Beta Stability Gate. Create an internal beta stability gate with dry-run auto-verification, manual owner trial templates, severity classes, known limits, rollback drill, and blocker remediation.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase585g/manual-trial-evidence-intake-result.json
- verifier: tools/phase585g/validate-phase585g-manual-trial-evidence-intake.mjs
- execution report: docs/phase585g-execution-report.md

## Preview Snapshot

- requiredFlag: manualTrialEvidenceIntakeReady
- traceRef: phase585g-trace-ref
- evidenceId: phase585g-evidence
- laneId: balanced-branch-fabric
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase585g-manual-trial-evidence-intake.md, docs/phase585g-execution-report.md, tools/phase585g/validate-phase585g-manual-trial-evidence-intake.mjs, and apps/ai-gateway-service/evidence/phase585g/manual-trial-evidence-intake-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
