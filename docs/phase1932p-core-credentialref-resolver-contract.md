# Phase1932P-Core CredentialRef Resolver Contract

The resolver runtime contract is `credentialRef` only.

Required input:
- `providerId`
- `modelId`
- `credentialRef`
- `prompt`
- `expectedResponseContains`
- `timeoutMs <= 30000`

Allowed reference:
- `credentialRef:nvidia:default`

Allowed model:
- `nvidia/llama-3.3-nemotron-super-49b-v1`

The resolver may:
- Validate the credentialRef string.
- Confirm that the model is authorized for the reference.
- Return a sanitized request preview.
- Call a separately provided safe execution invoker.

The resolver must not:
- Read raw secret values.
- Open `.env`.
- Read `auth.json`.
- Dump `process.env`.
- Write or print request headers.
- Fetch Provider endpoints directly.
- Modify `/chat-gateway/execute`.
