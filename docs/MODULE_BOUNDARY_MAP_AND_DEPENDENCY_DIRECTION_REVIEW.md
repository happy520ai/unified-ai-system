# Phase 293A Module Boundary Map & Dependency Direction Review

## A. Current Module Boundary Overview

Phase292A established the local-only architecture refactor readiness baseline. Phase293A turns that baseline into a module boundary map and dependency direction review. This phase is read-only: it documents module ownership, allowed dependency flow, risky coupling points, and the next safe refactor step.

Current high-level boundaries:

- `apps/agent-console`: user-facing console entry and upper-layer interaction.
- `apps/ai-gateway-service`: gateway service runtime, local verifiers, evidence generation, UI console, routing, cost, knowledge, and workforce preview surfaces.
- `packages/shared-contracts`: public protocol and contract types.
- `packages/shared-sdk`: shared client and adapter surfaces.
- `packages/shared-config`: shared configuration defaults and config-safe helpers.
- `packages/shared-utils`: implementation-neutral utilities.

## B. apps/ai-gateway-service Internal Module Map

The service package currently groups behavior into the following folders:

- `application`: application composition and bootstrap glue.
- `audit`: codebase and security audit helpers.
- `benchmarks`: local benchmark harnesses.
- `cache`: cache policy and token cache/cost helpers.
- `capabilities`: capability and product limitation helpers.
- `core`: service core orchestration and shared service logic.
- `cost`: token cost, routing, and budget policy helpers.
- `enterprise`: enterprise-oriented preview and policy surfaces.
- `entrypoints`: CLI and phase verifier entrypoints.
- `http`: HTTP server and route registration.
- `knowledge`: local knowledge-service and knowledge infra helpers.
- `knowledge-import`: public knowledge import preview surfaces.
- `model-import`: model import preview and provider probe helpers.
- `providers`: provider adapters, registry, credential detection, and mapping.
- `rag`: RAG source, quality, and answer-path helpers.
- `regression`: matrix and regression classification helpers.
- `routing`: model tier and quality-cost routing helpers.
- `security`: local security policy and scanner helpers.
- `ui`: console page and UI rendering helpers.
- `workflow`: workflow and task-queue helpers.
- `workforce`: Agent Workforce plan, roles, and service helpers.

The current shape is still broader than a small-library architecture, so the safe rule is to keep entrypoints thin and move only low-risk shared helpers later.

## C. packages/* Shared Package Responsibilities

The shared packages have focused roles:

- `packages/shared-contracts`: typed contracts and public message shapes only.
- `packages/shared-sdk`: reusable client and adapter surfaces that can be shared by apps without depending on app internals.
- `packages/shared-config`: default config values and config-safe helpers.
- `packages/shared-utils`: implementation-neutral utility helpers.

Shared packages should not depend on app-level runtime modules. They should stay inward-facing and contract-safe.

## D. agent-console and ai-gateway-service Dependency Relation

`apps/agent-console` is the upper-layer interaction surface. `apps/ai-gateway-service` owns the service runtime and most phase verifiers.

Expected relation:

- `apps/agent-console` may depend on shared contracts, shared SDK, shared config, and the service API surface.
- `apps/ai-gateway-service` may depend on shared packages and its own internal helpers.
- `apps/ai-gateway-service` should not depend on `apps/agent-console`.

The dependency direction should remain top-down from console to service, not reversed.

## E. Current Allowed Dependency Directions

Allowed directions:

- `apps/agent-console` -> `packages/shared-contracts`
- `apps/agent-console` -> `packages/shared-sdk`
- `apps/agent-console` -> `packages/shared-config`
- `apps/agent-console` -> `packages/shared-utils`
- `apps/ai-gateway-service` -> `packages/shared-contracts`
- `apps/ai-gateway-service` -> `packages/shared-sdk`
- `apps/ai-gateway-service` -> `packages/shared-config`
- `apps/ai-gateway-service` -> `packages/shared-utils`
- `entrypoints` -> local service helpers
- `ui` -> read-only rendering helpers
- `regression` -> local read-only matrix helpers

The service can depend on its own internal submodules, but only in a direction that keeps entrypoints thin and keeps provider/runtime code isolated from docs/evidence rendering.

## F. Current Dangerous / Not Recommended Dependency Directions

Avoid or treat as high-risk:

- `shared-*` packages importing from `apps/*`
- `ui` importing provider runtime code
- `entrypoints` containing provider-side implementation logic instead of delegating to helpers
- `http` route handlers directly mixing evidence generation, provider routing, and UI rendering
- `knowledge-import` or `model-import` reaching into release/deploy or workspace mutation logic
- `providers` becoming a default-routine source of business policy rather than a narrow adapter layer
- `workforce` or `workflow` mutating unrelated global state outside their own domain helpers

These directions are not part of the safe boundary map for the next refactor step.

## G. High-Risk Coupling Points Found

The main coupling risks visible from the current directory structure are:

- `apps/ai-gateway-service/src/entrypoints` is still large and holds many phase-specific entrypoints.
- `apps/ai-gateway-service/src/ui/consolePage.js` remains the primary UI aggregation point.
- `apps/ai-gateway-service/src/http/httpServer.js` is a shared boundary for routes, local previews, and safety checks.
- `apps/ai-gateway-service/src/providers` concentrates provider registry, mapping, and adapters in one place, so accidental default-lane changes need caution.
- `apps/ai-gateway-service/src/routing` and `apps/ai-gateway-service/src/cost` are policy-adjacent and should stay free of unrelated UI or evidence responsibilities.
- `apps/ai-gateway-service/src/knowledge-import` and `apps/ai-gateway-service/src/model-import` touch preview and selection logic that must not become real-provider execution paths.
- `apps/ai-gateway-service/src/workforce` and `apps/ai-gateway-service/src/workflow` are easy places to confuse preview metadata with real execution.

## H. Phase294A Safe Refactor Harness Suggestion

Phase294A should add a local-only safe refactor harness that checks:

- dependency direction rules between app layers and shared packages
- forbidden imports from `apps/*` into shared packages
- provider-touching code stays out of `ui` and `docs/evidence`
- entrypoints remain thin wrappers around local helpers
- no default NVIDIA `/chat` changes and no provider-route drift

That harness should remain read-only and should not move any files.

## I. Phase295A First Low-Risk Module Extraction Candidate

The first low-risk extraction candidate should be a small shared read-only helper that removes duplication without touching runtime behavior.

Suggested candidate:

- `apps/ai-gateway-service/src/refactor/dependencyDirectionRules.js` or a similar read-only helper for boundary metadata and path classification.

This should only happen after Phase294A validates the boundary harness.

## J. Non-Claimable Capabilities and Boundary Notes

This review does not prove production readiness, does not prove safe release, does not prove deployment readiness, does not prove real provider readiness, does not prove embedding readiness, does not prove tenant isolation, and does not prove a completed architecture refactor.

It only documents the current module boundary map and the dependency direction rules that should hold before any real refactor begins.
