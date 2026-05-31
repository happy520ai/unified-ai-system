# Phase 279A Full Codebase Audit, Verification and Minimal Repair

## Purpose

Phase 279A performs a local full-codebase audit, verification pass, and minimal repair seal. It checks workspace boundaries, package scripts, syntax/module health, provider boundaries, secret safety, phase evidence, UI observability, HTTP preview boundaries, and documentation consistency.

## Current status

This phase is local audit evidence only. It does not certify the system as production-ready. The workspace may be dirty, and this phase records that honestly instead of cleaning it.

## Audit scope

The audit covers root structure, `apps/ai-gateway-service`, `apps/agent-console`, shared packages, docs, evidence, package scripts, UI markers, HTTP preview endpoints, Token Cost Guard, RAG source selection, cache, quality-cost routing, and public knowledge import modules when present.

## Hard boundaries

This phase does not call MiMo. This phase does not call any paid API. This phase does not call embedding. This phase does not change the default NVIDIA `/chat` lane. This phase does not set MiMo as default. This phase does not modify `legacy/`. This phase does not create `PROJECT_CONTEXT.md`. This phase does not clear the dirty workspace. This phase only allows minimal repair.

## Workspace boundary

The audit records whether the workspace is dirty, whether `legacy/` is modified, whether `PROJECT_CONTEXT.md` exists, whether a worktree was created, and whether auto commit or auto push occurred.

## Secret safety audit

The audit scans docs, evidence, UI, fixtures, source, and package scripts for real-looking plaintext API keys or Authorization headers. Test fixtures such as synthetic `sk-test-xxxx` markers are treated as test fixtures, not real secrets.

## Provider boundary audit

The audit records that no paid provider call is executed, MiMo is not default, default NVIDIA `/chat` is unchanged, long context is not sent to a paid provider, and no large output or stress test is run.

## Package script audit

The audit checks root and service package script pairs for existing verifier, benchmark, import, calibration, and audit commands.

## Syntax and module health

The audit runs local `node --check` over Phase 279A audit modules, entrypoints, `consolePage.js`, and `httpServer.js`. The workspace check is performed separately through `cmd /c pnpm -r --if-present check`.

## Evidence chain audit

The audit checks key phase evidence from 107A, 245A, 255A, 268A through 277A, plus optional later phases when available. A missing optional phase is recorded as `not_available_or_not_sealed`.

## UI observability audit

The audit checks the `/ui` console source for Token Cost Guard, Token Saving Benchmark, MiMo Model ID Discovery, Token Estimator Calibration, RAG Source Selection Benchmark, System Capability Benchmark, Response Cache Hardening, Quality-Cost Router, Public Knowledge Import, and Full Codebase Audit panels.

## HTTP endpoint boundary audit

The audit reviews local HTTP endpoint markers such as `/cost/summary`, `/cache/*`, `/routing/*`, `/knowledge/import/*`, `/knowledge/enrichment/*`, and `/audit/*` when present. Preview endpoints must not call providers, read API keys, or change the default provider.

## Documentation consistency audit

Docs are checked for boundary statements, verification commands, no-paid-API statements where required, and no false production-ready claims.

## Minimal repair policy

Allowed repairs are limited to missing scripts, verifier path fixes, evidence field fixes, docs boundary additions, UI marker additions, syntax fixes, import path fixes, safe secret masking, and verifier logic corrections. Large refactors, provider changes, legacy edits, dependency additions, full repo formatting, and automatic commits are not allowed.

## Repairs applied

No business-code repair was required by the audit. Minimal audit repairs were applied so known verifier fixture strings, provider prefix rules, and `process.env` references are not misclassified as plaintext key leaks, and so large dirty workspace status output is still detected accurately. Phase 279A adds audit modules, verifier, docs, evidence, package scripts, and UI observability.

## Repairs intentionally skipped

The audit does not clear dirty workspace state, does not rewrite architecture, does not normalize unrelated historical evidence, and does not add optional Phase 278A surfaces.

## Remaining risks

This audit is deterministic local inspection. It does not prove runtime security under all deployments, does not prove production readiness, and does not replace targeted security review.

## Verification commands

```powershell
node --check apps/ai-gateway-service/src/audit/fullCodebaseAudit.js
node --check apps/ai-gateway-service/src/audit/codebaseAuditPolicy.js
node --check apps/ai-gateway-service/src/audit/codebaseAuditFileScanner.js
node --check apps/ai-gateway-service/src/audit/codebaseAuditSecretScanner.js
node --check apps/ai-gateway-service/src/audit/codebaseAuditPackageScripts.js
node --check apps/ai-gateway-service/src/audit/codebaseAuditPhaseEvidence.js
node --check apps/ai-gateway-service/src/audit/codebaseAuditBoundaryCheck.js
node --check apps/ai-gateway-service/src/audit/codebaseAuditRepairPlan.js
node --check apps/ai-gateway-service/src/entrypoints/runFullCodebaseAudit.js
node --check apps/ai-gateway-service/src/entrypoints/verifyFullCodebaseAudit.js
node --check apps/ai-gateway-service/src/ui/consolePage.js
node --check apps/ai-gateway-service/src/http/httpServer.js
cmd /c pnpm run audit:full-codebase
cmd /c pnpm run verify:phase279a-full-codebase-audit
cmd /c pnpm -r --if-present check
```

## Regression results

Regression results are recorded in `apps/ai-gateway-service/evidence/phase-279a-full-codebase-audit.json` after the audit run and external verifier chain.

## What this audit does not prove

This phase is not production certification. This phase is not security compliance certification. This phase is not a complete penetration test. It is not a guarantee that every possible vulnerability is absent.

## Next phase options

Recommended next route: Phase 280A Security Vulnerability Audit, Minimal Hardening and Full Functional Regression.
