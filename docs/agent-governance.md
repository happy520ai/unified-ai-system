# Agent Governance Control Plane

The agent governance control plane gives every governed agent a
deterministic permission lifecycle: classification, policy
compilation, per-call enforcement, approvals, expiry and cascade
revocation. It implements the Agent Governance Gateway design adapted
to this repository's TypeScript gateway runtime.

## Core invariant

```
child agent permissions ⊆ parent agent permissions
                      ⊆ creator entitlements
                      ⊆ class capability ceiling
                      ⊆ root policy allowance
```

Models (and agents) can only *propose* drafts. All effective
permissions are computed by `packages/policy-engine` — a pure,
dependency-free TypeScript package whose merge laws are fixed:

| Dimension | Merge law |
|---|---|
| Tool decision | strictest wins: `allow < require_approval < deny`; ungranted tools default to `deny` |
| Capability set | intersection of every expressed ceiling |
| Numeric limits | minimum across layers |
| Expiry | earliest across sources |
| Allowed tenants/resources | intersection |
| Denied resources/fields | union |
| Safety requirements | OR (one requiring layer is enough) |
| Permission booleans | AND with a closed default |

## Layer stack

Baseline layers are seeded into `.data/agent-governance/policies.json`
on first boot and are versioned and immutable per
`(policyKey, version)`:

- `root-policy` — global ceilings, absolute denies, generation limits
- `analysis-family` / `execution-family` — per-family capability ceilings
- `sensitive-data-trait` — output redaction + denied fields
- tenant, domain, subclass and additional trait layers can be added via
  the policy API

Activation supersedes rather than rewrites. Stricter activations
re-tighten affected agents automatically; looser activations never
expand an existing agent — the recompile is clamped to the old grant
and the clamp is audited. Generation, policy creation and activation share
one control-plane mutation boundary. Activation precompiles the complete
change set, writes a durable intent, fences affected runs, releases the
control-plane mutex while those runs drain, then reacquires it and verifies the
same operation before committing. Generation waits for that bounded transition;
other lifecycle mutations fail with an explicit HTTP 409 conflict while the journal is
pending. An unrecoverable compensation leaves the Agent `FAILED`
and fenced with a structured recovery error. A separate HMAC-signed activation
journal persists the old/new catalog binding and complete per-Agent recovery
bundles. On restart it rolls forward unfinished stricter bundles before the
catalog is switched last, so a process crash cannot expose a new catalog with
an old ACTIVE Agent policy. Every terminal activation also advances an anchored,
monotonic catalog operation sequence. A copied older signed journal whose base
sequence no longer matches is rejected, while the exact journal left after a
terminal stamp is only cleared idempotently and never replayed.

Built-in capability additions never rewrite immutable version 1. Fresh state
uses `execution-family@2`. Existing state installs v2 as a draft and activates
it automatically only when the active v1 content hash matches an explicit
allowlist of shipped ZCode/built-in baselines. The normal activation journal
and no-expansion compiler then keep existing Agents from gaining `mcp`,
`workforce_execute`, or `forge_orchestrate`; only newly generated, properly
entitled Agents can request them. Unknown/operator-custom v1 content is never
switched unattended.

## Generation flow

`POST /v1/agents/generate` runs: identity check → classification
proposal (deterministic by default; a `ModelProposer` hook can call the
provider lane later) → tool-risk backfill (registry-declared labels
always win over self-classification) → validator (schema, registration,
sub-agent subset rules, depth/children/expiry ceilings) → compiler →
signed manifest → five-file bundle → central registry → `ACTIVE`. Any
failure leaves no ACTIVE agent, only a `POLICY_REJECTED` audit event.

## Per-agent storage

```
.data/agent-governance/agents/{agentId}/
  agent.json            identity, classification, lifecycle
  policy-delta.json     instance rules + inheritance references
  effective-policy.json compiled permission snapshot
  manifest.json         agent hash + policy hash + HMAC-SHA256 signature
  audit.ndjson          append-only per-agent audit trail
```

All writes are atomic (tmp + rename). JSON is used instead of the
original specification's YAML to stay dependency-free; the five-file
semantics are preserved. The Tool Proxy re-verifies the policy hash and
manifest signature on **every** tool call — tampering with
`effective-policy.json` fails closed and emits
`POLICY_SIGNATURE_FAILED`.

## Runtime enforcement

