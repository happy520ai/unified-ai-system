# Response Cache Tenant Isolation

The response cache is an enterprise data boundary, not only a latency feature.
Authenticated tenants can legitimately hold the same prompt or public cache key,
but they must never share a stored response, invalidation decision, summary, or
audit record unless an explicit server policy authorizes that sharing.

## Security contract

- Tenant identity comes only from `request.enterpriseIdentity.tenantId`.
- Request JSON fields such as `tenantId`, `userScope`, metadata, and `cacheKey`
  never select the storage namespace.
- Every storage operation requires a non-empty server-authenticated tenant.
  Missing tenancy fails closed with `RESPONSE_CACHE_TENANT_CONTEXT_REQUIRED`.
- Storage keys use domain-separated SHA-256 digests with the format
  `response-cache:tenant-v1:<tenant-digest>:<public-key-digest>`.
- Raw tenant identifiers and raw public cache keys are not written into the
  storage index or audit key field.
- Lookup, write, invalidation, summaries, and audit reads all use the same
  tenant scope. A key copied from another tenant is re-scoped to the caller and
  cannot address the original record.
- HTTP responses return the public cache key, never the internal storage key.
- Legacy unscoped cache records are intentionally unreachable from authenticated
  HTTP routes. This is a fail-closed compatibility break, not an automatic data
  migration.

## Language selection

The new namespace contract is TypeScript because tenant identity, scope creation,
and error semantics are a security-sensitive internal API. Existing Node.js ESM
stores, benchmarks, and route modules receive focused compatibility wiring so
their direct-source import surface remains stable. A Go or Rust cache proxy would
add a network process, deployment, telemetry, and availability boundary without
providing stronger authorization than deriving the namespace at the existing
authenticated request boundary.

## Evidence boundary

Adversarial tests use two authenticated tenants with the same public key and
attempt cross-tenant lookup, invalidation, poisoning, summary access, and audit
access. The contract protects this response-cache implementation; it does not
claim row-level security for unrelated knowledge, session, workflow, or external
cache systems.
