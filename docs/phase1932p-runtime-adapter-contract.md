# Phase1932P Runtime Adapter Contract

The runtime adapter boundary is credentialRef-only:

- Accepts `credentialRef:nvidia:default` as a reference string.
- Rejects raw-key-shaped credential input.
- Produces sanitized response previews capped at 300 characters.
- Does not log headers, env, raw keys, or credential values.
- Does not modify `/chat-gateway/execute`, default Provider configuration, `legacy/`, or `PROJECT_CONTEXT.md`.

Dry-run mode validates the contract and reports whether a safe runtime core exists. Non-dry-run mode may only call a repo-provided safe runtime function injected into the adapter.