The Tool Proxy (`src/agent-governance/toolProxy.ts`) is wired into
`toolRegistryEngine.executeTool` and activates whenever a call carries
`agentGovernance` identity (threaded from the HTTP enterprise identity
through the agentic loop into every tool call). Each call re-checks:
agent status, expiry, signature, per-tool decision, tenant/resource
scope and usage ceilings, and emits `TOOL_REQUESTED` plus the outcome
event (`TOOL_ALLOWED` / `TOOL_DENIED`; `APPROVAL_REQUESTED` for gated
calls) into both the central audit stream and the agent's audit.ndjson —
every governed tool call leaves an audit event. `require_approval`
tools halt execution and
create an approval whose arguments are hash-locked (SHA-256 over
canonical JSON) and sealed (AES-256-GCM); approving different arguments
than the agent sent is impossible — changed parameters require a new
approval. The tool list sent to a provider is not trusted as enforcement:
the same frozen per-run allowlist is checked again inside `executeTool`, and
nested tool calls inherit it. Effective `requirements.approvalRequired=true`
upgrades any otherwise-allowed tool to the same reviewable approval path.
`requirements.sandboxRequired=true` is currently rejected when policy content
is created or loaded (`POLICY_SANDBOX_ATTESTATION_UNAVAILABLE`). The Tool Proxy
already understands non-serializable, one-shot sandbox capabilities, but no
runtime lane may activate the requirement until it can bind a fresh attested
isolation backend to the exact effect. Host execution and request parameters
cannot self-attest.

`maxRecords` is enforced against trusted server-side result contracts after a
tool returns and before its output reaches the model. `grep` records are
counted and safely truncated; `glob` results are replaced when over the
remaining cumulative ceiling. A successful tool without a trusted result
contract is fail-closed whenever `maxRecords` is configured. Count-like fields
reported by a tool or model are never trusted.

Approvals are one-shot. Public approval records contain a server-produced,
allowlisted review DTO while raw arguments remain AES-256-GCM sealed. An
unreviewable request cannot be approved. The first enabled external-effect
tools are `git_push` and `git_create_pr`: their envelopes bind repository and
remote fingerprints, source branch and exact commit, destination/base, safe
options, and the complete bounded PR title/body visible to the approver. Fetch
and push targets must canonicalize to the same repository; mismatches and
secret-like publication text are unreviewable. Retry execution uses the
decrypted approved envelope,
not the model's retry object. A changed HEAD, branch, remote URL, policy hash or
PR input makes the old approval stale. Pushes use the sealed canonical target,
not a mutable Git remote alias. PR creation first publishes the exact approved
commit to a deterministic controlled head, confirms that remote head, and passes
the controlled name explicitly to `gh --head`. Governed force push and implicit
upstream mutation remain disabled. Once controlled-head publication or `gh`
dispatch begins, a transport failure is reported as `outcomeUnknown` with a
reservation fingerprint and reconciliation guidance, never as an ordinary safe
retry.

Governed Git publication currently accepts sealed HTTPS remotes and canonical
local `file:` fixtures. SSH/scp remotes are deliberately unreviewable because
OpenSSH user configuration (`HostName`, `ProxyCommand`, and related routing)
cannot yet be isolated and sealed into the approval envelope. They fail before
the durable external-effect fence or any transport command is invoked.

Identical unexpired PENDING requests (tenant, Agent, tool, policy, arguments and
review) coalesce to one approval ID. Per-Agent and per-tenant pending caps stop
approval floods; the durable store is size-bounded and compacts old terminal
records after retention while preserving all live PENDING/APPROVED records.

Reverse MCP calls use the same canonical Tool Proxy decision under tool name
`mcp`. While governance is enabled, `POST /mcp/call` requires `agentId`; the
runtime binds tenant, user and owner from the authenticated enterprise identity,
then preserves the MCP server/tool tenant, role and allowlist checks. The policy
parameters lock `{serverName, toolName, args}`. Approval retries execute the
authenticated decrypted store copy, never the retry body. The Agent run lease
fingerprint and active assertion are carried into the durable MCP external-effect
reservation, so revoke or policy activation fences the upstream call before its
effect boundary. Both the Tool Proxy lease and Agent run lease are released on
every outcome. MCP results have no trusted record descriptor, so a configured
`maxRecords` ceiling replaces the result rather than exposing an unmetered value.
For mutation tools, any exception after upstream dispatch is likewise marked
`MCP_EXTERNAL_EFFECT_OUTCOME_UNCERTAIN`; operators must reconcile the returned
reservation fingerprint and must not mint a new effect key blindly.
The HTTP request deadline/disconnect signal is combined with the Agent run and
tool leases and reaches Streamable HTTP, stdio, and OpenAPI upstream transports.
Cancellation before dispatch stays pre-effect; cancellation after a mutation
attempt starts remains outcome-unknown and non-retryable.

