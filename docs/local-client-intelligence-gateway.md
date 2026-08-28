# Local Client Intelligence Gateway

This document defines the product and evidence boundary for managing local AI
clients through Unified AI System. It is a living acceptance contract, not a
production-readiness claim.

## Product outcome

One local gateway should give compatible applications a common protocol surface,
client-scoped policy, explainable routing, health and cost feedback, and governed
execution. "All local applications" means:

1. any application that speaks a supported open protocol can connect without a
   product-specific adapter;
2. applications that require configuration or actions use an explicit, reviewed
   adapter; and
3. an observed operating-system process is inventory only. A process name is
   never proof of identity and never grants execution authority.

The gateway must not claim that it controls an application until a real adapter
has authenticated the application and returned an execution receipt.

## 9Router source baseline

The comparison target is the official
[`decolua/9router`](https://github.com/decolua/9router) repository at
[`v0.5.55` / commit `699edac`](https://github.com/decolua/9router/releases/tag/v0.5.55),
released on 2026-08-14. The source snapshot was reviewed on 2026-08-28.

Verified strengths in that snapshot include:

- a low-friction local install and dashboard;
- OpenAI Chat/Responses, Anthropic Messages, Gemini, embeddings, image, audio,
  video, search, and fetch surfaces;
- account fallback with cooldown/backoff, explicit Combo fallback and
  round-robin, input-capability adaptation, and panel/judge Fusion;
- local SQLite/WAL state, quota and usage views, API keys, dashboard sessions,
  OIDC/SAML, and login lockout;
- three MITM integrations and nineteen CLI/IDE catalog entries. The bulk status
  endpoint covers fourteen known tools, not arbitrary local applications. See
  the immutable
  [client catalog](https://github.com/decolua/9router/blob/699edac3273e13d4744bc46f6082618f08560702/src/shared/constants/cliTools.js)
  and [status route](https://raw.githubusercontent.com/decolua/9router/master/src/app/api/cli-tools/all-statuses/route.js).

Claims on the 9Router website or GitBook such as automatic three-tier budget
routing, budget caps, email alerts, provider totals, savings percentages, or
"zero downtime" are not treated as implemented facts unless the immutable
source and a reproducible test support them.

## Evidence-based comparison gate

| Dimension | 9Router verified baseline | Unified AI System acceptance gate |
| --- | --- | --- |
| Client reach | Known client catalog and protocol proxying | Server-bound managed OpenAI, Anthropic, Gemini, and native HTTP today; MCP/A2A principal binding and each non-protocol adapter must pass their own versioned certification gate |
| Local inventory | Known-tool checks; no general governed process registry found | General observation API, but observed processes remain `unverified` and non-routable until explicitly managed |
| Routing | Fallback, round-robin, cooldown/backoff, modality checks, Fusion | Policy filter first; then exact capability, health, bounded EWMA reliability, latency, cost, quota, priority, and trust scoring with per-candidate explanations |
| Feedback | Usage/quota/latency records | Authenticated, bounded feedback; replay resistance; failure quarantine; controlled recovery; restart persistence |
| Data governance | No verified per-client data-class policy before fallback/Fusion | Per-client allowed providers, data class, region, fan-out ceiling, Fusion permission, and fail-closed policy tests |
| Configuration writes | Product-specific settings routes; no uniform transactional rollback found | Structured parse, dry-run diff, file lock, atomic replacement, backup, crash recovery, exact rollback, and unrelated-field preservation for every adapter |
| Identity and authorization | Dashboard/API authentication; no verified tenant RBAC matrix | Tenant-bound identities, scoped client principals, least-privilege RBAC, action/model/budget/rate policy, rotation, revocation, and negative cross-tenant tests |
| Secrets | Provider and endpoint secrets are stored in local application state | Credential references only in client records; encrypted credential store; API keys stored as hashes; no secret in logs, responses, backups, or shared files |
| Execution | Configuration and MITM operations | Default-off adapters, immutable route plan, exact one-time approval, idempotency, external-effect fence, cancellation, lifecycle state, and receipt hash |
| Observability | Local usage, quota, cost, TTFT, and total latency | OpenTelemetry traces/metrics/logs, Prometheus output, client-to-route-to-provider correlation, pre-storage redaction, and retention controls |
| Resilience | Single-node state and in-process cooldown | Persistent circuit state, deadlines, cancellation, clean shutdown, no leaked processes, and optional shared fenced stores for multi-instance execution |
| Supply chain | Docker publication without verified release-wide test gate, SBOM, or provenance in the reviewed workflow | All repository gates, hosted CI, SBOM, provenance, signature, digest pinning, and credential-free public-clone verification |
| Claim integrity | Public documentation has observable drift from source | Capability tables generated from code/tests; SLO, adapter, provider, HA, and savings claims link to reproducible evidence |

Unified AI System is "better than 9Router" only when every relevant row has
current reproducible evidence. More routes, more source files, focused tests, or
a fake-provider demo do not establish overall superiority.

## Runtime architecture

### 1. Protocol ingress

Existing OpenAI-compatible, Anthropic-compatible, Gemini-compatible, MCP, A2A,
and native HTTP surfaces remain the primary way applications connect. Client
identity is server-authenticated and becomes part of the request policy context.

For a configured loopback client, managed protocol routing is a server-bound
PoP profile rather than a voluntary body flag or bearer-only header:

1. A dedicated enterprise credential with the least-privilege `local_client`
   role is required; admin/operator credentials must never be deployed in a
   client. Versioned server configuration binds that authenticated
   tenant/subject to exactly one configured client. A bound subject cannot omit
   managed identity on a supported route, claim another client, or switch to an
   unsupported provider-bearing endpoint; all fail before provider execution.
2. The client and gateway independently derive a dedicated per-tenant/client
   PoP key from the existing adapter secret using the versioned
   `managed-local-client-pop-derived-key-v1` HMAC domain. The adapter secret is
   not sent in the request.
3. The request body repeats `unified_ai.local_client_id`. It confirms but never
   selects the server-owned principal. The client signs the
   current tenant, authenticated subject, client ID and verified revision,
   uppercase method, exact origin-form path plus query, SHA-256 of the exact raw
   body bytes, key ID, 32-byte nonce, issue time, and expiry.
4. The canonical proof is sent as the single
   `X-AI-Gateway-Local-Client-Proof: popv1.<base64url>` header. The gateway first
   resolves the current verified revision from trusted state, then verifies and
   atomically consumes the nonce.
5. A successful pure Provider decision becomes an immutable one-target binding.
   The gateway asserts that binding immediately before every adapter attempt.

The gateway does not expose a proof-issuing HTTP endpoint: the configured client
must possess its own adapter secret. The current protocol-dispatch integration
covers OpenAI Chat, Anthropic Messages, Gemini GenerateContent, and native
`/chat`; MCP and A2A principal binding remain explicit release gates.

### 2. Client control plane

The data model separates three records:

- `ObservedApplication`: host observation only; unverified and non-routable.
- `ManagedClientDescriptor`: tenant-owned, administrator-approved descriptor
  bound to a code-registered adapter and immutable capability manifest revision.
- `ClientTelemetry`: lease, health, bounded load, latency, and reliability data;
  a client principal cannot change trust, capabilities, priority, or admin state.

Disable and revoke decisions are sticky. Discovery and heartbeat cannot silently
re-enable them.

### 3. Explainable route planning

Policy removes forbidden candidates before scoring. A partial capability match
may be shown as a diagnostic alternative but can never displace an available
complete match and can never execute. A route plan binds tenant, subject, client
revision, capability/action, input hash, policy version, and expiry into a stable
digest.

### 4. Governed adapters

Adapters are registered by application code, never supplied as arbitrary command,
executable, or endpoint fields in an HTTP request. The first credential-free
implementation uses an explicitly labelled fake adapter. A real adapter requires
application identity proof, an allow-listed action schema, one-time approval,
durable external-effect reservation, timeout/cancellation, and a receipt.

### 4.1 Route-plan and execution ordering

The codebase now has versioned in-memory and single-host SQLite route-plan
stores. Both hash canonical adapter input and bind tenant, subject, verified
client revision, adapter identity/version, exact capability/action, policy
version, and expiry into an immutable SHA-256 plan ID. The memory store is
intentionally `single-process-memory` and preview-oriented. The SQLite store
adds WAL/FULL durability and atomic one-time consumption on one host. Neither
store grants approval or supplies an external-effect fence by itself.

The real execution path must preserve this server-owned order:

1. Reload the plan under the authenticated tenant and subject, re-hash the
   caller-supplied input, and revalidate client revision and adapter identity.
2. Atomically consume a subject-bound approval for the exact plan digest and
   exact server-generated scopes.
3. Consume the route plan and initialize durable lifecycle state.
4. Acquire and continuously validate an execution claim/fence.
5. Durably reserve the external-effect key, then commit the reservation
   immediately before calling the adapter.
6. Invoke the adapter with cancellation/deadline propagation and validate its
   signed receipt before writing the terminal lifecycle state.

Any failure after approval consumption requires a new plan and approval. A
reservation without a receipt is `unknown-reconcile-required` and is never
automatically retried under a new key. External-effect `commit()` proves only
that the pre-effect fence was active; it does not prove the application accepted
or completed the action.

### 5. Operator experience

`apps/agent-console` owns inventory, route explanations, approvals, disable and
revoke controls, execution lifecycle, and rollback. The console must distinguish
`observed`, `declared`, `verified`, `disabled`, and `revoked` clients, and must
label fake versus real execution.

## Current implementation boundary

The in-progress vertical slice provides local inventory, explicit registration,
heartbeat/feedback data, deterministic capability routing, maintenance, and a
fail-closed execution foundation. The current safe boundary is:

- read operations and default smart-management dry-runs do not create registry
  or execution-log files;
- corrupt registry data fails closed and is not overwritten automatically;
- environment strings are normalized, and requesting execution without a
  governed adapter fails gateway construction;
- capability spelling is canonicalized and complete matches are ranked before
  partial matches;
- every operation is bound to a server-authenticated tenant and subject; tenant
  records are isolated and request-body tenant overrides are ignored;
- process discovery and heartbeat upsert create unverified, non-routable
  observations; explicit registration creates a declared descriptor but does
  not create verified execution authority. Discovery, heartbeat, and register
  cannot silently undo a disable decision;
- `POST /local-clients/revoke` now provides exact-revision, tenant-scoped,
  irreversible revocation on an authenticated registry. It clears verification
  evidence, increments the client revision, forces non-routable rejected state,
  survives restart, and cannot be undone by register, discovery, heartbeat, or
  an execution plan. Unsigned registries cannot revoke;
- public DTOs omit tenant IDs, paths, commands, executables, endpoints, process
  IDs, raw metadata, and request arguments; all client responses use
  `Cache-Control: no-store`;
- registration accepts descriptor fields only. Health, statistics, trust,
  priority, commands, endpoints, and metadata cannot be injected through it;
- shared TypeScript contracts cover the stable registry, routing, verification,
  execution, and onboarding surfaces; SDK methods expose discovery, disable,
  and smart-management responses after server-side validation, but do not yet
  perform independent client-side shape validation for every result. The
  authenticated operator CLI now supports bounded
  `clients discover|list|inspect|register|verify|disable|revoke|smart-manage`
  plus governed onboarding. Discovery and smart management default to dry-run;
  mutations require the admin key, explicit confirmation, and exact revision
  where applicable. Inspect is explicitly a bounded registry-list lookup, not
  independent application evidence, and uncertain writes are never retried;
- a code-only adapter registry and deterministic fake adapter are wired into the
  application. The fake receipt never claims an external effect and cannot
  satisfy real-execution readiness;
- a strict loopback HTTP adapter now has a real fixture-verified handshake and
  action path: exact pinned loopback origin, HMAC nonce/TTL challenge, expected
  client and manifest identity, fixed action schema, signed receipt, bounded
  response, timeout, cancellation, and unknown-outcome handling. Its startup
  registration is explicit, credential-reference based, tenant-bound, and
  default-off. A versioned configuration can register up to 64 unique
  adapter IDs and tenant/client ownership pairs with a dedicated registry key;
  the legacy single-client environment remains compatible. Governed execution
  uses the new `/local-clients/executions/*` routes; the legacy
  `/local-clients/execute` route remains preview-only for compatibility;
- a no-action loopback verification probe and a trusted verification service now
  bind fresh proof-of-possession evidence to the exact tenant/client revision,
  adapter identity/version, manifest digest, and capability list. The management
  store exposes a compare-and-set promotion boundary so a stale, changed,
  disabled, or racing declaration cannot become `verified`. The configured
  tenant/client ownership wrapper, HMAC-authenticated registry, startup
  preflight, fsync + atomic replacement, and `POST /local-clients/verify` are
  now composed into the application;
- the adapter registry uses a bounded abort-drain window so a cancellation after
  dispatch preserves `outcomeUnknown=true` instead of being misreported as a
  clean cancellation;
- route plans can now use an explicitly configured single-host SQLite backend
  with WAL, synchronous FULL writes, schema and host binding, record digests,
  restart recovery, cross-process atomic consume, TTL tombstones, and no raw
  adapter input at rest;
- the application can construct an explicit single-host SQLite execution-claim
  store with monotonic fencing tokens, hashed bearer ownership, restart
  recovery, clock-rollback and corruption detection, atomic renew/release, and
  host/config binding. It is wired into readiness; multi-instance execution
  remains denied because this claim store is not distributed;
- a dependency-injected execution orchestrator now fixes the order of current
  target/input revalidation, exact approval check/consume, route-plan consume,
  durable lifecycle, claim/fence, external-effect reserve/commit, adapter call,
  receipt validation, and terminal state. Its execution fence rechecks claim,
  exact verified revision/adapter/capability, running lifecycle, subject,
  cancellation, and pause state at reserve, commit, and the loopback action
  dispatch boundary. After a verified completion receipt it derives a stable,
  content-free feedback event and durably stages it before the terminal
  lifecycle write. A bounded dispatcher then delivers the event at least once
  into the exactly-once feedback aggregate and acknowledges the outbox row.
  Failed delivery remains pending across restart; it can never rewrite a
  completed external action or authorize a retry. The outbox is single-host
  SQLite and detects row deletion/corruption, but a coordinated rollback of its
  complete database history still requires an external protected anchor;
  the v2 execution path now closes the gateway-side receipt-loss window with a
  durable dispatch-intent journal, encrypted minimum recovery context, a
  matching client receipt journal, and query-only reconciliation that can
  reconstruct the identical feedback event without redispatch. The included
  loopback fixture implements both roles. Full effect/receipt closure still
  requires each real client adapter to atomically couple its external effect to
  its durable receipt, or to expose an independently idempotent status check;
- a durable HTTP-idempotency wrapper and governed execution facade now bind the
  authenticated subject, `Idempotency-Key`, plan content address, canonical
  input hash, server-derived scopes, status/cancel ownership, and
  `unknown-reconcile-required` behavior. The application composes the preview,
  approval, orchestrator, wrapper, and facade into protected verify, preview,
  approve, execute, status, and cancel routes. Shared contracts and SDK methods
  cover those routes, and governed execution requires an explicit
  `Idempotency-Key` header;
- governed named-client onboarding now composes the JSON transaction engine for
  three code-registered profiles: Claude-compatible and Cursor use
  `mcpServers`, while VS Code uses `servers` with an explicit stdio type. It is
  default-off and lazy; startup validates only the versioned operator
  configuration and does not discover, open, create, or change a client file.
  Protected list/inspect/verify/plan/approve/apply/rollback/recover routes,
  shared contracts, and SDK methods are tenant/subject bound. Approval and each
  filesystem mutation require durable idempotency; mutations additionally
  require an exact one-time approval and durable external-effect reservation.
  Plans and results expose hashes and opaque identifiers only. Apply preserves
  unrelated JSON fields, replay performs no second write, rollback restores the
  exact prior bytes, and an uncertain post-commit outcome requires explicit
  reconciliation. The profiles remain `json-only` and
  `fixture-tested-not-real-client-certified`;
  the versioned server configuration binds all three host-level profiles to one
  exact owner tenant, and every read, plan, approval, mutation, recovery, and
  verification request is rejected before file initialization when the
  authenticated tenant differs. The owner identifier is never returned;
  a dedicated credential-reference-backed onboarding root key is domain-
  separated from HTTP idempotency, provider credentials, and external-effect
  keys. Rotation without receipt/backup migration fails closed and is forbidden
  during the bounded retention window;
- a single-host SQLite onboarding receipt-authority store is now composed into
  the application and governed API for restart-safe tenant/subject-bound,
  one-time rollback
  authorization. It persists keyed identity and receipt/content fingerprints,
  never raw receipts, configuration, paths, commands, arguments, tenant IDs,
  subjects, or bearer tokens. WAL/FULL persistence, row/metadata HMACs,
  clock-rollback detection, bounded retention, exclusive leased claims, and
  monotonic fencing prevent two local processes from consuming the same
  rollback authorization. Apply success and durable replay both idempotently
  record the exact receipt authority. After a gateway restart, the same
  idempotency key can replay the persisted apply without an in-memory plan, and
  the original receipt can create a fresh subject-bound rollback plan. Rollback
  claims are marked only after byte restoration; explicit pre-commit rejection
  releases a claim, while any uncertain post-commit state remains locked for
  reconciliation. The SQLite authority and encrypted backup retention share
  the same bounded TTL;
  startup requires that retention exceed the rollback claim lease by at least
  five minutes, preventing a valid configuration from expiring authority before
  a committed filesystem receipt can be recorded;
- feedback learning can now use an explicit single-host SQLite delivery store.
  It persists only keyed identity/event/task/capability facts, uses WAL/FULL,
  row and metadata HMACs, clock-rollback detection, bounded retention, an
  exclusive lease, and monotonic fencing. The signed client registry writes the
  aggregate update and a keyed event marker in one atomic snapshot before the
  delivery acknowledgement. The marker binds a stable admission generation,
  survives lease reclaim, and is durably removed after acknowledgement; a new
  admission after the dedup TTL cannot be suppressed by an older marker. After
  a crash between those two stores, retrying
  the same event reconciles the marker without applying a second reliability,
  latency, health, or failure sample. Conflicting event reuse is rejected;
  execution enablement now requires this store, and multi-instance use remains
  denied because the store is not distributed. When a configured managed
  client calls the external heartbeat or feedback routes, a per-client PoP
  proof is mandatory: it binds authenticated tenant/subject, current verified
  revision, HTTP method and canonical path, exact raw request bytes, TTL, and a
  one-use nonce. Missing, replayed, stale, cross-client, or tampered proofs fail
  with one non-enumerating error;
- execution readiness is an application-level fail-closed gate. A requested
  real execution cannot start unless route plans, approval/lifecycle, claim,
  external effects, HTTP idempotency, a monotonic registry checkpoint, and a
  non-fake adapter satisfy the required durable/distributed boundary. It also
  requires `rollbackResistant=true` by default; the current registry-only epoch
  can be used only through the explicit
  `AI_GATEWAY_LOCAL_CLIENT_ALLOW_REGISTRY_ONLY_ROLLBACK_DETECTION=true`
  downgrade and must not be represented as production rollback resistance;
- loopback adapter registration is explicit and credential-reference based.
  Endpoint, client identity, manifest digest, and a dedicated hex secret must all
  validate before the adapter is added; the secret is absent from descriptors
  and status output;
- a reusable JSON-only client configuration transaction engine now provides
  redacted content-addressed dry-runs, safe set/delete paths, prototype-pollution
  rejection, cross-process locks, precondition hashes, fsynced backups and
  journals, atomic replacement, exact byte rollback, and explicit crash
  recovery. Named onboarding derives a domain-separated AES-256-GCM backup key
  from its dedicated credential-reference-backed onboarding root secret, never
  from the HTTP idempotency secret; random nonces and AAD bind transaction,
  target, plan, preimage hash, and file identity. Existing client secrets are
  therefore not duplicated into plaintext backups, and obvious credential
  arguments are rejected. Failed pre-journal persistence removes only the
  exact provable orphan backup. Rolled-back/aborted entries compact safely;
  committed backups expire with the receipt-authority TTL, while pending or
  ambiguous entries are never pruned. Canonical path, cross-role containment,
  symlink/junction, and existing target file-identity collisions are rejected
  before independent locks can govern the same storage. It deliberately does
  not claim JSONC/YAML support. The three MCP
  profiles above are its first governed adapters; arbitrary paths, commands,
  args, cwd, environment values, scopes, and digests cannot be supplied through
  an HTTP request;
  application startup also builds a role-aware path graph covering governance
  databases, secret files, targets, journals, backup directories, command/cwd,
  and absolute runtime arguments. Exact paths, existing file identities, and
  symlink/junction components fail closed before a secret file or client target
  can be created or read;
- the client-scoped Provider policy engine filters by data class, provider
  allow/deny, region, capability, cost, latency, health, reliability, quota,
  fan-out, and Fusion before deterministic explainable scoring. The protected
  `POST /local-clients/provider-route` endpoint and shared SDK method resolve
  policy from server configuration and candidates from the live provider
  registry/health facts; request bodies cannot inject those facts, and an exact
  current verified local client is required before inventory or policy is
  revealed. The decision endpoint itself correctly remains pure and reports
  `dispatchPerformed=false`. Separately, PoP-authenticated OpenAI Chat,
  Anthropic Messages, Gemini GenerateContent, and native `/chat` requests for a
  server-bound subject must repeat `unified_ai.local_client_id` and present PoP.
  The gateway converts the pure
  decision into an immutable single provider/model dispatch binding, blocks
  multi-choice/batch amplification, suppresses weighted/shadow substitution,
  removes fallback candidates, and calls `assertAttempt` immediately before
  every actual provider adapter attempt. Response headers expose the policy
  revision, client revision, and decision digest without tenant, subject, or
  secret material. Process-memory replay protection is the fake-provider
  default. Explicit SQLite mode adds an authenticated, restart-durable
  single-host replay set, but it does not resist restoring a complete older
  database snapshot; real-provider managed dispatch therefore remains blocked
  until an external monotonic anchor is composed. Multi-instance mode remains
  blocked until replay protection is distributed. The SQLite guard enforces
  both a global bound and an atomic per-client/key scope bound, so one valid
  managed client cannot consume every replay slot assigned to its peers;

The shared SDK signs and sends one exact JSON byte sequence. Its managed helper
requires an origin-only `baseUrl` and rejects redirects so the proof header and
body cannot be forwarded to another origin:

```js
const gateway = createGatewayClient({
  baseUrl: "http://127.0.0.1:3210",
  headers: { Authorization: `Bearer ${dedicatedClientToken}` },
});

await gateway.managedLocalClientChat({
  model: "policy-selected",
  messages: [{ role: "user", content: "Summarize the active document" }],
  unified_ai: { local_client_id: "desktop.one" },
  providerDispatchKey: "one-stable-visible-ascii-key",
}, {
  secret: clientPopSecretBytes,
  tenantId: "tenant-a",
  subjectId: "desktop-one-service-principal",
  clientId: "desktop.one",
  revision: 2,
});
```

The credential must belong to the dedicated `local_client` principal, not an
admin/operator. Keep the PoP secret out of request JSON, logs, URLs, and client
configuration files; load it from the local credential boundary. The generic
`createManagedLocalClientPopProofHeader` export is available for other exact
HTTP paths, but those routes still require a server-side principal binding and
protocol certification.

Governed adapter execution uses the unreleased loopback `2.0.0` contract:
challenge, verification, action, durable receipt, and governed execution API
are versioned together. `executionId` is covered by the action HMAC, receipt
content address, receipt HMAC, gateway receipt projection, and idempotent result
envelope. There is no downgrade to the earlier receipt shape because it did not
bind the external action to a recoverable execution identity; an older client
must fail its v2 verification handshake before any external-effect reservation
is committed and must be upgraded/reverified.

Gateway composition requires
`AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_STORE_MODE=sqlite`, an explicit
scoped receipt directory, and the stable local-client host identifier. Intent
TTL, reconciliation-query TTL, and recovery grace must each cover the largest
configured loopback timeout plus allowed clock skew and a one-second safety
margin. The receipt directory must not be a filesystem root, another authority
path, or the parent/child of another configured state file. Recovery is bounded,
never redispatches, and a currently failing recovery run degrades health until a
later healthy run clears the consecutive-failure state.

Receipt readiness is fail-closed by default. The current single-host journal
reports `snapshotRollbackProtected=false` and
`clientAtomicEffectReceiptVerified=false`, producing the explicit blockers
`receipt_journal_snapshot_rollback_not_protected` and
`receipt_journal_client_atomic_effect_receipt_unverified`. There is no runtime
environment or request override for either blocker. Credential-free tests use a
private in-process Vitest fixture capability that is absent from the service
entrypoint; its synthetic readiness projection is not evidence for a real
client, real provider, staging, production, or superiority claim.

The registry-integrity credential is a gateway-only authority credential and
must not reuse the bytes of any loopback client credential. Gateway receipt-file
naming, journal integrity, and recovery-context encryption derive through
separate domains from that gateway authority; only the reconciliation wire key
derives from the corresponding client-shared credential. Status exposes only
the immutable booleans `gatewayAuthoritySecretRequired=true` and
`gatewayClientSecretReuseForbidden=true`, never a credential reference,
fingerprint, or derived key.

- an optional autonomous smart-management scheduler is composed into the
  application lifecycle. It is default-off and permanently dry-run-only from
  environment configuration; no automatic-apply variable exists. Versioned
  tenant configuration, bounded concurrency, single-flight rounds, jitter,
  deadline cancellation, per-tenant isolation, exponential backoff, redacted
  events/status, and close-time timer/task draining are enforced. Manual apply
  remains a separate authenticated operator action;
- a credential-free governed HTTP E2E now proves a real loopback fixture flow:
  register -> HMAC verify -> PoP heartbeat/replay rejection -> policy-pinned
  fake dispatch over OpenAI/Anthropic/Gemini/native chat -> immutable preview ->
  exact approval -> durable dispatch intent -> client effect claim -> signed
  durable receipt -> gateway confirmation -> deduplicated automatic feedback ->
  idempotent replay -> subject-bound status. It uses both fixture-client and
  gateway receipt journals plus all configured single-host durable stores, and
  proves the fixture action was dispatched once.
  The fixture explicitly opts into the registry-only rollback downgrade; it is
  not production assurance or certification of Chrome, VS Code, WeChat, or any
  other named external application;
- the authenticated registry now signs an integer generation. Its optional
  single-host SQLite authority checkpoint uses WAL, synchronous FULL writes,
  defensive/trusted-schema hardening, keyed row/metadata integrity, stable
  host/config binding, bounded history, and a two-phase
  `reserve -> fsync/atomic registry replace -> finalize digest` transaction.
  Startup accepts only an exact generation/digest; an older still-valid signed
  registry and an unfinished pending generation both fail closed. Only a
  missing registry plus an uninitialized checkpoint is a valid bootstrap;
- this checkpoint honestly reports `rollbackResistant=false` and
  `rollbackDetectionScope=registry-only unless checkpoint DB also rolled back`.
  An attacker able to restore both local files to the same older snapshot is
  outside its protection. Service-account/OS ACL isolation, a hardware or
  remotely witnessed monotonic anchor, and its independent operational evidence
  remain production threat-model gates;
- a separate Windows-only protected-authority anchor and broker protocol core
  now model the stronger local prerequisite without provisioning it. The core
  is TypeScript with an injected OS port and performs no shell, PowerShell, or
  subprocess calls. It validates service identity, persistent nonce, global
  lock, exact ProgramData/HKLM-64 facts, effective ACLs, HMAC request/response,
  and two-phase `prepare-next -> finalize` transitions; partial dual-store state
  remains divergent and fail-closed. A separate PoP snapshot-protection
  protocol now requires a durable replay mutation intent, authenticated
  generation checkpoint, challenge-bound native attestation, matching
  before/after reads, and an external anchor advancement for every mutation;
  configuration flags or a `rollbackResistant` boolean cannot manufacture its
  evidence. The gateway exposes the unsatisfied native blockers in local-client
  status and keeps real-provider managed dispatch closed. A check-only
  provisioning plan exists, but
  there is still no native Windows OS-port adapter, authenticated IPC transport,
  installed service SID, protected key provisioning, actual ACL/HKLM mutation,
  operational replay-checkpoint coordinator, clean-machine proof, or power-loss drill.
  Its assurance remains `same-user-resistant-if-provisioned`,
  `not-admin-resistant`, and `not-provisioner`, not deployed rollback resistance.

Additional lossless adapters for clients that require JSONC/YAML/TOML or other
formats, MCP/A2A client-principal dispatch binding, real-client adapter
certification, OS/service-account isolation and an independently protected
monotonic revocation anchor, a distributed PoP replay guard, async PostgreSQL
readiness, real-client atomic receipt/reconciliation implementation and
certification, distributed
route-plan/claim/feedback/outbox state, native
Windows broker deployment, full public-clone evidence, long-run soak, and
clean-VM certification remain release gates. Current SQLite stores,
authenticated registry, durable PoP replay guard, feedback outbox, and
scheduler are explicitly single-host authority boundaries.

## Language Selection

- **Workload:** gateway runtime policy, registry state, route planning, and a
  public control-plane contract.
- **Primary path:** `apps/ai-gateway-service`, `packages/shared-contracts`,
  `packages/shared-sdk`, and `apps/agent-console`.
- **Alternative A:** Node.js ESM JavaScript fits the existing application but
  leaves the new public state and execution boundaries weakly typed.
- **Alternative B:** a new Go/Rust service adds deployment and credential-boundary
  complexity without a measured runtime benefit for this local control plane.
- **Chosen language:** TypeScript. It scores highest for repository ecosystem fit,
  public contract safety, testability, and incremental compatibility with the
  current Node runtime.
- **Compatibility/rollback boundary:** retain existing HTTP routes behind
  default-off execution, but treat loopback action/receipt v2 as an explicit
  pre-release breaking cutover. There is no v1 wire downgrade: clients must be
  upgraded and reverified, and rollback requires a coordinated gateway/client
  rollback rather than reusing v2 journal state. `/chat` and ordinary provider
  selection remain unchanged.
- **Policy impact:** fake provider and preview-only execution remain the defaults;
  generated runtime evidence stays under the ignored evidence directory.
- **Quantified risk mitigation:** focused service and HTTP tests, typecheck,
  permission consistency, all package tests, public checks, and credential-free
  public-clone verification are mandatory before publication.

The initial service and adapter registry are now strict TypeScript. The migration
uses neither `ts-nocheck` nor a language-policy exception; shared public DTOs are
imported from `packages/shared-contracts`.

## Required verification sequence

1. Run the focused client service and HTTP tests without `tasklist`, `ps`, real
   providers, or real adapters.
2. Run typecheck and route-permission consistency.
3. Run all repository checks and tests.
4. Run public-repository and clean public-clone verification without credentials,
   with a register-to-route-to-execute-preview assertion and process cleanup.
5. Run a clean Windows VM adapter certification with explicit user approval.
6. Run real-provider staging only under separately scoped authorization.

Only steps 1–4 are credential-free release evidence. Steps 5–6 are required for
named real-client or real-provider claims.
