# Phase637R Architecture Summary

## Current Architecture

- `apps/ai-gateway-service` owns the Workbench service, Mission Control UI, verifier entrypoints, and evidence workflows.
- `packages/codex-context-gateway` owns context pack, relevant file selection, stale guard, prompt pack, and token budget surfaces.
- Shared packages keep contracts, SDK, config, utilities, workforce scheduling, and employee communication boundaries independent.
- Runtime/main-chain Codex provider integration remains design-only through Phase630R.
