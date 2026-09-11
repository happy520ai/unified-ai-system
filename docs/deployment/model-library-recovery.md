# Model-library state recovery

The model-library store persists catalog discovery, Provider test/smoke summaries
and task-default selections. The application accepts an explicit absolute
`AI_GATEWAY_MODEL_LIBRARY_STATE_PATH` through the existing factory. If unset, its
legacy `apps/ai-gateway-service/evidence/phase-312a-model-library-state.json` location
remains unchanged. This change never scans, migrates or deletes an existing store.

Only a confirmed missing target (`ENOENT` at the initial file check) initializes an
empty in-memory v1 state. Existing empty, corrupt, oversized, invalid UTF-8/JSON,
unknown-version or obviously malformed files are rejected with their bytes intact.
Non-files, symlinks and unreadable/changing files also fail closed. Normal v1 fields,
optional legacy metadata and flat or Provider-nested smoke records remain compatible.
Files are bounded to 16 MiB. Errors expose fixed codes and messages, without native
filesystem details, paths, stored content or credentials.

Each update checks the previously loaded file digest, creates a unique temporary
file exclusively with private permissions, writes and fsyncs it, then atomically
renames it and verifies the resulting bytes. The in-memory snapshot is published
only after that sequence succeeds. Returned records are detached from the internal
snapshot. A failed write/fsync leaves the last committed state unchanged. Cleanup
removes a temporary entry only when its recorded file identity still matches;
foreign or unverified entries remain for operator review.

| Error code suffix (`MODEL_LIBRARY_STATE_…`) | Meaning and next action |
| --- | --- |
| `INVALID` | The existing file or proposed state does not meet the v1 contract; preserve it and investigate the cause. |
| `UNAVAILABLE` | File access or identity verification failed; check the selected path, service account and permissions. |
| `CHANGED` | Another writer, deletion or external replacement invalidated the loaded snapshot; stop competing writers and verify the file before reopening. |
| `SAVE_FAILED` | Failure occurred before attempting publication; the previous committed in-memory state is retained. |
| `WRITE_UNCERTAIN` | Rename was attempted or a later check failed. The operation did not report completion, and this instance rejects further reads/writes until reopened after verification. |
| `CLEANUP_FAILED` | Pre-publication temporary-file cleanup could not be confirmed; inspect protected temporary entries without deleting unrelated files. |

For recovery, stop the sole Gateway process and preserve the current state and any
temporary evidence in protected storage. Inspect the intended file without copying
its content into logs or public evidence. Restore a verified compatible v1 backup
to the explicitly chosen path when needed, retaining the replaced artifact for
rollback. A fresh store instance revalidates the selected file; it never selects a
temporary file or an old backup automatically. For `WRITE_UNCERTAIN`, the target
may contain either the old or the new complete snapshot, so inspect the actual
persisted result before deciding whether the metadata update needs repeating.

This is a **single-writer, single-process** boundary. Digest checks detect observed
external changes; they are not a distributed lock or a compare-and-swap transaction
against other processes. On POSIX, successful publication also fsyncs the parent
directory. Windows uses file fsync plus verified rename; Node does not provide a
portable directory-fsync guarantee there. Neither platform is claimed to guarantee
zero loss under arbitrary power failure, network filesystems or storage faults.
The tests use owned temporary files and synthetic results; no real Provider call,
production state migration or destructive recovery is part of verification.

## Language Selection

This three-file repair stays in the existing JavaScript model-library owner, its
direct Vitest tests and this runbook. Rewriting the owner in TypeScript would add a
migration unrelated to the recovery defect; Python would introduce another runtime.
Domain fit/maintenance/operability/safety/migration/ecosystem scores are JavaScript
`5/5/5/4/5/5` (29/30), a TypeScript rewrite `4/4/4/5/3/5` (25/30), Python
`2/2/2/4/1/2` (13/30). The direct tests cover failure and recovery boundaries; the
application test covers the existing explicit-path integration. No service, table,
schema migration, framework or Provider/model-label change is introduced.
Rollback restores the previous code against the same normal v1 format, but also
restores its previous unsafe recovery behavior; preserve verified state backups.
