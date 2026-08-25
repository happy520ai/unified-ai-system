# Durable external-effect fencing

This contract governs irreversible operations that are not ordinary model
dispatches: connector and alert webhooks, built-in Git remote tools,
pull-request creation, and arbitrary `shell_exec` commands.

It is an **at-most-once attempt fence inside a bounded retention window**. It
is not an exactly-once protocol with GitHub, Feishu, WeCom, a shell child
process, or any other remote system.

## Execution order

For a governed operation the gateway performs this order:

1. Validate that exactly one bounded operation key is present.
2. Hash the key immediately. Raw keys, webhook URLs, payloads, tenant IDs, and
   Workforce claim tokens are not persisted in the reservation row.
3. If a Workforce fence is required, validate the trusted server-side claim.
4. Write a durable non-replayable tombstone.
5. Revalidate the trusted claim at the commit boundary.
6. Invoke the irreversible sink once.

Duplicate keys, changed payloads, missing keys, stale claims, full stores, and
unavailable stores all fail before the sink. A tombstone remains when the claim
becomes stale after reservation. This deliberately prefers a missed operation
over an unsafe duplicate.

If the remote system accepts an operation and the response is lost, the gateway
cannot distinguish success from an unknown outcome and will not retry the same
key. Reconcile externally before choosing a new key.

## HTTP connector contract

Real sends through these routes require a key:

- `POST /connectors/feishu/send`
- `POST /connectors/wecom/send`

Supply exactly one of:

```http
Idempotency-Key: caller-stable-operation-id
```

```http
External-Effect-Key: caller-stable-operation-id
```

`Idempotency-Key` is accepted for client compatibility. The dedicated header
states intent more precisely. Supplying both is invalid. CORS preflight allows
`External-Effect-Key`.

Dry-run connector calls do not contact a webhook and do not consume a key.
Real webhook configuration automatically enables the durable gate, even when
`AI_GATEWAY_EXTERNAL_EFFECT_ENABLED=false` is set. Remove the webhook URL to
return that connector to dry-run; the safety gate cannot be disabled underneath
an active webhook.

The active runtime router and the extracted capability router share one guard.
The public outbound-policy check requires that guard in both files to prevent a
future route refactor from restoring an unguarded send path.

## Agent tool contract

`shell_exec`, `git_push`, and `git_create_pr` remain unavailable unless the
operator explicitly enables high-risk tools and supplies a permission checker.
That opt-in is necessary but not sufficient. Irreversible execution also
requires:

- a durable external-effect gate configured by the trusted registry owner;
- a stable tool-call key derived from the server session ID and provider tool
  call ID;
- a trusted execution fence configured on the registry, never copied from tool
  parameters or a caller context override.

`git_push` and `git_create_pr` declare explicit effect classes and call the
commit boundary immediately before their external command. Every `shell_exec`
call is fenced, not only commands recognized by a regex. Named patterns improve
audit classification for Git, package publishing, container pushes,
Kubernetes, Helm, Terraform, deployments, and HTTP clients; unknown aliases or
scripts use `shell:unclassified` and are still fenced.

Custom irreversible tools must declare `externalEffectType`, call
`context.commitExternalEffect()` immediately before their sink, and return no
success before that call. The registry converts a success without a commit into
`TOOL_EXTERNAL_EFFECT_COMMIT_MISSING`. This is a runtime contract, not a native
sandbox: custom code that performs an undeclared side effect can still bypass
it and must be reviewed.

Workforce role context exposes only a frozen `{ fencingToken, assertActive }`
object. The assertion closure captures the real claim token inside the queue;
the token is not serialized or passed to the role. Both local and PostgreSQL
queues validate expiry, owner, task, and fencing token at each assertion.

## Reusable connector packages

`@unified-ai-system/im-connector-feishu` and
`@unified-ai-system/im-connector-wecom` require both a stable
`target.externalEffectKey` and an injected
`externalEffectGuard.reserveAndCommit()` implementation for non-dry-run sends.
The guard receives only hashed key, target, and payload fingerprints plus the
effect class. A missing or rejecting guard prevents `fetch`.

The reusable alert engine follows the same rule for configured webhook URLs.
It writes the local alert record, but a real webhook send requires an injected
`externalEffectGuard.reserveAndCommit()`. The key, target, and payload supplied
to that guard are hashes; `flush()` lets a caller await all pending dispatches
before shutdown.

## Storage modes

| Topology | Required mode | Boundary |
| --- | --- | --- |
| No configured irreversible sink | `disabled` | `reserve()` always fails closed |
| One process or same-host replicas | `sqlite` | Restart-safe and shared only through one local filesystem |
| Multiple hosts | `postgres` | Central cross-host reservation owner |

SQLite must not be placed on NFS. Multi-instance mode automatically requires
PostgreSQL. When Workforce PostgreSQL is configured, startup requires the
external-effect store to target the same effective database. Different URLs
that omit a database but use different users are treated as different targets,
because PostgreSQL defaults the database name to the user.

