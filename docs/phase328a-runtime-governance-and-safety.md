# Phase328A Runtime Governance And Safety

## Real-call policy

### Allowed

- selectable NVIDIA models
- smoke-passed evidence-backed chat-capable models
- Three Mode requests without secret payload values

### Blocked

- failed models
- high-risk models
- not-eligible models
- unverified models
- non-NVIDIA real call without secure user credential runtime
- payloads containing `secretValue`, `apiKey`, or token-like fields

## User-owned provider posture

Phase327B/C completed schema and dry-run design, but secure secret resolution runtime is still not implemented.

Therefore Phase328A returns:

- `USER_CREDENTIAL_MISSING`
- `USER_CREDENTIAL_RUNTIME_NOT_READY`

for non-NVIDIA real-call paths instead of attempting provider execution.

## Audit requirements

- `providerCallsMade`
- `nonNvidiaProviderCallsMade`
- `secretValueExposed`
- `fallbackUsed`
- selected participants or selected model

## Non-claims

- not production multi-provider runtime
- not user secret vault completion
- not automatic paid-provider enablement
