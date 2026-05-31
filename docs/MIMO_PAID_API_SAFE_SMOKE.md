# MiMo Paid API Safe Smoke

## Purpose

Phase 269A verifies that Xiaomi MiMo v2.5 Pro can be called through the existing provider / OpenAI-compatible path as an explicit, non-default paid API smoke. The goal is a tiny, auditable paid smoke, not production routing.

## Current status

MiMo v2.5 Pro is configured but not default. This phase does not change default NVIDIA `/chat`. The smoke is a single explicit command and is not connected to automatic fallback, automatic routing, or default model switching.

## Configuration source

The existing system already has a MiMo provider descriptor in `packages/shared-config/src/index.js`:

- `providerId: "mimo"`
- `providerType: "openai-compatible"`
- default endpoint shape: `https://token-plan-cn.xiaomimimo.com/v1`
- env names: `MIMO_API_KEY`, `MIMO_BASE_URL`, `MIMO_MODEL`
- runtime credential store path: local user file under `<LOCALAPPDATA>/PME-Moving-Earth/unified-ai-system/runtime-credentials.json`

The smoke reads only the key needed for the provider call. It records only `apiKeyPresent=true` and `apiKeyMasked=true`; no plaintext API key is written.

## Safety boundaries

- no default NVIDIA `/chat` lane change
- no MiMo default provider switch
- no plaintext API key in docs, evidence, logs, or console output
- no full Authorization header output
- no full env output
- no long project context
- no docs/evidence context attached
- no multi-turn test
- no retry loop
- no pressure test
- no automatic fallback to a paid model
- no production-ready claim
- no Codex CLI
- no real Codex exec
- no workflow runner
- no worktree creation
- no auto commit/push/PR/release

## What this smoke does

- Confirms MiMo configuration can be discovered.
- Confirms the API key is present without exposing it.
- Uses the existing OpenAI-compatible provider adapter.
- Sends one tiny prompt: `Reply with exactly: MIMO_SMOKE_OK`.
- Sets `temperature=0`.
- Caps output with `maxOutputTokens=16`.
- Uses `stream=false`.
- Records the standardized gateway response summary.
- Records usage token numbers if returned by the provider.
- Records Phase 268A Token Cost Guard estimate and decision before the paid call.

## What this smoke does not do

- It does not set MiMo as default.
- It does not change NVIDIA `/chat`.
- It does not route normal `/chat` traffic to MiMo.
- It does not add production provider routing.
- It does not enable automatic fallback to paid models.
- It does not send project docs, evidence, or long context.
- It does not perform load testing, pressure testing, or multi-turn testing.

## Token/cost control

Phase 269A uses Phase 268A Token Cost Guard before any paid call. The smoke records:

- estimated input tokens
- estimated output tokens
- estimated total tokens
- estimated cost USD
- budget decision
- guard decision

If the guard returns `block`, the script writes blocked evidence and does not call MiMo.

## Exact smoke command

```powershell
cmd /c pnpm run smoke:mimo-paid-route
```

The command performs at most one tiny paid smoke call.

## Evidence output

Evidence is written to:

- `apps/ai-gateway-service/evidence/phase-269a-mimo-paid-api-safe-smoke.json`
- `apps/ai-gateway-service/evidence/phase-269a-mimo-paid-api-safe-smoke.md`

The evidence records provider, model, safe request limits, standardized response status, optional usage token numbers, and safety boundaries. It does not record plaintext API keys.

## Failure modes

The smoke may be blocked or fail for explicit reasons:

- `mimo_api_key_missing`
- `mimo_endpoint_missing`
- `mimo_model_missing`
- `token_cost_guard_blocked_paid_smoke`
- provider authentication failure
- provider authorization failure
- rate limit or quota failure
- network failure
- timeout
- invalid or non-OpenAI-compatible response

If blocked or failed, evidence must not claim success.

## Default provider protection

The smoke uses an explicit `providerId=mimo` request. The smoke environment keeps:

- `AI_GATEWAY_DEFAULT_PROVIDER=nvidia`
- `AI_GATEWAY_ENABLED_PROVIDERS=nvidia,mimo`
- `AI_GATEWAY_FALLBACK_ENABLED=false`

Default NVIDIA `/chat` remains unchanged.

## Verification commands

```powershell
node --check apps/ai-gateway-service/src/entrypoints/smokeMimoPaidRoute.js
node --check apps/ai-gateway-service/src/entrypoints/verifyMimoPaidApiSafeSmoke.js
cmd /c pnpm run smoke:mimo-paid-route
cmd /c pnpm run verify:phase269a-mimo-paid-api-safe-smoke
```

Recommended regression:

```powershell
cmd /c pnpm run verify:phase267a-architecture-report
cmd /c pnpm run verify:phase255a-personal-knowledge-value-closure
cmd /c pnpm run verify:phase245a-personal-value-closure
cmd /c pnpm run verify:phase107a-secret-safety
cmd /c pnpm run health:phase12a
cmd /c pnpm run doctor:phase13a
cmd /c pnpm -r --if-present check
```

## Next phase options

- Add a read-only provider status endpoint.
- Add a manual UI button that only shows the exact command, not a paid-call trigger.
- Add per-provider budget policy using the Token Cost Guard.
- Add a non-default MiMo provider adapter verifier.
- Add explicit user approval before any broader paid-provider trial.
- Keep production routing and default provider switching for a separate approved phase.
