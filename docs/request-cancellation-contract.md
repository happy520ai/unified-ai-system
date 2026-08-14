# Request cancellation and deadline contract

The gateway propagates one internal execution context from an inbound HTTP or WebSocket request to the selected provider. The context is not accepted from public JSON and cannot be forged by a client.

## Signals

| Condition | Internal code | Gateway outcome | Retry or fallback | Provider health impact |
| --- | --- | --- | --- | --- |
| Client connection closes before completion | `CLIENT_DISCONNECTED` | No response is attempted | Never | Excluded from provider failures |
| Gateway request deadline expires | `GATEWAY_DEADLINE_EXCEEDED` | `504` when headers are still writable | Never inside the expired request | Excluded from provider failures |
| Gateway shuts down with WebSocket work in flight | `GATEWAY_SHUTDOWN` | Socket closes with `1001`; no late response | Reconnect to a ready replica | Excluded from provider failures |
| WebSocket connection or execution lease is lost | `EXECUTION_LEASE_LOST` | Socket closes with `1013`; no late response | Reconnect after ownership is available | Excluded from provider failures |
| Provider transport exceeds its own timeout | `<PROVIDER>_REQUEST_TIMEOUT` | `504` through the normal error envelope | May retry within the gateway deadline | Counted as a provider failure |

The non-streaming deadline defaults to `AI_GATEWAY_REQUEST_TIMEOUT_MS`; streaming routes use `AI_GATEWAY_STREAMING_REQUEST_TIMEOUT_MS`. The same `AbortSignal` crosses WebSocket dispatch, OpenTelemetry instrumentation, fallback selection, provider retry waits, pooled HTTP requests, and streaming response reads.

Cancellation is cooperative. Provider adapters must consume `providerRequest.execution.signal`; adapters that ignore it can continue work after the caller leaves and are not compliant with this contract.

## Operational invariants

- A client cancellation never starts a fallback provider.
- An expired gateway deadline never starts another retry or fallback.
- Client cancellation and gateway deadlines do not increment provider failure or circuit-health counters.
- WebSocket disconnect, shutdown, and lease-loss cancellation release in-flight ownership after provider work unwinds and never emit a late application response.
- Provider-owned transport timeouts remain provider failures.
- HTTP exposes `clientDisconnected`, `executionDeadlineExceeded`, and `timeoutTriggered`; WebSocket exposes total cancellation plus client-disconnect, shutdown, and lease-loss counters.
- Cancellation errors and details must not contain prompts, credentials, authorization headers, or provider secrets.

This contract provides cooperative process-local propagation. It does not claim cancellation after `SIGKILL`, host loss, or work already accepted by an external provider that does not implement transport cancellation.

Client-side error classes and retry semantics are defined in the [Shared SDK error contract](./sdk-error-contract.md).
