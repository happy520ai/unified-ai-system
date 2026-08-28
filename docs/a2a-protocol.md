# A2A v1.0 Gateway

Unified AI System v0.5.0 and the current source expose an Agent2Agent (A2A)
v1.0 JSON-RPC interface backed by the official `@a2a-js/sdk` `1.0.1` package.

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /.well-known/agent-card.json` | Public Agent Card discovery. |
| `GET /.well-known/a2a-jwks.json` | Public verification keys when signing is configured. |
| `POST /a2a/jsonrpc` | A2A v1.0 JSON-RPC operations. |

The Agent Card advertises `JSONRPC` protocol version `1.0`, `text/plain` input
and output, no streaming, no push notifications, and no extended card. Set
`A2A_PUBLIC_BASE_URL` when the externally reachable URL differs from the
gateway listener URL.

## Verifiable Agent Card Identity

Local fake-provider preview remains credential-free and may serve an unsigned
Agent Card. A deployment can instead mount a stable Ed25519 PKCS#8 private key
and require every discovery response to carry a canonical JWS:

```bash
openssl genpkey -algorithm ED25519 \
  -out /run/secrets/a2a-agent-card-ed25519.pem
chmod 600 /run/secrets/a2a-agent-card-ed25519.pem

export A2A_PUBLIC_BASE_URL=https://gateway.example.com
export AI_GATEWAY_A2A_AGENT_CARD_SIGNING_KEY_FILE=/run/secrets/a2a-agent-card-ed25519.pem
export AI_GATEWAY_A2A_AGENT_CARD_SIGNING_REQUIRED=true
```

The key path must be absolute. POSIX key files must not be accessible by group
or other users. Non-loopback JWKS URLs must use HTTPS. By default the protected
JWS header points to
`<A2A_PUBLIC_BASE_URL>/.well-known/a2a-jwks.json`; set
`AI_GATEWAY_A2A_AGENT_CARD_JWKS_URL` only when a separately operated HTTPS JWKS
publishes the same public key.

The protected header uses `alg=EdDSA`, `typ=JOSE`, a SHA-256-derived `kid`, and
`jku`. The published JWKS contains only the Ed25519 public key. Signing uses the
official SDK canonicalizer and signature generator; the focused tests verify
the result with `verifyAgentCardSignature`. A missing, malformed, broadly
readable, non-Ed25519, or insecurely published required key fails closed without
printing key material.

Use an overlap window when rotating the mounted key. The primary key signs first
and up to three previous Ed25519 keys may add compatibility signatures; the
local JWKS publishes the matching public keys in the same order:

```bash
export AI_GATEWAY_A2A_AGENT_CARD_SIGNING_KEY_FILE=/run/secrets/a2a-agent-card-new.pem
export AI_GATEWAY_A2A_AGENT_CARD_PREVIOUS_SIGNING_KEY_FILES_JSON='["/run/secrets/a2a-agent-card-old.pem"]'
```

Every previous path receives the same absolute-path, size, POSIX-permission,
and Ed25519 checks as the primary. Malformed JSON, more than three previous
keys, duplicate paths/public `kid` values, or previous keys without a primary
fail startup. Private material never enters the Agent Card, JWKS, health, or
logs.

For rotation: first ensure the new and old public keys are available at the
declared JWKS; then deploy the new primary plus the old key in the previous-key
array. Keep that overlap longer than the five-minute Agent Card/JWKS cache and
the deployment's maximum client cache/skew window. After old cards have aged
out, remove the previous-key setting and then retire the old private key. A
separately operated `AI_GATEWAY_A2A_AGENT_CARD_JWKS_URL` must publish the same
complete overlap set; the gateway cannot prove an external JWKS is synchronized.

## Bounded And Durable Tasks

Every task-store mode now enforces tenant plus authenticated-owner isolation,
seven-day TTL by default, global and per-owner capacity, serialized task size,
history and artifact limits, and cursor-bound keyset pagination. Client-supplied
`ListTasks.tenant` never overrides the server call context.

Local preview uses a bounded in-memory SQLite database. For restart-safe
same-host persistence, configure a dedicated local path:

```bash
export AI_GATEWAY_A2A_TASK_STORE_MODE=sqlite
export AI_GATEWAY_A2A_TASK_STORE_PATH=/var/lib/unified-ai-system/a2a-tasks.sqlite
export AI_GATEWAY_A2A_TASK_STORE_REQUIRED=true
```

`AI_GATEWAY_MULTI_INSTANCE=true` selects SQLite by default when the A2A mode is
not explicit. SQLite uses WAL, `synchronous=FULL`, a bounded busy timeout, an
atomic upsert/capacity transaction, a private directory, and a mode-0600
database where POSIX permissions exist. `/healthz` and `/ready` expose only the
safe mode/limit/availability snapshot and fail readiness if the store probe
fails.

Tune only within the enforced ranges through `AI_GATEWAY_A2A_TASK_TTL_MS`,
`AI_GATEWAY_A2A_TASK_MAX_ENTRIES`,
`AI_GATEWAY_A2A_TASK_MAX_ENTRIES_PER_OWNER`,
`AI_GATEWAY_A2A_TASK_MAX_BYTES`,
`AI_GATEWAY_A2A_TASK_MAX_HISTORY_MESSAGES`,
`AI_GATEWAY_A2A_TASK_MAX_ARTIFACTS`, and
`AI_GATEWAY_A2A_TASK_SQLITE_BUSY_TIMEOUT_MS`.

This SQLite profile is same-host only. Do not place it on NFS, SMB, or a cloud
filesystem. Cross-host replicas can explicitly share the bounded task lifecycle
through PostgreSQL:

```bash
export AI_GATEWAY_A2A_TASK_STORE_MODE=postgres
export AI_GATEWAY_A2A_TASK_STORE_CENTRAL_REQUIRED=true
export AI_GATEWAY_A2A_TASK_STORE_POSTGRES_URL='<secret>?sslmode=verify-full'
export AI_GATEWAY_A2A_TASK_STORE_NAMESPACE=production
```

The PostgreSQL mode uses database-clock TTL, transactionally maintained global
and per-owner capacity counters, task-scoped transaction locks, monotonic status
timestamp protection, SHA-256 corruption checks, repeatable-read pagination,
and fixed parameterized tables. It also automatically enables a database-clock
execution lease for the server-derived tenant + authenticated owner + task:
only one replica can hold the active lease, a heartbeat renews it, detected
lease loss suppresses result publication, and a cancel handled by another replica
revokes the correct tenant-scoped lease. Raw lease tokens stay in executor
memory; PostgreSQL stores only their digest and a monotonic fence. Non-loopback URLs require
`sslmode=verify-full`; health and metrics expose no URL, namespace, task body,
or database error text.

Tasks intentionally contain A2A history, metadata, and artifacts. Use a
least-privilege database role, encryption at rest, bounded retention, and tested
backup/deletion procedures. SHA-256 detects accidental or unrecomputed edits;
it is not proof against an attacker who can rewrite both task data and hashes.
The lease prevents concurrent valid active execution through this gateway and
passes the fence into the internal Workforce context. Validation immediately
before result publication is not one atomic transaction with the downstream
TaskStore write, so a narrow revoke/commit race remains. Provider operations and
every irreversible sink must independently reject stale fences; cancellation
also remains cooperative for already-running work. Exactly-once side effects,
database failover, network partition, and split-brain behavior therefore remain
separate evidence requirements.

## Official SDK Example

Start the gateway, then run the checked client:

```bash
pnpm gateway serve
node docs/examples/a2a-sdk-client.mjs
```

Use the consolidated mainstream-client certification pass:

```bash
pnpm exec node tools/verify-client-runtimes.mjs --client a2a-official
```

The example uses the official A2A JavaScript SDK to discover the Agent Card,
call `SendMessage`, retrieve the result with `GetTask`, and find it with
`ListTasks`.

## Natural-Language Enhancement

The A2A request metadata can explicitly opt into the same local deterministic
prompt enhancer used by the HTTP and MCP surfaces:

```json
{
  "unifiedAi": {
    "promptEnhancement": {
      "enabled": true,
      "profile": "coding",
      "language": "en"
    }
  }
}
```

This metadata belongs on `SendMessageRequest.metadata`. It is a Unified AI
System extension, not a standard A2A field.

## Safety And Limits

- A2A execution is pinned to `local-fake-provider` and fails unless the result
  proves fake execution.
- The Agent Card is public. `/a2a/jsonrpc` follows the gateway's existing
  enterprise authentication and `chat:use` permission policy.
- When enterprise authentication is enabled, the Agent Card advertises HTTP
  Bearer authentication. Provider keys remain server-side.
- Tasks are always bounded and scoped by authenticated owner plus enterprise
  tenant. The default memory mode does not survive restart; the opt-in SQLite
  mode is restart-safe on one host; PostgreSQL shares state and fenced execution
  ownership across hosts.
- The official request handler provides `SendMessage`, `GetTask`, `ListTasks`,
  and `CancelTask`. A different replica can revoke the scoped PostgreSQL lease,
  but cancellation remains cooperative and cannot guarantee that an
  already-running provider operation was interrupted.
- Streaming, push notifications, gRPC, HTTP+JSON/REST, non-text parts, and a
  fence-aware irreversible side-effect sink are not enabled in this profile.
  Durable/distributed task storage and Agent Card signing remain explicit
  deployment options.

Run `pnpm verify:public-clone` for the credential-free official-client proof.
The published `v0.5.0` gateway image and the current source include this A2A
profile; the current source carries additional post-release hardening tracked in
PR #115.
