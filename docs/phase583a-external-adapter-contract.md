# Phase583A External Adapter Contract

## Scope

Phase583A belongs to External Adapter Readiness Without Real Send. Prepare Feishu, WeCom, Web, and API adapter contracts without reading raw webhooks or sending any external message.

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

- evidence JSON: apps/ai-gateway-service/evidence/phase583a/external-adapter-contract-result.json
- verifier: tools/phase583a/validate-phase583a-external-adapter-contract.mjs
- execution report: docs/phase583a-execution-report.md

## Preview Snapshot

- requiredFlag: externalAdapterContractExists
- traceRef: phase583a-trace-ref
- evidenceId: phase583a-evidence
- laneId: adapter-readiness
- inputCount: 6
- accepted: 6
- deferred: 0
- rejected: 0

## Rollback

Remove docs/phase583a-external-adapter-contract.md, docs/phase583a-execution-report.md, tools/phase583a/validate-phase583a-external-adapter-contract.mjs, and apps/ai-gateway-service/evidence/phase583a/external-adapter-contract-result.json; revert only Phase579-591 long-horizon hardening preview additions while keeping legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider credentials, external IM, billing, deploy, release, tags, and artifacts untouched.
