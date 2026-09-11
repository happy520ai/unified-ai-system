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

## Reverse MCP and OpenAPI contract

Every operator-configured reverse MCP/OpenAPI tool is mutation-by-default.
`allowedTools` grants visibility and call permission; the separate
`readOnlyTools` glob allowlist is the only authority that lets a call bypass
the durable reservation. Upstream MCP annotations are informative and cannot
grant that authority.

For a mutation, `POST /mcp/call` requires exactly one `External-Effect-Key` or
`Idempotency-Key`. The route hashes it before passing context to the MCP
gateway. After tenant/role/tool ACL and argument-size checks, the service writes
and commits a tombstone containing only hashes of the tenant, target, tool, and
arguments. Only then may the HTTP/stdio `tools/call` or generated REST request
execute. Tool listings expose `readOnly` and `externalEffectRequired` so a
client can know the contract before calling.

Any non-empty `MCP_UPSTREAM_SERVERS_JSON` array automatically enables the gate.
This intentionally makes multi-instance reverse MCP deployments satisfy the
same PostgreSQL and HMAC requirements as other irreversible sinks.

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
sandbox: code invoked outside the governed registry can still perform a side
effect and must be reviewed or prohibited.

Dynamic registration is fail-closed: a custom tool cannot override any built-in
or silently replace another custom tool; every custom tool needs at least one
permission. A read-only custom tool needs explicit `readOnlyAttested=true`. Any
other custom tool must declare a bounded `externalEffectType` and
`externalEffectRequiresFence=true`, so an undeclared write cannot enter the
registry at all. Registered tools are forced to `source=custom` regardless of
caller input and can be removed only through explicit unregister.

Both Agent-facing MCP registration paths (`syncMcpToolsToRegistry` and
`mcpToolAdapter`) mark every imported MCP tool as
`mcp:agent-tool-call`, non-read-only, and fence-required. They commit through
the trusted registry context before `mcpBridge.callTool`; an upstream tool hint
cannot downgrade that boundary.

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
| `AI_GATEWAY_EXTERNAL_EFFECT_ENABLED` | auto-enabled by Feishu API mode, a configured Feishu/WeCom webhook or non-empty MCP upstream registry | `true`/`false` only |
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
- Governed reverse MCP/OpenAPI mutations and current Agent MCP adapters are
  covered, but direct use of low-level MCP clients outside those governed call
  sites and undeclared custom native tools are not magically sandboxed.
- A process crash cannot resume an in-memory role call stack.
- This contract does not prove HA/DR, remote exactly-once, or production
  readiness.

## Feishu API and shared IM sending

Both existing connector routes now use one application-owned runtime and the
existing connector packages. Webhook mode remains the default. Feishu supports
text, markdown and simple title/body cards; WeCom supports text and markdown and
rejects cards. A webhook is bound to its configured group: request recipient
overrides are rejected. The existing `title`, `body` and `text` alias are retained;
if both text fields are supplied they must agree.

Feishu enterprise self-built applications can opt into the fixed Feishu API:

| Setting | Value |
| --- | --- |
| `FEISHU_CONNECTOR_MODE` | `api` (default: `webhook`) |
| `FEISHU_APP_ID` | The operator's application ID |
| `FEISHU_APP_SECRET_REF` | Existing credential reference, such as `env_key_name:FEISHU_APP_SECRET` or a configured vault `file_key_path:...` |
| `FEISHU_API_TARGETS_JSON` | Array of 1–64 exact `{tenantId, receiveIdType, targetId}` records |

Allowed recipient types are `open_id`, `user_id`, `union_id`, `email` and
`chat_id`. The authenticated tenant must match the configured recipient. Neither
the request nor SDK may override the API origin, application identity, secret
reference, authorization header or transport. Only Feishu's enterprise internal
token endpoint is supported; this is not a Lark international API, user OAuth,
marketplace application, attachment upload or contact discovery implementation.

The runtime validates the message/recipient/key and consumes a durable reservation
before materializing the application secret or calling authentication. Tokens
are cached in memory until the returned lifetime minus a 30-second safety margin;
shutdown clears them and interrupts pending operations. No automatic retry is
performed after authentication, message rejection, timeout, disconnection or an
unknown receipt. Token acquisition failure also retains the consumed operation
key. The existing maximum 24-hour tombstone lifetime still applies: expiry does
not prove non-delivery and must not be used to justify automatic resending.

API sends use JSON-string `content` and read `data.message_id`; the request is
accepted only on HTTP success, `code=0` and a valid message ID. Webhook success
uses the platform's explicit success code and may have no ID. `accepted` means
the platform accepted the request, not that a recipient received or read it.
`rejected` retains the established 200 data envelope; unknown message outcomes
return `502 IM_SEND_OUTCOME_UNKNOWN` with `messageAttempted` and `outcomeUnknown`
details. Error responses never echo remote messages, raw transport exceptions,
secrets or tokens. Missing/duplicate/conflicting keys retain the existing 4xx
codes. `messageAttempted` means the message transport was invoked, not that
network delivery or a remote write was proven.

Local bounds are 512 UTF-8 bytes for titles, 16 KiB for message text, 30,000 bytes
for the serialized wire payload and 64 KiB for responses. These are gateway
limits, not a claim that every platform will accept a message at those sizes.
The default complete operation deadline is 10 seconds. Existing response-request
notes remain presentation text and do not implement a callback/listening service.
`GET /connectors` reports configured modes and tenant-specific allowed-target
counts, without recipient IDs or secret references. Health describes configuration
and does not promote it to remote certification based on prior sends.

The shared SDK exposes `connectors()` and
`sendConnectorMessage(connectorId, message, {externalEffectKey})`. Supply one
caller-owned key through the method options. Shared key headers are rejected;
send errors are non-retryable and redirects are rejected. Reconcile an unknown
outcome with the platform before deciding on any new operation.

Protocol references: [official token manager](https://github.com/larksuite/node-sdk/blob/main/client/token-manager.ts)
and [official message API definitions](https://github.com/larksuite/node-sdk/blob/main/code-gen/projects/im.ts).
Local validation uses synthetic credentials and a simulated remote transport;
actual HTTP identity, tenant, persistence, restart and disconnect boundaries are
tested separately from protocol wire shapes. No real message is sent by those
tests. Real send acceptance requires an explicitly authorized recipient/content
and a safe credential entry; it is not implied by passing local checks.

### IM Language Selection and rollback

New application/protocol logic is TypeScript, while the existing JS Feishu entry
forwards to it and the small WeCom package retains its existing JS implementation.
Node 22.18+ matches the workspace and supports the TypeScript entry. No official
SDK dependency, new database, background sender or general connector framework
is added. Existing REST, credential resolver, outbound policy and effect gate
are reused; the gateway only adds workspace links to its two existing packages.

The change necessarily spans the two protocol packages, one application runtime,
both existing route surfaces, public contracts/SDK, their tests and the outbound
check. This exceeds eight files because a package-only implementation would not
enable the actual product route or preserve the SDK contract. Keep the existing
effect database during rollback. Restore webhook mode or disable configured IM
targets, then revert the related code/lockfile changes as one unit and reinstall
the frozen dependencies. Do not clear consumed keys or blindly resend unknown
messages while rolling back.

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
