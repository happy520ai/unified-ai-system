# Phase1953P Provider Call Boundary

Required boundary:

- Provider: `nvidia`
- Model: `nvidia/llama-3.3-nemotron-super-49b-v1`
- Credential reference: `credentialRef:nvidia:default`
- Maximum requests: `1`
- Retry attempts: `0`
- Raw secret read: forbidden
- `auth.json` read: forbidden
- `.env` read: forbidden
- Authorization header logging: forbidden
- `/chat` and `/chat-gateway/execute` modifications: forbidden
- deploy, release, tag, artifact upload, commit, and push: forbidden

If the safe internal Provider executor is not implemented, the one-shot attempt remains blocked with `requestAttemptCount=0`.
