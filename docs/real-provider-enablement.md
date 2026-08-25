# Real Provider Enablement Runbook

The gateway is fake-provider-first: it starts with deterministic local
providers and makes no external request. Turning on a real provider is an
explicit, scoped, reversible operator decision. This runbook is the only
supported enablement procedure.

## Authorization boundary

- Real provider calls are **off by default**
  (`AI_GATEWAY_REAL_PROVIDER_ENABLED=false`).
- Credentials never live in version control. They enter through environment
  variables or the runtime credential store, which keeps keys out of logs,
  responses, and descriptions.
- Enabling a real provider never changes the fake boundary guarantees listed
  in [What never changes](#what-never-changes).

## Whitelist matrix

Real reachability is the intersection of three explicit gates. A provider is
only selectable when all three line up:

| Gate | Mechanism | Example |
| --- | --- | --- |
| 1. Global real-mode switch | `AI_GATEWAY_REAL_PROVIDER_ENABLED=true` + `AI_GATEWAY_PROVIDER_MODE=real` (or `auto`) | `auto` keeps fake fallback when the credential is absent; `real` fails closed with `OPENAI_API_KEY_MISSING`. |
| 2. Provider whitelist | `AI_GATEWAY_ENABLED_PROVIDERS=openai,nvidia` (comma-separated; only listed providers are registered as selectable) | Omitting a provider removes it from routing entirely. |
| 3. Per-provider credential | `OPENAI_API_KEY` (+ optional `OPENAI_MODEL`, `OPENAI_BASE_URL`), `NVIDIA_API_KEY`, ... — or the runtime credential store below | A whitelisted provider without a credential stays blocked. |

Pin the default lane with `AI_GATEWAY_DEFAULT_PROVIDER` and
`AI_GATEWAY_DEFAULT_MODEL` so routing cannot drift to an unpinned model.

Recommended minimal first enablement (single cheap model, smallest blast
radius):

```bash
AI_GATEWAY_PROVIDER_MODE=real \
AI_GATEWAY_REAL_PROVIDER_ENABLED=true \
AI_GATEWAY_ENABLED_PROVIDERS=openai \
AI_GATEWAY_DEFAULT_PROVIDER=openai \
AI_GATEWAY_DEFAULT_MODEL=gpt-4o-mini \
OPENAI_API_KEY=<key> \
pnpm gateway serve
```

## Provisioning a credential

Two supported paths; pick one per deployment.

1. **Environment (12-factor, containers, CI)** — set `OPENAI_API_KEY` (or the
   provider equivalent) in the process environment or a local `.env` that is
   never committed.
2. **Runtime credential store (long-running gateway, no restart)** —

   ```bash
   curl -X POST http://127.0.0.1:3100/providers/runtime-credential \
     -H "content-type: application/json" \
     -H "x-pme-auth-token: <operator token>" \
     -H "x-pme-tenant-id: <tenant>" \
     -d '{"providerId":"openai","apiKey":"<key>"}'
   ```

   The store persists to a `0600` local file by default
   (`PME_RUNTIME_CREDENTIAL_STORE_MODE` = `local-file`), keeps everything in
   memory (`memory`), or shares across processes via SQLite (`sqlite`).
   `POST /providers/runtime-credential/detect` reports which providers have a
   usable credential without exposing values.

   **Storage semantics (honest boundary):** provider runtime credentials are
   persisted **in cleartext** inside that permission-restricted file — the
   gateway must be able to present the key to the provider, so it cannot be
   hashed. Only *virtual keys* (`uai-`) and *user tokens* are stored as
   SHA-256 hashes. The `0600` mode applies on POSIX; on Windows the file ACL
   is restricted to the current user on best effort. For stricter at-rest
   protection use the environment path with your platform's secret manager,
   or `PME_RUNTIME_CREDENTIAL_STORE_MODE=memory`.

Rollback for path 2 is store eviction plus restart; for path 1, unset the
variable and restart.

## Verification

1. `GET /health/check` — gateway ready.
2. `GET /provider-config/status` — confirm the intended provider is enabled
   and credentialed.
3. Local smoke, no side effects when the key is absent:

   ```bash
   AI_GATEWAY_SMOKE_MODE=real-with-key \
   OPENAI_API_KEY=<key> \
   PME_AUTH_TOKEN=<any-local-secret> \
   pnpm --filter @unified-ai-system/ai-gateway-service smoke:openai-route
   ```

   Real provider modes require enterprise authentication even on loopback —
   `PME_AUTH_TOKEN` bootstraps a local admin identity for the smoke. The
   report is JSON; a missing key produces an explicit `skipped` entry, never a
   false pass. The CI wrapper (`node tools/real-provider-smoke.mjs`)
   provisions its own per-run token, pins the OpenAI lane, enforces a
   timeout, and treats a fake-lane fallback as a failure.
4. CI smoke (manual, credential-gated): the **Real Provider Smoke** workflow
   runs the same check with `secrets.OPENAI_API_KEY` and skips cleanly when
   the secret is not configured. One provider call per invocation, no
   retries. Configure the model with the
   `REAL_PROVIDER_SMOKE_OPENAI_MODEL` repository variable (default
   `gpt-4o-mini`).

## Cost control

- Pin one cheap model first (`gpt-4o-mini` class); widen only after
  `GET /cost/summary` and the token ledger look healthy.
- `POST /cost/guard/check` and the request-path token cost guard remain active
  in real mode and hard-block over-budget requests.
- The CI smoke is `workflow_dispatch`-only on purpose: no automatic spend.

## What never changes when real mode is on

- The MCP surface (`gateway_chat`) keeps refusing gateways that may call a
  real provider — the managed MCP preview stays fake-only.
- Chat results still carry `executionMode`, and `real` responses are asserted
  as rigorously as fake ones; a response that cannot prove its mode fails the
  envelope contract.
- Unauthenticated access stays loopback-only with the same route/permission
  policy; non-loopback binds still require enterprise authentication.
- Audit logging, rate limiting, tenant scoping, and the outbound request
  policy apply unchanged to real traffic.

## Rollback

1. Set `AI_GATEWAY_REAL_PROVIDER_ENABLED=false` (or remove the env), restart —
   back to deterministic fake mode.
2. Evict runtime-store credentials and confirm via
   `POST /providers/runtime-credential/detect` that nothing is credentialed.
3. `AI_GATEWAY_PROVIDER_MODE=auto` deployments fall back to fake automatically
   when a credential disappears; `real` mode fails closed instead — choose
   per deployment posture.
