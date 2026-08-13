# Rate-limit client contract

The gateway returns request-quota hints on rate-limited and successful HTTP responses. These values help clients pace requests; they are not a service-level agreement.

## Response headers

| Header | Value | Client use |
| --- | --- | --- |
| `X-RateLimit-Limit` | Request count | Configured request limit for the active window. |
| `X-RateLimit-Remaining` | Request count | Requests remaining in the current bucket. |
| `X-RateLimit-Window` | Duration such as `60s` | Configured window duration. |
| `X-RateLimit-Reset` | Unix timestamp in seconds | Approximate bucket reset time. |
| `x-ratelimit-limit-requests` | Request count | OpenAI-compatible request quota alias. |
| `x-ratelimit-remaining-requests` | Request count | OpenAI-compatible remaining-request alias. |
| `x-ratelimit-reset-requests` | Duration such as `60s` | OpenAI-compatible request reset duration. |
| `Retry-After` | Delta seconds | Minimum delay after a `429 Too Many Requests` response. |

The gateway exposes these headers through CORS. It does not expose IP addresses, user IDs, database namespaces, or other rate-limit partition keys.

## Retry algorithm

1. Retry only idempotent operations automatically. For provider-backed `POST /chat`, use the [idempotent chat request contract](./idempotent-chat-contract.md).
2. On HTTP `429`, prefer `Retry-After` and treat it as a minimum delay.
3. Add bounded random jitter so many clients do not retry at the same instant.
4. Cap retries by attempt count and total elapsed time.
5. Log `x-request-id` with the status and retry delay, but do not log prompts, credentials, or authorization headers.

## Example

```js
const response = await fetch(gatewayUrl, request);

if (response.status === 429) {
  const retryAfterSeconds = Number(response.headers.get("retry-after") ?? "1");
  const boundedSeconds = Math.min(Math.max(retryAfterSeconds, 1), 60);
  const jitterMs = Math.floor(Math.random() * 250);
  await new Promise((resolve) => setTimeout(resolve, boundedSeconds * 1000 + jitterMs));
}
```

## Boundaries

- These fields describe gateway request quotas, not provider token quotas or provider billing limits.
- A successful response does not guarantee that later requests will be accepted; capacity and policy can change.
- Memory-backed limits are process-local. Use the configured SQLite backend when multiple gateway processes must share a request counter.
- SQLite mode is same-host only. Use `AI_GATEWAY_RATE_LIMIT_STORE_MODE=postgres` when gateway replicas on different hosts must enforce one shared request quota.
- PostgreSQL mode uses database-clock fixed windows and atomic counters. It stores an HMAC-derived subject identity rather than the raw request IP, and isolates global and route quotas by namespace.
- PostgreSQL store or capacity failure returns `503 RATE_LIMIT_STORE_UNAVAILABLE` or `503 RATE_LIMIT_STORE_CAPACITY`; the request does not proceed to provider execution. A `429 RATE_LIMITED` means the shared quota itself was exceeded.
- PostgreSQL mode requires `AI_GATEWAY_RATE_LIMIT_POSTGRES_URL` and a shared `AI_GATEWAY_RATE_LIMIT_HMAC_SECRET` of at least 32 bytes. Load both from a secret manager and require certificate-verified TLS outside a trusted local network.
- The gateway intentionally does not emit the evolving IETF `RateLimit` structured field as if it were a final RFC contract.