`POST /workflow/run` is a separate controlled local-artifact sink. With Agent
Governance enabled it requires `agentId` and authorizes canonical `file_write`
through the Tool Proxy before retrieval or publication. Tenant and owner are
server-bound. Artifacts live under a server-owned SHA-256 tenant partition and
publish from an exclusive staged inode through an atomic hard-link operation;
an existing filename, symlink, or hardlink is never overwritten and name
collisions receive a bounded version suffix. The managed MCP server creates one
ephemeral `file_write` Agent and injects it into `workflow_run`; an external MCP
gateway caller must provide its own Agent ID. With governance disabled, the
legacy permission-scoped workflow route remains available, but the same tenant
partition and no-overwrite publication rules still apply.

`POST /workforce/execute` is governed under canonical tool name
`workforce_execute`. When Agent Governance is enabled, the request must include
the server-issued root `agentId`; tenant and user always come from the
authenticated enterprise identity. The server authorizes the Agent run, sends
  the canonical bounded goal, plan and goal digests, and bounded execution
  options through the Tool Proxy. Approval-gated retries rebuild the reviewed
  goal, plan identity and autonomy mode from the encrypted one-shot envelope,
  and still require Workforce's existing exact `planDigest`, subject-bound,
single-consume execution approval before real role execution. No second or
argument-blind approval path is introduced.

The effective policy's dedicated `maxWorkforceRoles` ceiling bounds total role
count independently from `maxChildrenPerAgent` (which continues to govern real
`agt_*` child creation); remaining steps, runtime and concurrency are also
bounded. Every role atomically reserves one step before it starts. Trusted
role context carries separate `roleId` and `governedAgentId` fields; a Workforce
role never impersonates an `agt_*` identity. External-effect checks prove both
the task-claim fence and Agent run fence. Revocation aborts the shared DAG signal
and execution drains before leases are released. Results re-enter Tool Proxy
result enforcement before the HTTP response.

`POST /forge/orchestrate` also requires a server-bound root Agent while
governance is enabled. The top-level `forge_orchestrate` decision holds a tool
lease for the run, and every model-produced `read`, `write`, `edit`, structured
`diff`, or `bash` action receives a fresh decision before any file or command
effect. Forge `diff` maps to write-capable `file_edit`, never read-only
`git_diff`; approved parameters replace the retry object, and the action lease
is held through result enforcement. Revocation propagates through Gateway,
Forge, Orchestrator, Worker and sandbox signals, then drains the current batch.

When the top-level `forge_orchestrate` decision requires approval, the server
returns HTTP 202 plus `approvalId` and exposes a complete bounded review of the
goal and sanitized orchestration options. The review is hash-bound to the
sealed retry parameters; secret-like or unsafe goal text is unreviewable.
Per-action Forge approvals are intentionally not implemented yet: if a policy
changes `file_read`, `file_write`, `file_edit`, or `shell_exec` to
`require_approval`, that action fails closed before any effect because a safe
complete review DTO for arbitrary file content, diffs, and commands is not yet
available. The approved-parameter replacement statement above applies to the
top-level orchestration approval only.

Governed Forge disables implicit codebase scanning, context and cross-session
memory reads, auto-lint, refinement, self-review/auto-fix, verification and
checkpoint effects, and non-BaseWorker media workers. The model must request
explicit governed actions. Direct standalone `Forge.run` remains a
development-compatible package API, not a production Agent-governed entrypoint.
`AI_GATEWAY_FORGE_WORKING_DIRECTORY` may select one existing absolute trusted
workspace from server configuration; request JSON cannot select a path and runs
against that workspace are serialized. Without it, Forge uses a disposable OS
temp workspace and removes it after the response. Even for a configured trusted
workspace, every run receives a tenant-fingerprinted OS-temp TaskStore database;
Forge never accumulates a shared `forge-tasks.sqlite` in the real workspace.
Run history and result summaries have TTL/cap bounds. Working and semantic
memory share one per-tenant entry/byte LRU, so an eviction or TTL expiry removes
the same ID from both indexes. Close/delete failures are retained as bounded run
cleanup status and an aggregate status counter; temp paths are never exposed.