PostgreSQL uses dedicated objects and capacity:

- `public.ai_gateway_external_effect_entries`
- `public.ai_gateway_external_effect_fencing_seq`
- dedicated expiry and lease indexes
- dedicated advisory-lock namespaces

It does not consume HTTP idempotency or provider-dispatch rows.

## Configuration

| Variable | Default | Requirement |
| --- | --- | --- |
| `AI_GATEWAY_EXTERNAL_EFFECT_ENABLED` | auto-enabled by a configured Feishu/WeCom webhook | `true`/`false` only |
| `AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE` | `sqlite`, or `postgres` when a central URL is present | `disabled` is rejected when enabled |
| `AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH` | `.data/external-effects.sqlite` | Single-host durable path |
| `AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET` | generated restricted local secret for SQLite | Stable value of at least 32 bytes; explicit for PostgreSQL |
| `AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET_PATH` | `.data/external-effects-hmac.key` | Restricted SQLite secret file |
| `AI_GATEWAY_EXTERNAL_EFFECT_POSTGRES_URL` | Workforce queue/claim URL when available | Non-loopback deployment must use verified TLS |
| `AI_GATEWAY_EXTERNAL_EFFECT_POSTGRES_TLS_REQUIRED` | `true` | Non-loopback requires `sslmode=verify-full` |
| `AI_GATEWAY_EXTERNAL_EFFECT_CENTRAL_REQUIRED` | `false` | Multi-instance mode sets the requirement automatically |
| `AI_GATEWAY_EXTERNAL_EFFECT_TTL_MS` | `86400000` | 1 minute to 24 hours; protection ends at expiry |
| `AI_GATEWAY_EXTERNAL_EFFECT_MAX_ENTRIES` | `100000` | 1 to 1,000,000; capacity exhaustion fails closed |

Never commit, log, print, or pass the HMAC secret in command-line arguments.
All replicas must share it.

## Failure contract

| Condition | HTTP/tool code | Sink called? |
| --- | --- | --- |
| Missing or malformed key | `400 EXTERNAL_EFFECT_KEY_REQUIRED` / `EXTERNAL_EFFECT_KEY_INVALID` | No |
| Both supported key headers | `400 EXTERNAL_EFFECT_KEY_INVALID` | No |
| Same key and same operation already consumed | `409 EXTERNAL_EFFECT_ALREADY_RESERVED` | No |
| Same key with changed target or payload | `409 EXTERNAL_EFFECT_KEY_REUSED` | No |
| Missing or stale trusted fence | `409 EXTERNAL_EFFECT_FENCE_REQUIRED` / `EXTERNAL_EFFECT_FENCE_INACTIVE` | No |
| Capacity full | `503 EXTERNAL_EFFECT_CAPACITY_REACHED` | No |
| Store unavailable or unconfirmed | `503 EXTERNAL_EFFECT_STORE_UNAVAILABLE` or `409 EXTERNAL_EFFECT_RESERVATION_UNCONFIRMED` | No |
| Tool registry lacks gate/key/fence | `TOOL_EXTERNAL_EFFECT_*` denial | No |

Capability error transport preserves explicit 4xx/5xx status and retryability;
it does not flatten a persistence failure into a generic 422.

## Readiness and metrics

When enabled, `/healthz`, `/ready`, and `/metrics` actively probe the gate. An
unavailable store adds `external-effect-store-unavailable` and makes readiness
fail. Health output contains only mode, bounds, availability, counts, and a
statistics timestamp.

Prometheus exports:

- `ai_gateway_external_effect_gate_enabled`
- `ai_gateway_external_effect_store_available`
- `ai_gateway_external_effect_store_distributed`
- `ai_gateway_external_effect_reservations{state=...}`
- `ai_gateway_external_effect_stats_age_seconds`

Alert on unavailable storage, capacity pressure, stale statistics, unexpected
tombstone growth, PostgreSQL lag, and failed restore drills.

## Explicit limitations

- No remote transaction spans the database and GitHub, Feishu, WeCom, or a
  child process. Claim revalidation narrows but cannot eliminate the final
  network TOCTOU window.
- Protection expires after at most 24 hours.
- Provider calls use the separate provider-dispatch contract.
- Generic upstream MCP/OpenAPI mutations and undeclared custom native tools are
  not yet universally classified or fenced.
- A process crash cannot resume an in-memory role call stack.
- This contract does not prove HA/DR, remote exactly-once, or production
  readiness.

## Verification

The repository gates include focused SQLite/restart/conflict tests, active and
extracted HTTP route tests, tool/permission/fence tests, connector-package
tests, health/metrics tests, and real PostgreSQL integration tests. Before a
release run:

```bash
pnpm check
pnpm test
pnpm check:public
pnpm verify:public-clone
```

The PostgreSQL CI job must also run every `*.postgres.integration.test.ts`
suite against a real temporary PostgreSQL instance.
