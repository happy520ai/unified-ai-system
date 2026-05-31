# Phase583S Adapter Readiness Runbook

## Scope

Phase583S belongs to External Adapter Readiness Without Real Send. Prepare Feishu, WeCom, Web, and API adapter contracts without reading raw webhooks or sending any external message.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase583s/adapter-readiness-runbook-result.json
- verifier: tools/phase583s/validate-phase583s-adapter-readiness-runbook.mjs
- execution report: docs/phase583s-execution-report.md

## Preview Snapshot

- requiredFlag: adapterReadinessRunbookExists
- traceRef: phase583s-trace-ref
- evidenceId: phase583s-evidence
- laneId: adapter-readiness
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase583s-adapter-readiness-runbook.md, docs/phase583s-execution-report.md, tools/phase583s/validate-phase583s-adapter-readiness-runbook.mjs, and apps/ai-gateway-service/evidence/phase583s/adapter-readiness-runbook-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
