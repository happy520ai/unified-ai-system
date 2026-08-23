# Gateway Security and Release Audit - 2026-08-19

## Executive conclusion

The reviewed branch now fails closed across the confirmed authentication, tenant,
outbound-network, provider-control, agent-tool, MCP, credential-storage, and logging
boundaries covered by this audit. No known open critical or high-severity finding
remains in that reviewed scope.

This is not a claim that the gateway is unbreakable or production-ready. The
evidence is local, credential-free, and fake-provider based. Independent penetration
testing, real-provider staging, multi-host failure testing, and long-duration capacity
testing remain release evidence gaps.

## Scope and method

- Runtime entrypoints, HTTP and WebSocket dispatch, route permissions, identities,
  tenant propagation, caches, knowledge stores, and enterprise state.
- Provider onboarding and outbound requests, redirects, DNS resolution, image input,
  MCP transports, child processes, and agent tools.
- Runtime credential persistence, logs, metrics, backup validation, local files,
  SQLite modes, CI workflows, dependency policy, and container defaults.
- Adversarial regression, full workspace tests, public-tree checks, clean public-clone
  verification, dependency audit, latency benchmark, and short resource soak.
- No provider credential was read or supplied. No real-provider request was made.

## Confirmed findings and remediation

| ID | Original severity | Finding | Remediation and current disposition |
| --- | --- | --- | --- |
| GW-SEC-01 | Critical | Authentication disabled by missing configuration produced a wildcard local admin. | Non-loopback binding now requires authentication and startup fails closed. Anonymous privileged access is rejected. Fixed. |
| GW-SEC-02 | Critical | SSRF policy compared hostname strings and was bypassable through DNS rebinding, alternate IP syntax, mapped IPv6, metadata names, and redirects. | Outbound destinations are resolved, every address is classified, the approved IP is pinned into the connection lookup, and redirects are not followed. Remote multimodal URLs are rejected. Fixed. |
| GW-SEC-03 | High | Content guardrails were disconnected and later skipped client-supplied system/assistant content and retrieved knowledge. | Guardrails are in the gateway execution path and cover system, user, assistant, tool, and retrieval-derived content with canonicalization and bounded scanning. Fixed for the tested signatures; semantic resistance remains a residual limitation. |
| GW-SEC-04 | High | Provider and model mutation permissions had read/write ambiguity and unknown-route wildcard exposure. | Mutation routes require write privileges, unknown routes fail closed, and route declarations are checked against active dispatchers. Fixed. |
| GW-SEC-05 | High | Tenant headers and audit filters could be used to target another tenant, including from an admin identity. | Tenant identity is derived from the authenticated principal; cross-tenant headers, audit queries, exports, virtual-key operations, backup validation, and restore validation are rejected. Fixed. |
| GW-SEC-06 | High | Shared cache, knowledge, file context, usage, logging, and metrics surfaces could cross tenant boundaries. | Tenant identity is part of storage/cache keys and read filters; caller-bound filtering is enforced at HTTP surfaces. File-context and history collections are bounded. Fixed in the reviewed single-process paths. |
| GW-SEC-07 | High | Tenant administrators could mutate globally shared provider/model state. | Global provider/model mutations require the configured platform tenant in addition to route authorization. Fixed. |
| GW-SEC-08 | High | Agent shell, code execution, and outbound fetch tools could be registered without an explicit execution authority. | High-risk tools are absent by default and require explicit opt-in plus an object permission checker exposing `check()`. Permission-bearing results are excluded from shared caching. Fixed. |
| GW-SEC-09 | High | MCP and upstream transports needed stronger identity, environment, and response boundaries. | Tool, tenant, and role allowlists default deny; child environments are restricted; HTTP/stdio payloads and stderr/stdout are bounded; upstream readiness hides endpoints; outbound OpenAPI responses are capped. Fixed for tested transports. |
| GW-SEC-10 | High | Runtime provider credentials could persist as plaintext in local file or SQLite modes. | Persistence now requires an explicit 32-byte master key and AES-256-GCM per-record sealing with provider-bound AAD. Plaintext v1 data fails closed unless one-time migration is explicitly enabled. Key rotation, tamper rejection, atomic rewrite, rollback-on-persist-failure, and private file modes are covered. Fixed. |
| GW-SEC-11 | Medium | Request and structured logs could retain secrets, bodies, paths, or unbounded data. | Recursive central sanitization, token/key/query redaction, bounded depth/size, body logging off by default, tenant-filtered reads, rotation, retention, private modes, and listener cleanup are enforced. Fixed for tested patterns. |
| GW-SEC-12 | Medium | Session and persistence helpers had unbounded or weakly protected local-resource behavior. | Session counts, entry sizes, file sizes, and mutation concurrency are bounded; writes are atomic and private where supported. Fixed for reviewed local modes. |
| GW-SEC-13 | Medium | CI action references and dependency maintenance needed stronger supply-chain controls. | Relevant actions are commit-SHA pinned, base-ref handling is quoted and environment-bound, Dependabot is weekly, supported security versions are explicit, and production dependency audit is clean. Fixed. |
| GW-SEC-14 | High | Portable enterprise backups were plaintext JSON without cryptographic integrity, trusted sequencing, or rollback detection. | Version 3 payloads are encrypted with AES-256-GCM, manifests and checkpoints are Ed25519-signed with independently derived keys, tenant/version/sequence/digest metadata is authenticated, old plaintext fails closed, and local rollback floors are enforced. Fixed for artifact protection and local validation; an external immutable sequence anchor and destructive restore drill remain release evidence. |

## Defense evidence

### Required release gates

