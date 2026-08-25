# Shared SDK error contract

`@unified-ai-system/shared-sdk` exposes stable error classes and fields so callers do not need to inspect transport-specific messages.

| Condition | Class | `code` | `kind` | Safe automatic retry |
| --- | --- | --- | --- | --- |
| Caller aborts its `AbortSignal` | `GatewayClientAbortError` | `GATEWAY_CLIENT_ABORTED` | `cancelled` | No |
| SDK `timeoutMs` expires | `GatewayClientTimeoutError` | `GATEWAY_CLIENT_TIMEOUT` | `timeout` | No |
| Connection or DNS failure | `GatewayClientError` | `GATEWAY_NETWORK_ERROR` | `network` | No default claim |
| Gateway returns non-2xx | `GatewayClientError` | Server error code, or `GATEWAY_HTTP_ERROR` | `http` | Uses the server's explicit `retryable` field |
| SSE emits an error event | `GatewayClientError` | Event error code, or `GATEWAY_STREAM_ERROR` | `stream` | Uses the event's explicit `retryable` field |

All specialized errors remain instances of `GatewayClientError`. Existing code that catches the base class remains compatible. `statusCode`, `responseBody`, and `cause` are preserved when available.

Client timeout and caller cancellation deliberately expose `retryable=false`: the SDK cannot prove that a non-idempotent request was not accepted by the gateway. Applications may retry only when their operation and idempotency policy make that safe.

```ts
import {
  createGatewayClient,
  GatewayClientAbortError,
  GatewayClientTimeoutError,
} from "@unified-ai-system/shared-sdk";

try {
  await createGatewayClient({ baseUrl, timeoutMs: 5_000 }).chat(request);
} catch (error) {
  if (error instanceof GatewayClientAbortError) return;
  if (error instanceof GatewayClientTimeoutError) {
    // Retry only with an operation-specific idempotency policy.
  }
  throw error;
}
```
