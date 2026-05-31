# Phase325C Provider Config Governance Design

## Current Runtime Boundary

The current runtime boundary remains NVIDIA-only. NVIDIA is the only provider allowed for real calls in the current gateway path.

OpenAI, Claude, OpenRouter, MiMo, and local providers remain future-provider-slot or design_only entries. They must not route real calls, read credentials, or appear as enabled runtime providers in this phase.

## Governance Goal

Phase325C defines how provider configuration should be governed before future runtime work starts. It does not implement provider configuration runtime behavior.

The governance goals are:

- keep provider enablement explicit and reversible
- prevent future-provider-slot entries from becoming real providers by accident
- keep credential references separate from secret values
- require budget, audit, timeout, route, and rollout evidence before real calls
- preserve the existing Chat Gateway and Workbench runtime boundary

## Future Provider Slot

A future-provider-slot is a documented provider position that may have schema examples, policy notes, and validation examples. It is not an available runtime provider.

Future-provider-slot entries must use:

- `enabled: false`
- `realCallsAllowed: false`
- `status: "future_provider_slot"` or `status: "design_only"`
- no route eligibility
- no live credential read
- kill switch enabled or route denied

## Provider Enablement Gate

A provider can only move toward real calls when all gates are satisfied:

- schema exists and validates
- provider status is not future-provider-slot
- explicit operator approval is recorded
- credentialRef points to a runtime secret reference, not a secret value
- budget policy is configured
- timeout policy is configured
- audit policy is enabled
- route policy explicitly allows the provider
- smoke evidence exists for the provider and model
- rollout stage permits real calls
- kill switch is not engaged

Non-NVIDIA providers must stay blocked until a later phase explicitly authorizes their real-call lane.

## Credential Reference Policy

Provider config may only store secret references. It must not store API keys, bearer tokens, raw credentials, or example secret values.

Allowed credential fields:

- `credentialRef.envName`
- `credentialRef.secretStoreKey`
- `credentialRef.redactionRequired`

Forbidden credential fields:

- `apiKey`
- `token`
- `secret`
- `authorization`
- any plaintext key material

Documentation examples may name environment variables such as `NVIDIA_API_KEY` or `OPENAI_API_KEY`, but must not include values.

## Secret Reference Rule

The config layer can validate that a reference is present and well-formed. It must not read the secret value during design-only or future-provider-slot stages.

All UI, docs, evidence, and audit output must redact credential-related fields when there is any risk of exposing source details.

## Non-NVIDIA Paid API Prohibition

Phase325C does not permit OpenAI, Claude, OpenRouter, or MiMo real calls. The config governance design must make accidental paid fallback impossible.

Rules:

- no paid fallback unless explicitly approved in a later phase
- no automatic provider failover to a paid provider
- no design example may set non-NVIDIA `realCallsAllowed` to true
- no future-provider-slot can be route eligible

## Provider Status Taxonomy

- `current_runtime_enabled`: current verified runtime provider, currently NVIDIA only
- `future_provider_slot`: documented provider placeholder, no real calls
- `design_only`: schema and policy design only
- `shadow_config`: non-routing config prepared for validation
- `internal_dry_run`: simulation without provider calls
- `guarded_enablement`: approved narrow real-call rollout
- `disabled`: provider is off
- `rollback_required`: provider must be disabled or removed from route eligibility

## Config Ownership

Provider config should be owned by gateway operations, reviewed by security, and consumed by routing only after an explicit rollout phase.

Ownership records should include:

- owner
- reviewer
- approval record
- rollout stage
- related evidence id
- rollback owner

## Audit Trail Requirements

Every provider status change should produce audit metadata:

- previous status
- new status
- actor or operator record
- approval reference
- reason
- affected route set
- affected model set
- rollback instruction
- redaction confirmation

Audit records must not contain secret values.

## Rollback Design

Rollback must be narrow:

- disable provider
- engage kill switch
- deny route eligibility
- remove selectable model references if needed
- preserve evidence and audit records
- revert config document entries without git reset or git clean as the default path

## Workbench And Chat Gateway Boundary

Phase325C does not modify Workbench UI switches, Chat Gateway main chain, provider clients, route registry, or selectable gate logic.

Workbench may later display governance state, but future-provider-slot must be shown as unavailable for real calls until a later authorized phase.

