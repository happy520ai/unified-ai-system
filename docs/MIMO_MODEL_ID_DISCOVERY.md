# MiMo Model ID Discovery

## Purpose

Phase 271A safely identifies the working Xiaomi MiMo model id and verifies it with a tiny non-default paid smoke when needed. The goal is to repair the Phase 269A blocker without changing the default chat path.

This phase does not set MiMo as default.
This phase does not change the default NVIDIA `/chat` lane.
This phase sends no project long context.
This phase uses at most tiny smoke calls.
This phase writes no plaintext API key.
This phase is not production routing.

## Why Phase 269A failed

Phase 269A executed one tiny MiMo paid smoke through the explicit non-default provider path. The request was safe, but the provider rejected the configured model id with `Not supported model MiMo-V2.5-Pro`.

The Phase 269A verifier passed only as a safety verifier. Its evidence status remained `failed`, so the failed smoke was not treated as a success.

## Current MiMo configuration

The system has a MiMo provider descriptor under `packages/shared-config/src/index.js`:

- provider id: `mimo`
- provider type: `openai-compatible`
- default endpoint shape: `https://token-plan-cn.xiaomimimo.com/v1`
- env names: `MIMO_API_KEY`, `MIMO_BASE_URL`, `MIMO_MODEL`
- default chat provider remains `nvidia`

The local runtime credential store can contain the MiMo key and model list, but evidence records only key presence and masked state.

## Model ID discovery strategy

The discovery script first reads safe configuration metadata: provider id, base URL presence, API key presence, configured model id, runtime model ids, OpenAI-compatible adapter availability, and default provider state.

It then tries `/models`. If `/models` returns a clear model list, the script chooses the best MiMo v2.5 Pro match and tests only that model with one tiny chat-completions smoke. If `/models` is unavailable, the script tests candidate model ids with strict caps and stops at the first success.

Known failed Phase 269A model ids are skipped to avoid repeating a paid failure.

## Candidate model IDs

Candidate order is:

1. current configured model id
2. `mimo-v2.5-pro`
3. `xiaomi/mimo-v2.5-pro`
4. `MiMo-V2.5-Pro`
5. `mimo-v2-5-pro`

Runtime credential store models may also be considered. The script does not test every candidate if an earlier candidate works.

## /models endpoint behavior

The script attempts `GET /models` against the configured MiMo base URL. It records only status, model count, and matching model ids. It does not record any API key or Authorization header.

If authentication format is ambiguous, the script can try `Authorization: Bearer <key>` and `api-key: <key>`, but evidence records only the header style label, never the value.

## Safe smoke rules

Tiny smoke request body:

```json
{
  "model": "<candidateModelId>",
  "messages": [
    {
      "role": "user",
      "content": "Reply exactly: MIMO_SMOKE_OK"
    }
  ],
  "temperature": 0,
  "stream": false,
  "max_tokens": 32
}
```

Safety limits:

- prompt length is under 80 characters
- `maxOutputTokens=32`
- `stream=false`
- no project docs, README, AGENTS, evidence, handoff, review, or long context
- no multi-turn chat
- no stress test
- no automatic fallback to MiMo
- `paidApiCallCount <= 3`
- `successfulSmokeCallCount <= 1`

## Token guard usage

Before any chat-completions smoke, the script calls Phase 268A Token Cost Guard when available. It records estimated input tokens, estimated output tokens, estimated total tokens, and the guard decision.

If the guard returns `block`, no MiMo smoke is called. If the guard returns `require_approval`, this script blocks unless a later phase adds explicit approval handling.

## Default NVIDIA /chat protection

The script uses only explicit MiMo discovery calls. It does not call the normal `/chat` default lane and does not change `AI_GATEWAY_DEFAULT_PROVIDER`.

MiMo remains configured but not default. Normal `/chat` remains protected by the NVIDIA default lane.

## Safety boundaries

- no MiMo default provider switch
- no default NVIDIA `/chat` lane change
- no project long context sent to MiMo
- no large output request
- no pressure test
- no multi-round chat
- no automatic fallback to MiMo
- no plaintext API key in docs, evidence, logs, or UI
- no Authorization header value in docs, evidence, logs, or UI
- no full environment print
- no Codex CLI
- no real Codex exec
- no workflow runner
- no worktree creation
- no auto commit/push/PR/release
- no production-ready claim

## Evidence files

Evidence is written to:

- `apps/ai-gateway-service/evidence/phase-271a-mimo-model-id-discovery.json`
- `apps/ai-gateway-service/evidence/phase-271a-mimo-model-id-discovery.md`

If 271A discovers a working model id and the repaired 269A smoke passes, Phase 269A evidence may also be refreshed by:

- `apps/ai-gateway-service/evidence/phase-269a-mimo-paid-api-safe-smoke.json`
- `apps/ai-gateway-service/evidence/phase-269a-mimo-paid-api-safe-smoke.md`

## Verification commands

```powershell
node --check apps/ai-gateway-service/src/entrypoints/discoverMimoModelId.js
node --check apps/ai-gateway-service/src/entrypoints/verifyMimoModelDiscoverySafeSmoke.js
cmd /c pnpm run discover:mimo-model-id
cmd /c pnpm run verify:phase271a-mimo-model-id-discovery
```

If discovery succeeds, rerun:

```powershell
cmd /c pnpm run smoke:mimo-paid-route
cmd /c pnpm run verify:phase269a-mimo-paid-api-safe-smoke
```

## Failure modes

The blocker type is one of:

- `model_id_not_supported`
- `base_url_invalid`
- `auth_failed`
- `quota_or_billing`
- `protocol_incompatible`
- `network_timeout`
- `unknown`

If discovery fails, Phase 269A must remain failed and the next step is to get the exact model id from the Xiaomi MiMo console, model list, or official API documentation.

## Next phase options

- Add a manual provider status panel that shows discovered model ids without exposing secrets.
- Persist the discovered working model id as a safe model preference after explicit user approval.
- Run at most three tiny MiMo usage calibration prompts after model id is confirmed.
- Add Token Cost Guard provider-specific price policy.
- Keep production routing and default provider switching for a separate approved phase.