MCP approvals are reviewable only when an operator explicitly declares every
top-level scalar field that may be shown for that exact tool (zero-argument tools
need no field declaration). For example, one server entry in
`MCP_UPSTREAM_SERVERS_JSON` may contain:

```json
{
  "id": "notifications",
  "transport": "http",
  "url": "https://mcp.example.test/mcp",
  "allowedTools": ["send_message"],
  "approvalReviewFields": {
    "send_message": ["channel", "recipient"]
  }
}
```

The configured fields must cover every supplied argument and every displayed
value must be a bounded scalar or null. Nested values, missing declarations and
sensitive field names such as credentials, tokens, authorization, passwords or
keys make the request unreviewable and keep the upstream call at zero. Full
arguments stay encrypted in the one-shot approval store; the public DTO contains
only the completely reviewed scalars plus target and argument fingerprints.

Agent Governance is an explicit opt-in. With
`AI_GATEWAY_AGENT_GOVERNANCE_ENABLED` unset or `false`, the existing Agent Exec,
reverse-MCP, Workforce and Forge request contracts remain unchanged. Setting it
to `true` enables the whole plane; those execution-bearing routes then require
the server-bound Agent identity documented above.

High-risk tools are default-off and use an exact startup allowlist:

```text
AI_GATEWAY_AGENT_GOVERNANCE_HIGH_RISK_TOOLS=git_push,git_create_pr
```

Unknown names fail startup; this setting never enables `shell_exec`,
`code_run`, or `web_fetch`. A configured high-risk request is rejected before
the provider call unless the durable external-effect gate is healthy and the
server-owned Agent run lease can prove the Agent is still `ACTIVE` on the same
policy. `AI_GATEWAY_AGENT_EXEC_WORKING_DIRECTORY` may select a trusted existing
workspace at startup; it is not accepted from the HTTP request, and governed
tool paths may not escape it.

Expensive governed routes also have independent request-rate and in-process
concurrency admission. Built-in concurrency caps cover Agent Exec, reverse MCP,
controlled Workforce, Forge orchestration, Agent generation and policy
activation; every cap includes a smaller per-tenant ceiling. Operators may
override them with `AI_GATEWAY_ROUTE_RATE_LIMITS` and
`AI_GATEWAY_ROUTE_CONCURRENCY_LIMITS`. Saturation returns HTTP 503 with
`route_concurrency_limited` and `Retry-After: 1`; it never queues an unbounded
amount of provider or control-plane work.

## API

| Route | Permission | Purpose |
|---|---|---|
| `POST /v1/agents/generate` | `workflow:run` | Generate a governed agent |
| `GET /v1/agents/list` | `dashboard:read` | List tenant agents |
| `GET /v1/agents/describe?agentId=` | `dashboard:read` | Registry record |
| `GET /v1/agents/effective-policy?agentId=` | `dashboard:read` | Agent-facing policy view (no lineage/scope internals) |
| `GET /v1/agents/audit?agentId=` | `audit:read` | Per-agent audit trail |
| `POST /v1/agents/revoke` | `workflow:approve` | Revoke (cascade by default) |
| `POST /v1/approvals/decide` | `workflow:approve` | Approve/reject locked-argument approvals |
| `GET /v1/approvals/list` | `dashboard:read` | Pending approvals |
| `POST /v1/policies/create` | `user:admin` | Create an immutable policy version |
| `POST /v1/policies/activate` | `user:admin` | Activate a version + recompile affected agents |
| `GET /v1/policies/list` | `audit:read` | Catalog listing |
| `GET /v1/governance/stats` | `dashboard:read` | Counts by status |

Example:

```bash
export PME_AUTH_TOKEN="replace-with-your-enterprise-token"
curl -X POST http://localhost:3917/v1/agents/generate \
  -H "content-type: application/json" \
  -H "authorization: Bearer $PME_AUTH_TOKEN" \
  -H "x-pme-tenant-id: tenant_a" \
  -d '{
    "name": "refund_analyzer",
    "task": "分析最近一个月退款异常并生成报告",
    "requestedTools": ["file_read", "grep", "git_log"],
    "ttlSeconds": 3600
  }'
```

Use the returned `agentId` for execution. The identifier is accepted only
after the server binds it to the authenticated tenant and owner:

