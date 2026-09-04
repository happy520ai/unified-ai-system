# External Security Audit Kit

This document gives an independent reviewer everything needed to start a
scoped security review of this repository in minutes: a reproducible target,
a review scope, a threat-model index, an existing attack-regression harness,
and the honest list of boundaries the project already knows about.

The project's own rule — internal evaluation is not independent verification
(see [VISION.md](../../VISION.md)) — is the reason this kit exists. Reports
produced from this kit by reviewers outside the maintainer identity are the
evidence class this project treats as independent.

## Reporting

- Use **GitHub private vulnerability reporting** on this repository
  (Security tab → Report a vulnerability). Do not open public issues for
  suspected vulnerabilities.
- Reports are acknowledged within 14 days. Confirmed findings are credited
  in the release notes and in `docs/security/` unless the reporter opts out.

## Target Environment (credential-free)

The default gateway path is deterministic and needs no provider keys:

```bash
docker run --rm --publish 127.0.0.1:3100:3100 \
  --env AI_GATEWAY_SERVICE_HOST=0.0.0.0 \
  --env AI_GATEWAY_PROVIDER_MODE=fake \
  --env AI_GATEWAY_REAL_PROVIDER_ENABLED=false \
  --env PME_ENTERPRISE_AUTH_ENABLED=true \
  --env PME_AUTH_TOKEN=<32+-char-token> \
  ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.7.0
```

Everything in scope below is reachable from that single process. For
source-level review, clone and run `pnpm verify:public-clone` first; the
same checks CI runs will run locally, which removes "does it build"
ambiguity from the review.

## Suggested Review Scope (four chains)

A focused 5–10 day review is more valuable than a broad one. The four
chains below are the security core; each already has first-party tests an
auditor can use as a starting harness rather than starting from zero.

1. **Authentication chain** — `PME_AUTH_TOKEN` / JWT issuance and
   validation, virtual-key verification and revocation
   (`src/enterprise/authTokenService.js`, `src/enterprise/apiKeyManager.js`,
   `src/enterprise/revocationStore.js`), OIDC SSO with PKCE, and SCIM 2.0
   bearer auth (`src/http/oidcScimRoutes.js`, `src/enterprise/oidcSsoService.js`).
2. **Tenant isolation** — every multi-tenant store: response cache, audit
   trail, virtual keys, usage ledger, knowledge/RAG, local-client registry.
   Start from `tools/security-attack-regression.mjs` cases A1, A2c–A2f, A6.
3. **Audit hash chain integrity** — `src/enterprise/auditHashChain.js` and
   the PostgreSQL variant. Known boundary: full-chain rollback replacement
   requires an external checkpoint; assess whether that boundary is stated
   accurately everywhere it is relied on.
4. **MCP boundary** — the 12 governed MCP tools in `packages/mcp-server`
   (fake-provider fail-closed chat), reverse MCP upstream aggregation, and
   REST→MCP generation (`src/mcpGateway/`). Start from attack cases A8–A9.

## Threat-Model Index

First-party documents an auditor should read before testing:

- [Attack-chain hardening report](../security-hardening-attack-chain.md)
- [Prompt injection trust boundary](../prompt-injection-trust-boundary.md)
- [MCP upstream security](../mcp-upstream-security.md)
- [External-effect fencing](../external-effect-fencing.md)
- [Runtime credential encryption](../runtime-credential-encryption.md)
- [Trusted proxy identity contract](../trusted-proxy-identity-contract.md)
- [Platform control-plane isolation](../platform-control-plane-isolation.md)
- [Local client intelligence gateway — evidence boundary](../local-client-intelligence-gateway.md)

## Existing Harnesses

- `tools/security-attack-regression.mjs` — 23 live attacks against a real
  gateway process (tenant crossover, identity forgery, RBAC, quota,
  information leaks, MCP boundary). Run it, then try to break its
  assertions with variants it does not cover.
- `tools/circuit-recovery-drill.mjs`, `tools/postgres-recovery-drill.mjs` —
  resilience drills; not security scope, but they show how the project
  proves claims reproducibly.
- `pnpm check` — includes route-permission consistency and an outbound
  request policy; a diff that weakens either fails CI.

## Known Boundaries (do not spend budget re-finding these)

The project documents its own limits; verify the claims, then look past
them:

- The similarity cache layer and the built-in embedding provider are
  deterministic lexical approximations, not semantic models.
- The audit hash chain does not defend against full rollback replacement
  without an external checkpoint.
- The local client intelligence gateway is single-host SQLite today;
  distributed state, real-client atomic receipt certification, and a
  deployed Windows authority are open release gates.
- PostgreSQL recovery drills are bounded (single standby, LSN-based PITR,
  bridge fencing), not production RTO/RPO evidence.
- Application-layer controls do not replace WAF, DDoS protection, or a
  network-level penetration test.

## Out of Scope

- Provider-side behavior (upstream APIs are out of the trust boundary).
- The `labs` packages listed in [ROADMAP.md](../../ROADMAP.md) —
  experimental subsystems, not product claims.
- GitHub Actions platform and runner security beyond workflow-file review.
