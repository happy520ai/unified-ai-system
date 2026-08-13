# Request cancellation and deadline contract

The gateway propagates one internal execution context from an inbound HTTP request to the selected provider. The context is not accepted from public JSON and cannot be forged by a client.

## Signals

| Condition | Internal code | HTTP outcome | Retry or fallback | Provider health impact |
| --- | --- | --- | --- | --- |
| Client connection closes before completion | `CLIENT_DISCONNECTED` | No response is attempted | Never | Excluded from provider failures |
| Gateway request deadline expires | `GATEWAY_DEADLINE_EXCEEDED` | `504` when headers are still writable | Never inside the expired request | Excluded from provider failures |
| Provider transport exceeds its own timeout | `<PROVIDER>_REQUEST_TIMEOUT` | `504` through the normal error envelope | May retry within the gateway deadline | Counted as a provider failure |

The non-streaming deadline defaults to `AI_GATEWAY_REQUEST_TIMEOUT_MS`; streaming routes use `AI_GATEWAY_STREAMING_REQUEST_TIMEOUT_MS`. The same `AbortSignal` crosses OpenTelemetry instrumentation, fallback selection, provider retry waits, pooled HTTP requests, and streaming response reads.

Cancellation is cooperative. Provider adapters must consume `providerRequest.execution.signal`; adapters that ignore it can continue work after the caller leaves and are not compliant with this contract.

## Operational invariants

- A client cancellation never starts a fallback provider.
- An expired gateway deadline never starts another retry or fallback.
- Client cancellation and gateway deadlines do not increment provider failure or circuit-health counters.
- Provider-owned transport timeouts remain provider failures.
- `clientDisconnected`, `executionDeadlineExceeded`, and `timeoutTriggered` are exposed in the gateway resilience snapshot.
- Cancellation errors and details must not contain prompts, credentials, authorization headers, or provider secrets.

This contract provides process-local propagation. It does not claim cancellation after `SIGKILL`, host loss, or work already accepted by an external provider that does not implement transport cancellation.

Client-side error classes and retry semantics are defined in the [Shared SDK error contract](./sdk-error-contract.md).
