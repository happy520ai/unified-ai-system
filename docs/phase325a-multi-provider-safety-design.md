# Phase325A Multi-Provider Safety Design

## 1. Scope

Current active real provider:

- NVIDIA

Future-provider-slot only:

- OpenAI
- Claude
- OpenRouter
- MiMo
- local

Phase325A is design only. It does not implement provider clients, runtime routing changes, UI enablement, or key configuration.

## 2. Explicit Non-Execution Statement

Phase325A made none of the following calls:

- No OpenAI call.
- No Claude call.
- No OpenRouter call.
- No MiMo call.
- No local model execution.

This phase must not be described as multi-provider enabled.

## 3. Provider Registry Design

Future provider expansion should be controlled by a registry layer with these properties:

- A stable provider id per provider.
- A provider status field: `future-provider-slot`, `disabled`, `dry-run-only`, `real-smoke-allowed`, `production-open`.
- A provider capability summary separate from model-level capability.
- A route allowlist per provider.
- A per-provider kill switch.
- A per-provider rollout stage field backed by evidence.
- A per-provider audit policy field.

The registry must not implicitly enable a provider because client code exists. Provider status must remain explicit and evidence-backed.

## 4. Credential Safety

Credential design boundaries:

- Do not read `.env` plaintext in planning or design phases.
- Do not print raw keys in logs, docs, UI, or evidence.
- Key validation belongs to a later authorized phase.
- The runtime should expose only presence, source, and validation result, never the key body.
- Errors must be redacted before logging or evidence write.
- A runtime credential store boundary should isolate provider credentials from public UI surfaces.

Recommended future credential fields:

- `configured: boolean`
- `source: environment | runtime-store | none`
- `validated: boolean | unknown`
- `validatedAt: timestamp | null`
- `lastValidationCode: string | null`
- `lastValidationMessageRedacted: string | null`

## 5. Routing Safety

Routing must stay deny-by-default for non-NVIDIA providers.

Required controls:

- Provider allowlist at route entry.
- Per-provider enable flag.
- Per-provider real-run flag separate from dry-run flag.
- Kill switch that can block one provider without changing default `/chat`.
- No fallback to paid provider unless explicitly enabled by the user and phase gate.
- Route decision must record provider name, route reason, safety decision, and whether any real provider call happened.

Recommended route state machine:

1. Requested provider absent or future slot: reject with `provider_not_open`.
2. Provider disabled: reject with `provider_disabled`.
3. Provider dry-run only: simulate selection and return `provider_dry_run_only`.
4. Provider real-run allowed but no user authorization: reject with `real_call_not_authorized`.
5. Provider real-run allowed and explicitly authorized: continue to the provider adapter.

## 6. Cost And Quota Safety

Each provider must have its own spend and quota guardrails.

Required future controls:

- Budget cap per provider.
- Daily request limit per provider.
- Per-model timeout.
- Max token ceiling by route type.
- Retry cap with no unbounded retry loop.
- Audit event on every real provider call.
- Rate-limit stop condition that prevents cascading retries.

Recommended policy examples:

- `realCallDailyLimit`
- `maxTokensPerRequest`
- `requestTimeoutMs`
- `maxRetries`
- `cooldownAfterRateLimitMs`
- `budgetState: open | warning | hard-stop`

## 7. UI Safety

UI must not mislead users into believing a provider is open when it is still a design slot.

Required UI rules:

- Future providers show `future-provider-slot` or a clear Chinese equivalent.
- No real enable button for unopened providers.
- No test button that triggers a real API call before the real-call phase is authorized.
- No key input UI is considered active until the config-schema phase and later security review.
- User-visible text must state whether a provider is only planned, dry-run only, or real-call enabled.

## 8. Audit And Evidence

Every real multi-provider phase must add provider-specific evidence and audit records.

Required future evidence fields:

- providerId
- routeDecision
- safetyDecision
- providerCalled
- realCallAuthorized
- credentialSource
- budgetPolicySnapshot
- timeoutPolicySnapshot
- resultStatus
- redactedError
- evidenceId

Design-only phases like Phase325A should produce documents only, not operational audit entries.

## 9. Rollout Gates

Recommended rollout sequence:

- Phase325B: config schema design only.
- Phase325C: provider adapter contract tests without real provider calls.
- Phase325D: dry-run routing simulation without real provider calls.
- Phase325E: one-provider real smoke, only after explicit user authorization.
- Later provider-by-provider expansion, one provider at a time, each with evidence, rollback, and verifier coverage.

No phase may open multiple new paid providers at once.

## 10. Backout Plan

Every provider rollout must have a narrow rollback path:

- Disable the provider with a kill switch.
- Revert provider status from `real-smoke-allowed` or `production-open` to `disabled`.
- Keep audit and smoke evidence for traceability.
- Roll back config values in targeted files only.
- Re-run secret safety, route safety, and provider-specific verifier chains.

Do not use `git reset` or `git clean` as the default backout method.

## 11. Hard Boundaries For Later Phases

These remain blocked until later explicit authorization:

- Creating provider keys.
- Reading real `.env` plaintext.
- Modifying provider clients.
- Modifying `/chat-gateway/execute`.
- Opening UI toggles that trigger real calls.
- Automatic fallback from NVIDIA to a paid provider.
- Batch paid-provider smoke without explicit approval.

## 12. Commercialization Notes

For a sellable AI Gateway product, multi-provider support must be auditable, comprehensible, and cost-bounded. A provider appearing in the UI is not enough. Each provider must have:

- an explicit rollout state,
- a clear user-visible safety message,
- evidence-backed route behavior,
- cost control,
- rollback control,
- and a verifier chain that can prove whether real calls happened.

