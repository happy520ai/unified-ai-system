# Phase1932P-Runtime CredentialRef-Only Provider Runtime Adapter

This phase adds a credentialRef-only adapter contract for the future Phase1932P guarded NVIDIA stability test.

The adapter accepts `providerId`, `modelId`, `credentialRef`, `prompt`, `expectedResponseContains`, `timeoutMs`, and `dryRun`. It does not read `.env`, `auth.json`, raw API keys, raw CredentialRef values, or Authorization headers.

This phase does not execute a real Provider call. If no complete safe runtime core is injected, the adapter returns `provider_runtime_core_missing`.
