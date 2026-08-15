# Knowledge Tenant Isolation

## Security contract

Authenticated knowledge is tenant-private. The gateway derives the storage scope only from
`request.enterpriseIdentity.tenantId`. Request bodies, query fields, metadata, and
`x-pme-tenant-id` cannot select another tenant.

The same scope is enforced at every layer:

- direct knowledge load, retrieve, source listing, health summary, and delete operations;
- long-term memory, connector import, query-graph RAG, streaming and non-streaming RAG;
- workflow retrieval;
- in-memory document merge keys and query-cache keys;
- JSON v2 and SQLite `knowledge_documents_v2` persistence.

Tenant scope keys are versioned SHA-256 digests with a domain separator. Raw tenant IDs are
not written into persistence keys or knowledge metadata. Public `sourceId` and `documentId`
values remain caller-facing and can be identical across tenants.

Missing authenticated scope fails closed for every knowledge write and delete. Reads without
scope can see only immutable system documents. Legacy unscoped user documents are deliberately
unreachable; operators must re-import them through an authenticated tenant.

## Compatibility and rollback

- Public load and retrieval payload shapes remain unchanged.
- `x-pme-tenant-id` and body `tenantId` are no longer authorization inputs.
- Long-term-memory document IDs no longer embed a raw tenant ID.
- File persistence moves from version 1 to version 2.
- SQLite uses a new tenant-composite `knowledge_documents_v2` table and leaves any legacy table
  untouched for explicit offline recovery.
- Reverting the milestone restores the old global store, but must not be used as a data migration
  strategy because it reopens cross-tenant access.

## Language Selection

- **Workload:** security-critical identity derivation, deterministic keying, persistent isolation,
  active route propagation, and adversarial tests.
- **Chosen language:** TypeScript for the new tenant-scope boundary and attack tests. Focused edits
  remain in the mature Node.js ESM services and dispatchers to avoid an unrelated runtime migration.
- **Rejected alternative:** route-only filtering leaves direct service, cache, file, and SQLite callers
  vulnerable. Client-provided prefixes remain forgeable. A Go or Rust sidecar adds deployment,
  serialization, and lifecycle boundaries without a measured need for process isolation.
- **Rollback boundary:** one tenant-scope module, the local knowledge service/persistence boundary,
  and explicit online call sites. No provider, network, or public model contract changes.

## Evidence boundary

The adversarial suite covers cross-tenant read, same-key poisoning, query-cache reuse, source
summaries, deletion, forged tenant headers/body fields, active HTTP dispatchers, JSON/SQLite restart,
legacy records, and missing-scope storage calls.

This milestone proves isolation for the local keyword knowledge store. It does not by itself prove
tenant isolation for pgvector, external vector databases, session stores, workflow artifact files,
or Workforce plan stores; those require separate storage-specific evidence.
