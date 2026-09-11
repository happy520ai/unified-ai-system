# B.AI Provider

B.AI is registered as the independent gateway provider `bai`. Its upstream
base URL is pinned to the official public endpoint:

```text
https://api.b.ai/v1
```

The provider is disabled by default. The credential-free gateway continues to
use the local fake provider until an operator deliberately enables `bai`.

## Protocol Boundary

The B.AI service currently advertises model listing plus three generation
protocols:

- `GET /models`
- OpenAI Chat Completions
- OpenAI Responses
- Anthropic Messages

The gateway's current outbound `bai` implementation deliberately reuses the
existing OpenAI-compatible Chat Completions adapter. Gateway clients can still
use the gateway's `/v1/chat/completions`, `/v1/responses`, and `/v1/messages`
surfaces; those inbound requests are normalized through `GatewayService`.
This is not a claim that the gateway directly passes through B.AI's upstream
Responses or Messages endpoints.

In real mode, clients for every inbound protocol must also send the gateway's
enterprise authentication header. In particular, an Anthropic client that
sends only its normal `x-api-key` header is not authenticated to this gateway;
configure `Authorization: Bearer <gateway-token>` as a default header.

The adapter appends `/chat/completions` to the pinned base URL. Do not configure
or store a URL that already ends in `/chat/completions`.
The B.AI adapter is configured for one Provider attempt per gateway operation;
clients must not turn an uncertain result into a new operation with a new
idempotency key.

## Model And Promotion Boundary

The initial catalog seeds six observed, unverified model candidates:

- `deepseek-v4-flash`
- `deepseek-v4-flash-vision-exp`
- `hy3`
- `mimo-v2.5`
- `glm-5.3-flash`
- `qwen3.8-flash`

They are not all routable by default, and the catalog does not label any model
as permanently free. An operator must explicitly select one with `BAI_MODEL`,
or add an account-returned model through the authenticated runtime credential
flow, before the first governed chat verification.

