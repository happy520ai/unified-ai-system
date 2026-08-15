# Provider Setup

The default configuration uses a local fake provider and makes no external
request. For the full operator procedure — whitelist matrix, credential
provisioning, verification, cost control, and rollback — see the
[real provider enablement runbook](real-provider-enablement.md).

## Enable A Provider

1. Copy `.env.example` to a local `.env`.
2. Add only the credential required by your provider.
3. Set `AI_GATEWAY_REAL_PROVIDER_ENABLED=true`.
4. Select the intended provider and model.
5. Start the gateway and verify `/health/check`.

Common configuration names include:

- `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`
- `NVIDIA_API_KEY`, `NVIDIA_MODEL`, `NVIDIA_BASE_URL`
- `AI_GATEWAY_ENABLED_PROVIDERS`
- `AI_GATEWAY_DEFAULT_PROVIDER`
- `AI_GATEWAY_DEFAULT_MODEL`

Never commit `.env` or credential values. Provider availability, model names,
pricing, and terms are controlled by each external provider and can change.

## Local-Only Mode

Leave `AI_GATEWAY_REAL_PROVIDER_ENABLED=false` to guarantee that the normal
gateway path does not call an external model provider.

Contributors adding a provider adapter should follow the
[provider adapter contribution guide](provider-adapter-contribution.md). It
covers the current contracts, catalog boundaries, credential-free tests, and
required public checks.
