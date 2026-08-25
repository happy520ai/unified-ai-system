# Graceful shutdown contract

Per-request disconnect and deadline behavior is defined separately in [Request cancellation and deadline contract](./request-cancellation-contract.md).

The gateway uses a two-phase shutdown protocol for `SIGTERM` and `SIGINT`:

1. Transition the lifecycle from `ready` to `draining`.
2. Return `503 service_draining` with `Retry-After: 1` for new business work.
3. Keep `/livez`, `/healthz`, `/ready`, `/health`, `/health/check`, and `/metrics` available during the propagation window.
4. Report `service-draining` from `/healthz` and `/ready` so a load balancer can remove the instance.
5. Stop accepting connections after the propagation window and wait for existing HTTP requests.
6. Close idle connections, OpenTelemetry, response-idempotency storage, provider-dispatch storage, and outbound connection pools before exit.
7. Force-close connections only when the total shutdown timeout is exceeded.

## Configuration

| Variable | Default | Bound | Meaning |
| --- | ---: | ---: | --- |
| `AI_GATEWAY_SHUTDOWN_PROPAGATION_MS` | `1000` | 0 to 30000 ms | Time for readiness failure to propagate before the listener closes. Fatal process errors skip this delay. |
| `AI_GATEWAY_SHUTDOWN_TIMEOUT_MS` | `10000` | 1000 to 120000 ms | Total time before connections are force-closed and the process exits non-zero. |

The propagation value is clamped below the total timeout. Configure the
orchestrator termination grace period above the gateway timeout, with room for
container runtime and load-balancer delays.

## Probe semantics

| Route | Ready | Draining |
| --- | --- | --- |
| `/livez` | `200 alive` | `200 alive` until the process stops |
| `/healthz`, `/ready` | `200` when dependencies and saturation gates pass | `503 service_unready` with `service-draining` |
| Business routes | Normal behavior | `503 service_draining`; no provider work starts |

Readiness is a traffic-admission signal. Liveness only says that the process is
still running. Do not use `/livez` as a load-balancer readiness check.

## Boundaries

- In-flight HTTP requests are allowed to finish, but provider cancellation and provider-side reconciliation remain separate contracts.
- WebSocket shutdown still depends on the existing server transport behavior and is not claimed as session migration.
- Forced termination, host loss, or `SIGKILL` cannot run this protocol. SQLite idempotency leases remain the fail-closed recovery boundary for those cases.
- Passing the shutdown tests does not prove zero dropped requests under every proxy, orchestrator, or provider combination.