```bash
curl -X POST http://localhost:3917/agent-exec/run \
  -H "content-type: application/json" \
  -H "authorization: Bearer $PME_AUTH_TOKEN" \
  -H "x-pme-tenant-id: tenant_a" \
  -d '{
    "agentId": "agt_REPLACE_WITH_RETURNED_ID",
    "goal": "分析退款报告",
    "toolMode": "none",
    "maxIterations": 4
  }'
```

All governance state lives under gitignored `.data/agent-governance/`.
The HMAC secret comes from `AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY` or is
generated once into `.data/agent-governance/secret.key` (mode 0600);
it is never logged or returned by any API.
On Windows the runtime replaces inherited ACLs and grants access only to the
service identity, SYSTEM and Administrators; failure to establish that ACL
blocks startup. `AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR` is resolved from the
repository root when relative, so different launch entrypoints share one state.

The current durable JSON backend is intentionally single-process. When
`AI_GATEWAY_MULTI_INSTANCE=true`, governance stays disabled unless explicitly
enabled; explicitly combining both settings fails startup until a transactional
shared governance backend is available.

Creating the HTTP runtime atomically acquires
`.data/agent-governance/owner.lease.json`. The file contains only a process ID,
OS-verifiable process creation-time fingerprint, acquisition timestamp, runtime
marker and random ownership identifier; it never contains the governance
secret. Linux uses the kernel process start tick, Windows uses the process start
time ticks, and other POSIX runtimes use the process start time reported by
`ps`. A second gateway runtime pointed at the same data directory fails startup
while the exact recorded process instance is alive. A reused PID with a
different creation-time fingerprint is not mistaken for that owner. Normal
server resource shutdown releases the lease. Governance and Agent execution
HTTP routes also assert that the runtime still owns the exact token before
dispatch. After an abnormal exit, the next startup removes the stale file only
when the recorded process instance is definitely absent or the PID now has a
different creation-time fingerprint; malformed, changed, legacy-version or
unverifiable lease metadata blocks startup for manual inspection. This fence
does not make the JSON backend multi-process or distributed.

Every governance JSON file and the central audit stream are also bound to a
signed local state anchor plus an independently signed checkpoint. Each commit
advances a monotonic revision and uses an authenticated write-ahead record with
the old head, new head and full target bytes. Restart recovery accepts only the
authenticated old or new state and rolls forward; deleting a store, restoring
a valid older snapshot, truncating the audit tail, or rolling back only one
anchor head fails closed. A genuinely empty directory bootstraps automatically,
but the presence of any canonical governance store while anchor, checkpoint and
installation marker are all absent fails closed rather than being accepted as a
new deployment. Pre-anchor migration is available only through an explicit
migration-only binding option that is disabled by default, and still requires
every existing canonical store to be registered and pass its full semantic or
cryptographic validator.

The central audit JSONL is a bounded sequence of independently signed segments.
At the active segment ceiling, the complete old segment remains readable and a
new segment begins with a public `AUDIT_CHECKPOINT` event containing the prior
file digest/head, retained archive segment/record/byte totals and cumulative
`compactedRecordCount`. The Agent audit API includes the latest checkpoint even
when a small event limit would otherwise hide it, and `truncated=true` explicitly
reports that configured retention or capacity removed detailed history.
Completed segments are removed only as whole verified units. Archive segment
count, total archive bytes and retention age all have hard configurable bounds;
the logical sequence remains monotonic when an expired prefix is removed, while
the state anchor binds the exact retained file and head. This remains bounded
local retention, not an external WORM archive; deployments that must retain every
detailed event must export segments/checkpoints to protected append-only storage.

This is a same-host rollback detector, not an external trust anchor. An
administrator who rolls back the complete directory together — canonical state,
secret, signed anchor, checkpoint, installation marker, and any pending journal —
remains outside the local-only proof boundary. Remote or hardware-backed anchoring
is required to detect that physical-administration scenario.

## Test coverage

- `packages/policy-engine/src/mandatoryTests.test.ts` — the
  deterministic merge/validation laws, numbered to the specification's
  mandatory test list.
- `apps/ai-gateway-service/src/agent-governance/agentGovernanceService.test.ts`,
  `agentGovernanceLifecycleConsistency.test.ts` and
  `agentRegistryStore.atomic.test.ts`
  — runtime lifecycle: generation bundle, immutable versions, tamper
  detection, expiry, approval locking, usage ceilings, atomic cascade
  revocation, bounded drain/lock ordering, ancestor lifecycle defense,
  activation replay rejection, no-expansion recompilation and the registry seam.
