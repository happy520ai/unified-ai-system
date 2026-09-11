# Local vector storage

Set `KNOWLEDGE_INFRA_MODE=sqlite-vec` to enable the local vector path. The
configuration name is retained for compatibility. Its implementation uses
Node's built-in SQLite and JavaScript cosine ranking, not the native sqlite-vec
extension. It needs no additional native package beyond the supported Node
runtime. The default embedding provider is deterministic and credential-free.
External embeddings still require the existing governed Provider operation path.

`KNOWLEDGE_SQLITE_VEC_PATH` selects the database file. Keep it in the configured
data directory and preserve that directory when restarting the service. The
existing `documents` and `vectors` table layout is retained; embeddings use
Float32 bytes in little-endian order, matching prior files on supported Windows,
Linux amd64 and arm64 systems. This does not certify other architectures.

The configured dimension must match the embedding model. Writes reject missing,
non-finite, overflowing or incorrectly sized vectors. Batch writes are atomic;
replacing and deleting a document keeps its vector consistent. Retrieval applies
the server's visible-document set before limiting the ranked results, so another
tenant's higher scores do not crowd out the caller's documents.

SQLite stores the data; ranking scans matching stored vectors in JavaScript.
This is suitable for bounded local collections and is not an indexed approximate
nearest-neighbor service. No benchmark for large collections is claimed.

If storage is unavailable, inspect the configured path and permissions. Do not
delete the database to make readiness pass. After repairing storage, restart the
service to reevaluate its configured vector capability. A dimension mismatch
requires the original embedding model or an explicit reindex of source documents;
it is not evidence that the database should be discarded.

## Language Selection

Workload: repair the existing local vector store and its retrieval call site.
An ESM JavaScript change preserves the current runtime import/API, while new
TypeScript regression tests exercise actual storage and an independent Node
process. This reuses `node:sqlite`, which the existing knowledge persistence
module already uses, without adding a dependency, table or separate store.

| Option | Domain | Maintenance | Operations | Safety | Migration | Ecosystem | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Existing JS boundary plus TS tests | 5 | 5 | 5 | 4 | 5 | 5 | 29 |
| Convert the entire knowledge module to TS | 5 | 3 | 5 | 5 | 2 | 5 | 25 |

Rollback preserves the database layout and configuration identifier, but restores
the old unresolved optional dependency and vector-validation behavior. Preserve
the data file and validate the target runtime before rollback. Tests cover
independent process loading, restart, real retrieval, tenant filtering, batch
failure and malformed vectors; they do not establish production scale or
power-loss durability.
