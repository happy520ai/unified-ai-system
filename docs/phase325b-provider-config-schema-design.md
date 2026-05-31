# Phase325B Provider Config Schema Design

## 1. Goal

Define a provider configuration schema that is safe by default, explicit about rollout state, and unable to expose secrets through the schema itself.

This phase is design only.

## 2. Top-Level Shape

Recommended top-level fields:

- `providerId`
- `providerType`
- `enabled`
- `realCallsAllowed`
- `status`
- `credentialRef`
- `models`
- `routingPolicy`
- `budgetPolicy`
- `timeoutPolicy`
- `retryPolicy`
- `auditPolicy`
- `rolloutStage`
- `killSwitch`

## 3. Provider Status

Allowed status values:

- `active`
- `disabled`
- `future-provider-slot`
- `dry-run-only`
- `blocked`
- `manual-review-required`

Recommended meaning:

- `active`: provider is open for the allowed route set.
- `disabled`: provider is off.
- `future-provider-slot`: documented only, no real calls.
- `dry-run-only`: routing can be simulated but no provider call may happen.
- `blocked`: explicit safety stop.
- `manual-review-required`: human approval needed before progressing.

## 4. Credential Boundary

The schema must not store secrets.

Required rules:

- `credentialRef` may point to a runtime secret object, but must not contain the secret itself.
- The schema must not contain `apiKey` or any equivalent plaintext field.
- Docs must not show real key examples.
- Display logic must redact any credential reference that could reveal a secret source.
- Real secret reads are reserved for later runtime phases with explicit authorization.

## 5. Real Call Gates

Before any real provider call, all of these must be true:

- provider is `enabled`
- `realCallsAllowed=true`
- `budgetPolicy` is configured
- `timeoutPolicy` is configured
- `auditPolicy` is configured and enabled
- user explicit authorization is recorded
- smoke evidence exists for the provider or the model
- `rolloutStage` is approved for real calls
- `killSwitch` is not engaged

## 6. Provider Instances

Current and future provider positions:

- NVIDIA: current active provider
- OpenAI: future-provider-slot
- Claude: future-provider-slot
- OpenRouter: future-provider-slot
- MiMo: future-provider-slot
- local: future-provider-slot

Future-provider-slot providers must stay non-real until a later explicit phase opens them.

## 7. Rollout Stages

Recommended rollout stages:

- `schema-only`
- `config-dry-run`
- `adapter-contract-test`
- `routing-simulation`
- `single-provider-real-smoke`
- `limited-selectable-review`
- `guarded-rollout`
- `rollback-ready`

The rollout stage should describe maturity, not marketing intent.

## 8. Policies

### RoutingPolicy

Should describe:

- route allowlist
- default route
- fallback policy
- provider selection reason
- deny rules

### BudgetPolicy

Should describe:

- request budget
- daily spend ceiling
- request count ceiling
- max token ceiling
- rate limit stop conditions

### TimeoutPolicy

Should describe:

- per-request timeout
- provider-specific timeout
- retry cooldown

### RetryPolicy

Should describe:

- max retries
- retry backoff
- stop on rate limit
- stop on schema failure

### AuditPolicy

Should describe:

- audit sink enabled
- redaction rules
- evidence retention window
- operator-visible fields

### KillSwitch

Should describe:

- provider-level off switch
- route-level deny switch
- emergency override state

## 9. Backout Plan

Backout must be narrow and reversible:

- disable the provider
- engage kill switch
- revert config entries
- deny route
- preserve audit evidence
- remove only the narrow selectable subset if needed later

Do not use destructive git operations as the default rollback method.

## 10. No-Implementation Boundary

This phase must not:

- modify provider code
- modify runtime config
- read `.env`
- create real provider configs
- call OpenAI
- call Claude
- call OpenRouter
- call MiMo
- enable local model execution
- modify UI enable switches
- modify routing code

