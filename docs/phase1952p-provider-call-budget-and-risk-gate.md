# Phase1952P Provider Call Budget And Risk Gate

The Phase1952P gate prepares future one-shot authorization only.

Required gates:

- Provider allowlist: `nvidia`
- Model allowlist: `nvidia/llama-3.3-nemotron-super-49b-v1`
- CredentialRef allowlist: `credentialRef:nvidia:default`
- Max requests: exactly `1` for Phase1953P
- Max estimated cost: at most `0.01`
- Timeout: at most `30000`
- Raw secret read: forbidden
- `auth.json` read: forbidden
- env dump: forbidden
- `/chat-gateway/execute` modification: forbidden
- deploy/release/tag/artifact upload: forbidden

Phase1952P itself keeps `allowProviderCallForCurrentPhase=false` and does not make a network attempt.
