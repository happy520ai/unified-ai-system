# Security review conclusion — 2026-10-24

Scope: repository-wide local heuristic scan (`pm-mcp audit_security`,
exposure=network), run as part of the production-readiness program (T-175).
This is an internal self-audit, not a third-party penetration test; its
conclusion is bounded by what a local heuristic scanner can see.

## Result

- High findings: **0**
- Open findings after disposition: **0** (was 28 medium, all disposed below)
- Findings disposed as **accepted** with recorded rationale: **28**
  - 1 × `secret.generic-assignment` (SEC-581): a synthetic
    `sk-test-secret-value` fixture in `credentialPool.test.ts` whose assertion
    is exactly that the key fingerprint must not contain the original key. The
    assignment is the security test itself, not a credential exposure.
  - 27 × `danger.innerhtml` (SEC-582…SEC-608): every `taste-router/public/app.js`
    site was re-checked point by point this session; interpolations go through
    the `esc()`/`escC()` entity-escaping helpers, the remaining unescaped
    interpolations are computed numbers and literals. The file is the static
    Qloo hackathon demo page: no credentials, no backend write surface.
- Previously accepted risks re-detected as noise: 377 (accepted ≠ immune;
  they remain on the ledger with their original rationale).

## Supporting drills run for real on 2026-10-24

Both drills are local-only and fake-provider by design (`realProviderCallsMade:
false`); artifacts live in the ignored evidence directory
`apps/ai-gateway-service/evidence/production-readiness-2026-10-24/`.

- `drill:gateway-circuit` — status `recovered`: closed → tripped open by two
  injected provider failures (`/healthz` 503 while open) → half-open → closed,
  on a live Gateway process.
- `drill:postgres-recovery` — status `recovered` on a real `postgres:17-alpine`
  instance: source destroyed before restore, controlled logical snapshot plus
  bounded-LSN PITR (`pointInTimeRecoveryProved: true`), zero fixture rows lost,
  controlled recovery 4.9 s, controlled failover 10.5 s, client continuity held
  across restart and endpoint switch. Honest boundary: continuous-WAL recovery
  was not proved in this run (`continuousWalRecoveryProved: false`).

## Real-provider findings (owner-authorized, 2026-10-24)

With explicit owner authorization to use the local key-pool proxy, one real
provider call was made (model `glm-5.3-flash`, 34 tokens, HTTP 200, exact
prompt-echo assertion passed; no credential material appears in any output —
scanned and redacted at capture time). Two findings resulted:

1. **Governance-gate regression found and fixed.** The first real-mode smoke
   was blocked with `REAL_PROVIDER_EXECUTION_BLOCKED` even though every
   real-provider gate was enabled by environment. Root cause: commit
   `814aa817` (the 2026-10-20 assembly-root mechanical split) extracted the
   provider runtime factory and dropped `providerExecutionConfig` from its
   return; the caller's destructure yielded `undefined` and the object spread
   silently no-oped, so the gateway service's runtime config lost
   `providerMode`, `realProviderEnabled` and `enabledProviders` and the
   execution gate classified every call as fake-path-blocked. Fake-mode tests
   bypass the gate and the CI real-provider smoke skips without credentials,
   which is why the suite stayed green. Fixed in
   `createGatewayProviderRuntime`, locked by a regression test in
   `createGatewayApplication.test.js`; the fix is proven by the smoke error
   moving from the governance gate to the outbound-security boundary.
2. **The outbound SSRF guard behaves as designed.** With the gate fixed, the
   smoke against a loopback provider endpoint was rejected with
   `OPENAI_SSRF_BLOCKED`. The guard has no environment back door and
   unconditionally refuses private/reserved addresses for provider endpoints —
   a deliberate T-172 security property. Production deployments of the
   real-provider profile must therefore point at public provider endpoints
   (or run a trust-boundary-approved forward proxy outside the blocked
   address space); the direct pool call above is the sanctioned local-real
   evidence path.

## Deployment surface changes reviewed

- `deploy/compose.release.real.json` (new): real-provider release profile.
  Keeps the default profile's hardening; provider credentials enter only
  through a required private `env_file`; the verifier rejects any `*_API_KEY`/
  secret/password/webhook entry in the profile environment and requires the
  loopback-only port, digest-pinned image and enterprise auth. Validated for
  both profiles plus negative cases (unknown profile, credential re-entry).
- Deployment runbook updated with the real-profile procedure and an explicit
  statement that a configuration review is not runtime evidence.

## Explicitly not covered

- Third-party penetration test or external security audit.
- Real-provider runtime behavior under attack (no real provider calls were
  made in this review).
- Multi-host HA security properties (no multi-replica profile exists).

## Phase-2 additions (same day, owner-directed)

- **CI real-provider smoke is now real.** An OpenAI-compatible credential was
  provisioned through the repository's encrypted secret store (value handled
  exclusively in memory and piped, never displayed or committed). Run
  40106175324 executed the real-with-key lane end to end: `ok: true`,
  `realProviderCallMade: true`, one provider call. The credential-free skip
  path remains the default discipline: without the secret the workflow stays
  green and reports an explicit skip. Spend control is unchanged — at most
  one call per manual dispatch, no automatic triggers.
- **Multi-replica HA profile built and verified live.**
  `deploy/compose.release.ha.json` (nginx + two Gateway replicas + shared
  PostgreSQL for idempotency/usage/rate-limit/dispatch stores) passed a live
  single-host verification: four healthy containers, 10/10 authenticated
  requests distributed across both replicas, zero failed requests during a
  full replica outage (replica B took over all traffic), and distribution
  resuming after recovery. Single-host boundary unchanged: cross-host and
  multi-node HA remain unclaimed.
- **OpenSSF Scorecard** (third-party automated supply-chain assessment) is now
  wired into CI as a weekly scheduled workflow with published results. A
  funded human audit or commercial penetration test remains future work; the
  OpenSSF Alpha-Omega grant draft (Q4 window closes 2026-10-31) targets
  exactly that and awaits the owner's submission.