| Gate | Result | Evidence summary |
| --- | --- | --- |
| `pnpm check` | Pass | 651 gateway files; language policy pass; supply-chain configuration pass; 81 permission declarations; 134 active routes; 18 governed outbound integrations. |
| `pnpm test` | Pass | Gateway: 994 passed and 11 skipped; Forge: 2680 passed; all other workspace package suites completed successfully. |
| `pnpm check:public` | Pass | 1,772 candidate files scanned with zero issue codes after removing credential-like test literals and machine-specific paths. |
| `pnpm verify:public-clone` | Pass | All reported clean-clone checks passed, fake-provider remained mandatory, real-provider calls were zero, ephemeral auth was not exposed, and managed processes were cleaned up. |

### Security and supply-chain checks

- `node tools/security-attack-regression.mjs`: `SECURITY AUDIT: ALL DEFENDED`.
- Exercised public health minimization, cache tenant isolation, tenant-header forgery,
  audit filtering, global provider mutation, role enforcement, budget/rate limits,
  key revocation, secret-cache exclusion, MCP authorization, and metrics access.
- `pnpm audit --prod --audit-level low`: no known vulnerabilities.
- Focused security regression set passed before the complete workspace suite.

### Performance and resource evidence

The following numbers describe this Windows host, Node v24.19.0, the CI workload,
and the local fake provider only. They are not a comparison with another gateway.

| Measurement | Result |
| --- | --- |
| Non-streaming workload | 80/80 successful, 0% error, p95 31.93 ms, p99 47.19 ms, 284.8 requests/s. |
| Streaming workload | 80/80 successful, first-content p95 58.82 ms, total p95 169.56 ms, 50.95 requests/s. |
| Fault isolation | Malformed JSON returned 400, oversized input returned 413, valid traffic and health recovered. |
| Resource soak | 1,200/1,200 successful at target 100 RPS, no client drops, 0% error. |
| Heap | Median growth 10,661,096 bytes (17%), within the 32 MiB/50% gate. |
| RSS | Median growth 27,136,000 bytes (17%), within the 64 MiB/50% gate. |
| Event loop | Maximum utilization 0.284; maximum observed p99 delay 0.0321 seconds. |
| Cleanup | Managed gateway cleanup passed in both benchmarks. |

## Residual risks and explicit release boundaries

| Risk | Current assessment | Required next evidence |
| --- | --- | --- |
| Semantic prompt injection | Signature and normalization defenses reduce known attacks but cannot prove semantic intent safety. | Independent adversarial corpus, model-assisted policy evaluation, tool-action taint tracking, and measured false-positive/false-negative rates. |
| Backup portability | Portable artifacts now use authenticated encryption, signed manifests, tenant/version binding, chained digests, signed local checkpoints, and configurable external rollback floors. The gateway still validates rather than destructively restoring data, and a whole-host rollback can include an older valid local checkpoint. | Anchor the minimum sequence in an external monotonic or immutable control plane and execute destructive restore drills in isolated staging. |
| Multi-host consistency | File and Node SQLite modes are same-host mechanisms, not a distributed consistency design. | Shared transactional stores, distributed rate/idempotency tests, failover, partition, and split-brain exercises. |
| Container immutability | Runtime is non-root and safe by default, but `/app` remains writable for current demo compatibility. | Read-only root filesystem, dedicated writable mounts, dropped capabilities, and deployment-policy enforcement. |
| Long-duration resources | The 12-second CI soak catches regressions but does not prove leak freedom or production capacity. | Repeated 6-24 hour staging soaks, real workload mixes, concurrency ramps, and capacity envelopes. |
| Real providers | This audit intentionally made zero credentialed provider calls. | Isolated staging with scoped test credentials, egress allowlists, provider contract tests, and cost ceilings. |
| Independent assurance | The evidence was produced by repository-local tooling and this review. | External penetration test, threat-model review, reproducible third-party benchmark, and signed release attestation. |

## Language Selection

**Workload:** Security policy enforcement, bounded local persistence, runtime integration,
adversarial tests, and release automation for the existing Node gateway.

**Primary path:** `apps/ai-gateway-service/src/security`, gateway integration modules,
co-located tests, and `tools/security-attack-regression.mjs`.

| Candidate | Domain fit | Maintenance | Operability | Safety | Migration debt | Ecosystem fit | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| TypeScript for new policy modules | 5 | 5 | 5 | 5 | 5 | 5 | 30 |
| Node.js ESM JavaScript for all new code | 5 | 3 | 5 | 3 | 5 | 5 | 26 |
| Rust or Go sidecar | 3 | 2 | 2 | 5 | 1 | 2 | 15 |

**Chosen language:** New reusable security boundaries are TypeScript for typed inputs,
explicit decisions, and direct Vitest coverage. Existing JavaScript runtime modules
receive narrow compatibility integrations rather than a high-risk wholesale migration.
The release/attack tool remains Node.js ESM JavaScript as required for `tools/*.mjs`.

**Compatibility/rollback boundary:** Each policy is injected at an existing boundary
and can be rolled back with its integration and colocated tests. Persisted credential
format changes are intentionally fail closed; rollback requires retaining an encrypted
backup and must never silently downgrade to plaintext.

**Policy impact:** Fake-provider remains the credential-free default. Public protocol
shapes are preserved. Security evidence is generated outside the committed product tree.

**Quantified risk mitigation:** Full tests, static route/outbound checks, public checks,
clean-clone verification, dependency audit, adversarial regression, SLO benchmark, and
resource soak all pass in the evidence snapshot above.

## Release decision

The reviewed change set is eligible for another adversarial test round and for review
on its development branch. Production promotion remains blocked on the residual evidence
items above, especially independent penetration testing, real-provider staging, and
multi-host/long-duration validation.