- `apps/ai-gateway-service/src/http/agentGovernanceRoutes.e2e.test.ts` — real
  authenticated HTTP lifecycle, server-bound file reads, owner lease conflict,
  safe approval review and a one-shot `git_push` into a temporary local bare
  remote (no network or credentials).
- `apps/ai-gateway-service/src/agent-governance/governedGitApproval.test.ts` —
  HEAD/remote stale detection, public review redaction and fake-runner PR
  execution with explicit repo/head/base.
- `apps/ai-gateway-service/src/agent-governance/governedRecordMeter.test.ts` and
  `governedRecordIntegration.test.ts` — adversarial result shapes and cumulative
  real-tool `maxRecords` enforcement.
- `apps/ai-gateway-service/src/mcpGateway/governedMcpExecution.test.ts` and
  `apps/ai-gateway-service/src/http/httpServerRoutes03.mcpGovernance.test.ts` —
  server-bound MCP identity, real encrypted one-shot approval, parameter locking,
  revoke fencing, non-blind review fields and fail-closed result metering.
- `apps/ai-gateway-service/src/workforce/workforceGovernedRoutes.test.ts`,
  `workforceGovernedExecutor.test.ts` and `workforceTaskClaims.test.ts` —
  root Agent binding, plan-digest admission, dedicated role ceilings, step
  reservations, revocation drain, role/Agent identity separation and dual
  task-claim plus Agent-run fences.
- `apps/ai-gateway-service/src/forge/forgeGatewayService.test.js` and the Forge
  core security suite — root Agent route binding, deny-with-zero-effect,
  write-capable diff mapping, approval-sealed parameters, lease lifetime,
  revocation drain and governed-mode implicit-I/O shutdown.
- `apps/ai-gateway-service/src/workflow/governedWorkflowExecution.test.ts`,
  `localWorkflowService.test.js`, and `workflowGovernanceHttp.e2e.test.ts` —
  Agent-bound `file_write`, cancellation/lease cleanup, tenant partitioning,
  hardlink-safe no-overwrite publication, and real HTTP behavior.

## Deliberate scope (v0.8 landing)

- Enforcement converges the registry lane (agent tool registry + agentic loop),
  reverse-MCP calls, the controlled DAG path of `POST /workforce/execute`, and
  the gateway `/forge/orchestrate` per-action path, plus the controlled local
  artifact sink at `POST /workflow/run`.
  Workforce `run-local` and A2A execution remain outside this slice. Governed
  `sandbox-merge` and `sandbox-merge-auto` are explicitly denied until every
  commit/merge sink can assert the Agent run fence immediately before effect;
  legacy behavior with Agent Governance disabled is unchanged. Standalone
  Forge package/server APIs remain development-only rather than evidence of a
  gateway-governed production execution path.
- The model-based classification proposer is an injected hook
  (`ModelProposer`); the default is deterministic, keeping the
  credential-free default intact.

## Language Selection

Workload: deterministic policy calculus (merge algebra, validation,
compilation, hashing) plus gateway-runtime stores and enforcement.
TypeScript was selected because the enforcement point
(`toolRegistryEngine.executeTool`) runs in the Node.js gateway process
and the security property "every governed call passes the proxy in
process" cannot tolerate a cross-language hop. Alternatives considered:
a separate Python service (the original specification's stack) —
rejected because it adds a runtime boundary that would itself become a
bypass surface and a second operational surface; Go/Rust sidecar —
rejected for the same reason with no performance need (hashing and
set-intersection are microsecond-scale). Rollback: the control plane is
additive and feature-flagged (`AI_GATEWAY_AGENT_GOVERNANCE_ENABLED`);
the flag is default-off so legacy callers are untouched until an operator opts
the runtime into the governed route contracts. Compatibility: new workspace package
`@unified-ai-system/policy-engine` (pure functions, no new third-party
dependencies), new route group, new gitignored data directory.
The owner fence remains TypeScript in the same Node.js lifecycle so acquisition
is synchronous before HTTP runtime construction, uses only built-in filesystem
and process APIs, and adds no sidecar or compatibility boundary. Rollback is the
same governance feature flag; removing the fence alone is not a supported
multi-process mode.
