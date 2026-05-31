# Architecture Extension Guide

## Purpose

This guide describes how to add future phases, runners, verifiers, evidence, UI panels, providers, and knowledge features without breaking current local safety boundaries.

## How To Add A Phase

1. Create a focused phase document in `docs/`.
2. Add a runner under `apps/ai-gateway-service/src/entrypoints/`.
3. Add a verifier under `apps/ai-gateway-service/src/entrypoints/`.
4. Add evidence JSON and Markdown under `apps/ai-gateway-service/evidence/`.
5. Add root and service package scripts.
6. Add the phase to the regression matrix only when the verifier is present and safe to classify.

## How To Add A Runner

Use an ESM entrypoint. Keep it local-only unless the phase explicitly allows a real call. The runner should write deterministic evidence and print a short JSON summary.

## How To Add A Verifier

Verify required files, required package scripts, required evidence fields, safety flags, docs markers, and any UI/module markers. A verifier must fail honestly.

## How To Add Evidence

Evidence must record phase, status, generated time, safety flags, changed surfaces, blockers, and final conclusion. Do not write plaintext secrets.

## How To Add A UI Panel

Prefer a small panel helper module when the UI copy or data mapping is reusable. Keep product-facing panels clear and avoid claiming production readiness.

## How To Safely Add Provider

Add a design gate first. Do not change the default provider route, `/chat`, or paid-provider fallback until a dedicated provider integration phase approves and verifies it.

## How To Safely Add Knowledge Feature

Keep ingestion, provenance, indexing, retrieval, and freshness checks explicit. Do not claim automatic learning is live until sealed by a matching phase and regression evidence.

## Safety Checklist

- No `legacy/` modification.
- No `PROJECT_CONTEXT.md` creation.
- No paid API, MiMo, embedding, or real external provider call unless explicitly approved by a matching phase.
- No release, deploy, commit, or push by default.
- No workspace-clean claim unless `git status` proves it.
- No production-ready or perfect claim.

## Testing Checklist

- Run `node --check` for new entrypoints.
- Run the phase verifier.
- Run `verify:safe-regression-matrix`.
- Run secret safety.
- Run local health and doctor when the phase asks for runtime stability.
- Run workspace package checks with `pnpm -r --if-present check`.
