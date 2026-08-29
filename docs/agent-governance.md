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
and the clamp is audited.

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
approval.

Legacy callers without governed identity are untouched;
`AI_GATEWAY_AGENT_GOVERNANCE_ENABLED=false` disables the whole plane.

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
curl -X POST http://localhost:3917/v1/agents/generate \
  -H "content-type: application/json" \
  -H "x-user-id: user_1" -H "x-tenant-id: tenant_a" \
  -d '{
    "name": "refund_analyzer",
    "task": "分析最近一个月退款异常并生成报告",
    "requestedTools": ["file_read", "grep_search", "git_log"],
    "ttlSeconds": 3600
  }'
```

All governance state lives under gitignored `.data/agent-governance/`.
The HMAC secret comes from `AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY` or is
generated once into `.data/agent-governance/secret.key` (mode 0600);
it is never logged or returned by any API.

## Test coverage

- `packages/policy-engine/src/mandatoryTests.test.ts` — the
  deterministic merge/validation laws, numbered to the specification's
  mandatory test list.
- `apps/ai-gateway-service/src/agent-governance/agentGovernanceService.test.ts`
  — runtime lifecycle: generation bundle, immutable versions, tamper
  detection, expiry, approval locking, usage ceilings, cascade
  revocation, no-expansion recompilation and the registry seam.

## Deliberate scope (v0.8 landing)

- Enforcement converges the registry lane (agent tool registry +
  agentic loop). The forge, workforce and reverse-MCP lanes keep their
  existing gates and adopt the proxy in follow-up phases; none of them
  can silently bypass it because they do not execute governed-agent
  tool calls through this registry.
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
legacy callers are untouched. Compatibility: new workspace package
`@unified-ai-system/policy-engine` (pure functions, no new third-party
dependencies), new route group, new gitignored data directory.
