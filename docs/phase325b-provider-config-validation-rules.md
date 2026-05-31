# Phase325B Provider Config Validation Rules

## 1. Required Rules

- `providerId` must be present.
- `providerType` must be present.
- `enabled` must be boolean.
- `realCallsAllowed` must be boolean.
- `status` must be one of the approved status values.
- `credentialRef` must be present as a reference object, not a secret blob.
- `models` must be present.
- `routingPolicy` must be present.
- `budgetPolicy` must be present.
- `timeoutPolicy` must be present.
- `retryPolicy` must be present.
- `auditPolicy` must be present.
- `rolloutStage` must be present.
- `killSwitch` must be present.

## 2. Secret Safety Rules

- Schema must not contain `apiKey`.
- Schema must not contain plaintext token fields.
- Schema must not include `.env` content.
- Docs must not show real keys.
- Rendering must redact `credentialRef`.

## 3. Real Call Gate Rules

A real provider call is blocked unless all of these are true:

- `enabled=true`
- `realCallsAllowed=true`
- `status=active` or another explicitly approved non-future status
- `credentialRef` is valid and present
- `budgetPolicy` is configured
- `timeoutPolicy` is configured
- `auditPolicy.enabled=true`
- `rolloutStage` is approved for real smoke or rollout
- user explicit authorization exists
- `killSwitch.enabled=false`

## 4. Future-Provider-Slot Rules

- `status=future-provider-slot` must default to `realCallsAllowed=false`.
- `status=future-provider-slot` must not route real calls.
- `status=future-provider-slot` may only be documented or simulated.
- `status=future-provider-slot` must not expose a real enable button before later phases.

## 5. Budget Rules

- Paid providers must have an explicit budget policy.
- Missing budget policy blocks real calls.
- Budget policy must define at least a request limit or spend ceiling.
- Budget policy must support stop conditions.

## 6. Audit Rules

- Every real call requires audit policy enabled.
- Audit policy must redact secrets.
- Audit policy must preserve provider id, route decision, and result status.
- Audit policy must never log raw credentials.

## 7. Kill Switch Rules

- Every provider must have a kill switch.
- Kill switch must be able to deny routes without code changes.
- Kill switch must override rollout stage.

## 8. Fallback Rules

- No fallback to a paid provider unless explicitly enabled.
- No silent fallback from NVIDIA to OpenAI, Claude, OpenRouter, MiMo, or local.
- Any fallback must be recorded in route decision evidence.

## 9. Backout Rules

- Disable provider.
- Engage kill switch.
- Revert schema config only.
- Deny route.
- Preserve audit evidence.
- Use targeted rollback, not destructive git commands.

