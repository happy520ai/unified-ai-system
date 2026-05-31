# Phase1951P Provider Execution Boundary

The Phase1951P boundary allows only a scoped design-only authorization input:

- `providerId`: `nvidia`
- `modelId`: `nvidia/llama-3.3-nemotron-super-49b-v1`
- `credentialRef`: `credentialRef:nvidia:default`
- `maxRequests`: `0`
- `maxEstimatedCostUsd`: `0`
- `allowProviderCall`: `false`

## Required Safety Properties

- CredentialRef is required and raw secrets are rejected.
- Provider and model allowlists are required.
- Request budget and estimated cost limits are required.
- Explicit real Provider call authorization is required before any future execution.
- Phase1951P remains dry-run by default.

## Preserved Blocker

`provider_stability_not_verified` remains preserved. Phase1951P does not prove Provider stability and must not be used as evidence of a successful real Provider test.
