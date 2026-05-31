# Phase326B Error And Fallback Contract

## Common Error Taxonomy

- `MODE_NOT_SUPPORTED`
- `MODEL_NOT_CONFIGURED`
- `USER_CREDENTIAL_MISSING`
- `PROVIDER_NOT_ENABLED`
- `PROVIDER_GOVERNANCE_REJECTED`
- `SECRET_VALUE_FORBIDDEN`
- `NO_ELIGIBLE_MODEL`
- `RUNTIME_STAGE_NOT_ENABLED`
- `NON_NVIDIA_REAL_CALL_FORBIDDEN`

## Mode-Specific Error Taxonomy

### Normal Mode

- `MODEL_NOT_CONFIGURED`
- `USER_CREDENTIAL_MISSING`
- `NO_ELIGIBLE_MODEL`

### God Mode

- `GOD_MODE_INSUFFICIENT_PARTICIPANTS`
- `SUPERVISOR_CONFLICT_UNRESOLVED`
- `PROVIDER_GOVERNANCE_REJECTED`

### Tianshu Mode

- `PLANNER_NO_DECISION`
- `NO_ELIGIBLE_MODEL`
- `RUNTIME_STAGE_NOT_ENABLED`

## Fallback Rules

- fallback must be explicit, never silent
- fallback must remain inside user-authorized providers and models
- fallback must not jump to an unconfigured provider
- fallback must not use plaintext secrets
- fallback must not trigger non-NVIDIA paid calls in current design-only phases

## Governance Rejection Rules

Reject when:

- provider is not user-authorized
- model is not allowed by Model Library
- governance marks provider or model as blocked
- runtime stage is not enabled
- secret value appears in payload or config

## Credential Missing Rules

- if required credentialRef is missing, reject with `USER_CREDENTIAL_MISSING`
- do not attempt provider fallback outside approved model set
- do not infer a platform-supplied key

## Provider Unavailable Rules

- if provider is disabled or unavailable, return `PROVIDER_NOT_ENABLED` or `NO_ELIGIBLE_MODEL`
- do not switch to a paid provider unless explicit policy allows it in a future phase

## No Configured Model Rules

- if no user-configured model satisfies the request, return `NO_ELIGIBLE_MODEL`
- do not fabricate participant models or planner candidates

## Planner Cannot Decide Rules

- Tianshu Mode returns `PLANNER_NO_DECISION`
- response should include task type, failed criteria, and rejection rationale

## Supervisor Conflict Unresolved Rules

- God Mode may return `SUPERVISOR_CONFLICT_UNRESOLVED`
- final response must preserve disagreement and uncertainty
- supervisor must not hide unresolved conflict behind fake certainty

