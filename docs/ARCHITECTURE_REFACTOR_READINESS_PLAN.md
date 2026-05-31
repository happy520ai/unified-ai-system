# Architecture Refactor Readiness Plan

Phase292A records the local-only readiness plan for future architecture refactoring. This phase does not perform real refactoring, does not change business logic, and does not call external providers.

## A. Current Architecture Layer Map

- `apps/agent-console`: upper-layer interaction and user-facing console entry.
- `apps/ai-gateway-service`: AI Gateway service runtime, local verifiers, evidence generation, UI console page, routing/cost/RAG/agent-workforce preview surfaces.
- `packages/shared-contracts`: shared protocol and public contract types.
- `packages/shared-sdk`: reusable client, adapters, and SDK surfaces.
- `packages/shared-config`: shared configuration defaults and contract-safe configuration helpers.
- `packages/shared-utils`: implementation-neutral utility helpers.
- `docs`: human-readable phase reports, readiness documents, and operational guidance.
- `apps/ai-gateway-service/evidence`: machine-readable and human-readable verification artifacts.
- `legacy/`: read-only historical references only; not a development target.

## B. Safe Refactor Zones

- Local-only verifier organization under `apps/ai-gateway-service/src/entrypoints`.
- Documentation structure under `docs`.
- Evidence schema consistency for local-only phase reports.
- Internal helper extraction where behavior is fully covered by existing safe regression commands.
- UI readiness/status presentation only when there is an existing clear insertion point and no business behavior change.

## C. Forbidden Refactor Zones

- `legacy/` must not be modified.
- `PROJECT_CONTEXT.md` must not be created.
- Default NVIDIA `/chat` behavior must not be changed.
- No paid API, MiMo, embedding, or external provider calls.
- No release, deploy, commit, push, worktree creation, real Codex execution, or workflow runner execution.
- No large file movement, workspace cleanup, destructive deletion, or broad rewrite.

## D. Module Boundary Risk Register

| Area | Risk | Control |
| --- | --- | --- |
| Provider routing | Accidental default behavior change | Verify NVIDIA `/chat` remains unchanged; avoid provider logic in refactor prep |
| RAG / knowledge | Stale or external retrieval assumptions | Keep Phase292A local-only; no embedding/provider calls |
| Cost guard | Misreporting token/cost safety | Preserve existing verifiers and evidence markers |
| Agent Workforce | Confusing preview state with real execution | Do not enable real Codex exec, worktree, or workflow runner |
| UI console | Cosmetic changes mistaken for functional readiness | UI optional only; no forced UI change in Phase292A |
| Evidence chain | False pass or stale evidence | Static verifier checks required markers and local-only flags |

## E. Follow-Up Small-Step Refactor Route

- Phase293A: Module Boundary Map. Produce a deeper map of import ownership and allowed dependency directions without moving files.
- Phase294A: Safe Refactor Harness. Add local-only checks that detect forbidden dependency direction and unsafe provider-touching changes.
- Phase295A: Small Module Extraction 1. Extract one low-risk helper module only after Phase293A and Phase294A pass.

## F. Required Verification Commands

Phase292A required commands:

```powershell
node --check apps/ai-gateway-service/src/entrypoints/verifyArchitectureRefactorReadinessPlan.js
cmd /c pnpm run verify:phase292a-architecture-refactor-readiness-plan
cmd /c pnpm run verify:safe-regression-matrix
cmd /c pnpm run verify:phase107a-secret-safety
cmd /c pnpm run health:phase12a
cmd /c pnpm run doctor:phase13a
cmd /c pnpm -r --if-present check
```

## G. Non-Claimable Capabilities

Phase292A does not prove production readiness, clean workspace status, real external provider end-to-end readiness, paid provider readiness, embedding readiness, release readiness, deployment readiness, enterprise tenant isolation, billing reconciliation, or full SaaS production operation.

## H. Rollback Strategy

Rollback is limited to removing this document, the Phase292A verifier, the Phase292A evidence files, and the two package script entries. No business logic, provider runtime, legacy code, deployment configuration, or release surface is changed by this phase.

## I. Performance and Maintainability Improvement Directions

Future phases may improve maintainability by reducing verifier duplication, clarifying module boundaries, extracting local-only helpers, and reducing accidental full-context reads. Performance work should remain evidence-backed and must not be claimed until measured by local benchmarks or approved real-provider tests.
