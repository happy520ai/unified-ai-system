# Phase676 CredentialRef-only Provider Runtime Gate

Phase676 verifies that a capability can enter guarded real Provider runtime v0.

The gate requires:
- a sandbox auto runtime admitted capability
- sandbox execution passed
- rollback available
- credentialRef-only approval packet
- providerId=nvidia
- modelId from verified selectable NVIDIA allowlist
- maxSpawnDepth=1

It blocks raw secrets, auth.json, raw base_url, non-NVIDIA providers, missing approval, missing rollback, deploy, chat mutation, execute mutation, and capability self-approval.
