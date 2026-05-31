# Phase675-682 Taiji / Beidou Guarded Real Provider Runtime v0

This bundle adds an approval-gated real Provider runtime path for capability neurons.

It does not enable production runtime, main-chain runtime, `/chat`, or `/chat-gateway/execute`. It does not read raw secrets or auth.json.

Execution is possible only when a complete human approval file exists. Without that file, the bundle seals as gate-ready with `realProviderCallExecuted=false`.

Provider scope:
- NVIDIA only
- credentialRef only
- verified selectable model allowlist only
- one-shot by default
- maxRetries=0
- cost and quota ledger required
