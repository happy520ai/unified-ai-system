# Phase1955P Provider Call Boundary

The Phase1955P call boundary is intentionally narrow.

Allowed:

- Read the owner approval input file.
- Validate provider, model, budget, timeout, max request count, and safety flags.
- Invoke `safeInternalProviderExecutor` with `allowProviderCall=true` and `dryRun=false`.
- Use the injected NVIDIA adapter for a single guarded call.
- Store sanitized metadata and a short sanitized response preview.

Blocked:

- Calling any provider other than NVIDIA.
- Calling more than one request.
- Retrying after failure.
- Reading `.env` or `auth.json`.
- Printing API keys or request headers.
- Changing `/chat` or `/chat-gateway/execute`.
- Deploy, release, tag, artifact upload, commit, or push.

Provider stability remains unverified after this phase even if the one-shot passes.