Before pinning a deployment, use the authenticated B.AI `GET /models` result
for that account and intersect it with the gateway operator's allowlist and the
current [B.AI promotions page](https://docs.b.ai/llmservice/promotions-and-pricing-notices/).
Model-list membership does not prove Chat Completions execution, price, or
entitlement. The examples use `qwen3.8-flash` only as a selected candidate;
replace it with an account-returned, operator-approved ID when necessary.

## Enablement

Real reachability is the intersection of three explicit gates:

1. Real-provider execution is globally enabled:
   `AI_GATEWAY_PROVIDER_MODE=real` (or `auto`) and
   `AI_GATEWAY_REAL_PROVIDER_ENABLED=true`.
2. The provider is explicitly allowed:
   `AI_GATEWAY_ENABLED_PROVIDERS=bai`.
3. A B.AI credential is present through `BAI_API_KEY` or the runtime credential
   store.

For an isolated B.AI-only deployment, pin the route and model as well:

```text
AI_GATEWAY_PROVIDER_MODE=real
AI_GATEWAY_REAL_PROVIDER_ENABLED=true
AI_GATEWAY_ENABLED_PROVIDERS=bai
AI_GATEWAY_ROUTE_MODE=fixed
AI_GATEWAY_FALLBACK_ENABLED=false
AI_GATEWAY_DEFAULT_PROVIDER=bai
AI_GATEWAY_DEFAULT_MODEL=qwen3.8-flash
BAI_MODEL=qwen3.8-flash
BAI_API_KEY=<provided-by-the-deployment-secret-store>
```

For an existing multi-Provider deployment, preserve the current allowlist,
default route, and fallback policy: append `bai` instead of replacing the
existing Provider IDs, then pin `unified_ai.provider_id` and `model` on each
B.AI request. Do not silently make B.AI the global default merely to add it as
an available Provider.

`BAI_API_KEY` is an upstream Provider credential. Prefer the authenticated
runtime credential store or an isolated deployment secret manager. A process
environment variable is supported, but this gateway still has tool subprocess
paths that can inherit process environment; use it only with a dedicated
service account and a deliberately restricted child environment. Never commit
the key, paste it into a fixture, put it in a client application, or include it
in logs, screenshots, evidence, chat, tickets, or documentation. Revoke and
replace any key that has been pasted into one of those surfaces.

Real mode also requires the durable usage, audit, authentication, and provider
dispatch controls described in the
[real-provider enablement runbook](real-provider-enablement.md). Every real
request needs a fresh caller-stable `Idempotency-Key` or
`Provider-Dispatch-Key`; see
[real-provider dispatch idempotency](provider-dispatch-idempotency.md).

## Runtime Credential Store

The first deployment of this code, or any change to
`AI_GATEWAY_ENABLED_PROVIDERS`, requires a gateway restart. Runtime credential
updates are restart-free only after the running process has loaded the `bai`
registration and was started with `bai` in its execution allowlist. An already
running older process does not hot-load a new Provider registration.

For a long-running gateway, an authorized operator can provision `bai` through
`POST /providers/runtime-credential` without placing the credential in source
configuration. The administrative request accepts this shape:

```json
{
  "providerId": "bai",
  "apiKey": "<secret-manager-injected-value>",
  "modelId": "qwen3.8-flash"
}
```

Do not save a filled copy of this payload. Submit it only over the authenticated
operator route, using the storage mode and encryption procedure in
[Runtime credential encryption](runtime-credential-encryption.md). The fixed
B.AI endpoint comes from the registered provider configuration; callers should
not supply an alternate endpoint.

The legacy `/provider-config/save` and `/model-library/test-model` paths are
NVIDIA/OpenRouter-oriented and are not B.AI verification paths. Use the runtime
credential route followed by a bounded, governed compatibility request.

## Call The Gateway

The following examples call the local gateway, not `api.b.ai`. They use a
gateway-issued enterprise or virtual key through `GATEWAY_API_KEY`; they never
send `BAI_API_KEY` from the client.

Each request explicitly pins `unified_ai.provider_id` and the model ID. In the
OpenAI-compatible request schema, the model ID belongs in the top-level `model`
field; `unified_ai.model_id` is not a supported field.

First confirm that the selected model is visible through the gateway:

```bash
curl --fail-with-body http://127.0.0.1:3100/v1/models \
  -H "Authorization: Bearer ${GATEWAY_API_KEY}"
```

This endpoint reads the gateway's local Provider descriptors. It does not call
B.AI and does not prove current account permission, promotion eligibility, or
chat execution. Use an explicit B.AI model-list probe for current account
membership, then verify one selected model through the governed gateway route.

### curl

Generate a new opaque idempotency value for every intended operation. Reuse the
same value only when retrying the exact same route and payload.

```bash
request_id="$(uuidgen)"
curl --fail-with-body http://127.0.0.1:3100/v1/chat/completions \
  -H "Authorization: Bearer ${GATEWAY_API_KEY}" \
  -H "Idempotency-Key: ${request_id}" \
  -H "Content-Type: application/json" \
  --data '{
    "model": "qwen3.8-flash",
    "messages": [{"role": "user", "content": "Hello through the gateway"}],
    "stream": false,
    "unified_ai": {"provider_id": "bai"}
  }'
```

On Windows PowerShell:

```powershell
$requestId = [guid]::NewGuid().ToString()
$body = @{
  model = "qwen3.8-flash"
  messages = @(@{ role = "user"; content = "Hello through the gateway" })
  stream = $false
  unified_ai = @{ provider_id = "bai" }
} | ConvertTo-Json -Depth 6 -Compress

curl.exe --fail-with-body http://127.0.0.1:3100/v1/chat/completions `
  -H "Authorization: Bearer $env:GATEWAY_API_KEY" `
  -H "Idempotency-Key: $requestId" `
  -H "Content-Type: application/json" `
  --data-binary $body
```

### Python

```python
import os
import uuid

import requests

gateway_key = os.environ["GATEWAY_API_KEY"]
model_id = os.getenv("BAI_MODEL_ID", "qwen3.8-flash")

response = requests.post(
    "http://127.0.0.1:3100/v1/chat/completions",
    headers={
        "Authorization": f"Bearer {gateway_key}",
        "Content-Type": "application/json",
        "Idempotency-Key": str(uuid.uuid4()),
    },
    json={
        "model": model_id,
        "messages": [
            {"role": "user", "content": "Hello through the gateway"}
        ],
        "stream": False,
        "unified_ai": {"provider_id": "bai"},
    },
    timeout=60,
)
response.raise_for_status()
print(response.json()["choices"][0]["message"]["content"])
```

### Node.js

```js
import { randomUUID } from "node:crypto";

const gatewayKey = process.env.GATEWAY_API_KEY;
if (!gatewayKey) throw new Error("GATEWAY_API_KEY is required");

const response = await fetch(
  "http://127.0.0.1:3100/v1/chat/completions",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${gatewayKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify({
      model: process.env.BAI_MODEL_ID || "qwen3.8-flash",
      messages: [
        { role: "user", content: "Hello through the gateway" },
      ],
      stream: false,
      unified_ai: { provider_id: "bai" },
    }),
    signal: AbortSignal.timeout(60_000),
  },
);

if (!response.ok) {
  throw new Error(`Gateway returned HTTP ${response.status}: ${await response.text()}`);
}
const completion = await response.json();
console.log(completion.choices[0].message.content);
```

Successful responses must identify `bai` as the selected provider and `real` as
the execution mode. A `200` response without that execution evidence is not
accepted as proof of B.AI execution.

## Verification Boundary

Credential-free unit, mock-transport, and public-clone checks prove catalog,
configuration, protocol, cleanup, and fake-default behavior. They do not prove
that a particular B.AI account can call every listed model or retain a free
promotion.

A live verification should be deliberately bounded: list models once, choose
one account-authorized model, perform one small authenticated request, and
record only redacted provider/model/status evidence. Do not store raw response
headers, credentials, or account payloads in the repository.

`node tools/bai-provider-smoke.mjs` implements that one-attempt isolated lane.
It accepts `BAI_API_KEY` only in the wrapper process, removes it before spawning
the gateway child, injects it through the authenticated loopback runtime store,
and destroys the child plus temporary state after the request. Treat its JSON
as a runtime observation, not as a release or long-duration reliability gate.

## Rollback

1. Set `AI_GATEWAY_REAL_PROVIDER_ENABLED=false` and restart the gateway.
2. Remove `bai` from `AI_GATEWAY_ENABLED_PROVIDERS` and restore the fake default
   provider/model.
3. Memory-only runtime credentials are cleared by that restart. This checkout
   does not yet expose an authenticated HTTP/CLI delete operation for one
   persistent runtime credential. For persistent stores, revoke the B.AI key at
   the Provider immediately and schedule store maintenance using the deployment
   master key; do not delete a shared store that contains other Providers.
4. Confirm `bai` is absent from the Provider IDs in `/health/check` and that
   subsequent test traffic carries explicit fake-provider execution evidence.

Do not delete usage or audit records during rollback; they are needed to
reconcile any request whose external outcome is uncertain.

## Language Selection

- **Workload:** Add a declarative OpenAI-compatible provider with fixed routing,
  credential gating, model discovery metadata, tests, and operator docs.
- **Primary path:** Existing shared configuration and the gateway's existing
  OpenAI-compatible HTTP adapter; this document remains Markdown.
- **Alternative A:** A dedicated TypeScript B.AI adapter. Rejected for the
  current scope because no protocol translation beyond the shared adapter is
  required; a second network implementation would duplicate retry, streaming,
  response normalization, and SSRF controls.
- **Alternative B:** A Python sidecar. Rejected because it adds a runtime,
  deployment boundary, and another process that would handle Provider
  credentials without a measurable protocol benefit.
- **Chosen language:** Keep the existing Node.js ESM runtime/configuration
  boundary and reuse the established adapter. Any genuinely new runtime module
  should be TypeScript-first; no new runtime language is introduced here.
- **Compatibility/rollback boundary:** `bai` remains disabled by default and can
  be removed from the allowlist without changing fake-provider or public API
  defaults.
- **Policy impact:** The Provider key stays server-side, public clean-clone
  verification remains credential-free, and no default route changes.
- **Quantified risk mitigation:** Run focused configuration/catalog/adapter
  tests followed by `pnpm check`, `pnpm test`, `pnpm check:public`, and
  `pnpm verify:public-clone`; treat a separately authorized live smoke as
  account evidence only.
