# Phase1951P Safe Internal Provider Executor Authorization

Phase1951P prepares a credentialRef-only internal Provider executor authorization surface.

This phase is design and dry-run only. It does not call NVIDIA, OpenAI, Claude, OpenRouter, MiMo, or any other Provider.

## Scope

- Adds `safeInternalProviderExecutor` as a dry-run executor stub.
- Adds an authorization schema and gate for Provider allowlist, model allowlist, request budget, and explicit call authorization.
- Keeps `allowProviderCall=false`, `maxRequests=0`, and `maxEstimatedCostUsd=0`.
- Preserves `provider_stability_not_verified` as an active blocker for real Provider stability claims.

## Boundary

- Raw secrets are not accepted.
- `.env` and `auth.json` are not read.
- Authorization headers and raw keys are not printed.
- `/chat` and `/chat-gateway/execute` default behavior is unchanged.
- Deploy, release, tag, artifact upload, commit, and push are not performed.

## Result

The executor authorization surface is ready as a dry-run stub. A later phase may introduce guarded real Provider call authorization, but this phase does not authorize or execute a Provider call.
