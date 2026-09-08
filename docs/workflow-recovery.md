# Durable local workflow runs

The existing local workflow still performs exactly three actions: retrieve local
knowledge, compose a deterministic report, and publish one Markdown artifact.
Runs now have an owner-scoped, durable history and an explicit reconciliation
operation. This does not add a general workflow engine or an external runner.

## Run and inspect

Use a stable `workflowId` for a run that may need recovery. Existing requests
without an ID remain compatible and create a new run. Retrying a request without
its original ID is a new task, not recovery of the previous task.

| Operation | HTTP | Permission |
| --- | --- | --- |
| Run or explicitly resume safe stages | `POST /workflow/run` | `workflow:run`, plus existing Agent Governance when enabled |
| Recent owner history, limit 1–100 | `GET /workflow/runs?limit=50` | `workflow:run` |
| Inspect one recorded run | `GET /workflow/runs/{workflowId}` | `workflow:run` |
| Reconcile an interrupted publication | `POST /workflow/runs/{workflowId}/recover` | `workflow:run` |

All history routes require an authenticated tenant and owner. Those values come
only from server authentication. Body fields and query parameters cannot select
another owner. A different owner or tenant sees no matching run. History responses
use `Cache-Control: no-store`; list results omit the report result.

The application service exposes `run`, `getRun`, `listRuns`, and `recoverRun` for
CLI/SDK adapters. The existing `run` success response remains compatible. A run
failure includes its `workflowId` so the caller can inspect its durable outcome.
The in-process legacy API may still be called with tenant-only context; such runs
use a separate legacy owner scope and are not visible in authenticated history.

The same owner, ID, and normalized input return the recorded result after
completion. No retrieval or new artifact is performed. Different input under the
same owner and ID returns `WORKFLOW_INPUT_CONFLICT`. Independent runs requesting
the same filename retain the existing versioned, no-overwrite publication rule.

## Recovery contract

| Recorded state | What it means | Safe next action |
| --- | --- | --- |
| `running` / `prepared` | Retrieval/composition is active, or prepared report bytes are durable; no publication intent exists yet | Respect the active claim. After its lease expires, explicitly repeat the original run request. Prepared bytes are reused. |
| `failed` / `cancelled` / `interrupted` with `canResume=true` | Failure occurred before any publication intent | Review the error and repeat the exact original run request through normal authorization. |
| `publishing` / `unknown` | A durable intent exists; the file effect or its final accounting is uncertain | Call `recover`. Do not replace the ID, blindly retry, or choose a new output name. |
| `completed` | The original publication and required result governance were confirmed | Read the recorded result. Repeating the ID returns that result without writing. |

`recover` never retrieves knowledge, composes a report, or publishes a file. It
checks the exact recorded candidate against the staging inode/device identity,
byte length, and SHA-256 digest. Equal text in a replacement inode is not proof.
A missing, changed, linked-to-another-inode, or otherwise unverified candidate
remains unknown and cannot obtain a fresh publication claim. Recovery preserves
user files. Missing output directories are not recreated by reconciliation.

Successful reconciliation updates the run journal and may remove only the
registered staging entry after both it and the published target match the
recorded inode/device, length and hash. It never changes the target artifact.
`meta.stagingCleanup` reports removal, absence, or preserved unknown identity.
If the artifact was
published but post-write Agent result governance did not finish, the run remains
unknown. A verified original publication authorization receipt is also required
before `resumeAction: "recheck-governance-only"` is available. Repeating the original
request through the governed run endpoint then reauthorizes and meters only the
stored result; it does not repeat retrieval or file publication or consume a second
write approval. A legacy unknown record without original authorization evidence
remains uncertain even when its file fingerprint matches. The history API
does not reveal the unmetered intermediate result. Completion is confirmed only
after result governance and execution-lease release succeed.

`canResume` and `resumeAction` distinguish that case from
`"run-safe-remaining-stages"`. Ordinary completed-history reads report a past
outcome, not a continuous file-integrity assertion. If the user edits a completed
artifact later, replay returns the historical result and preserves that edit.

Cancellation before publication intent is recorded as a resumable cancellation.
After intent, ambiguous interruption stays unknown until reconciliation. Once a
file operation has started, cancellation cannot safely undo it or authorize a
second write.

## Review and approve the exact artifact

When the Agent policy requires approval for `file_write`, a run first prepares
its bounded private draft under the authenticated workflow identity. Before
publishing, the service freezes the exact available filename and the real root
and tenant-directory identities. It then requests approval through the existing
Agent approval system. `TOOL_APPROVAL_REQUIRED` returns the actual approval ID;
the workflow history retains the draft and records that code. No final Markdown
artifact is published while approval is pending.

Use `pnpm gateway agents approvals --agent-id <agent-id>` to inspect the pending
request, or add `--json`. The workflow review shows the complete Markdown,
UTF-8 byte length and SHA-256, exact tenant partition and filename, controlled
root and target fingerprints, workflow input fingerprint and initiating-owner
fingerprint. Plain terminal output preserves the complete bounded content. The
service cannot approve text with secret-like material or forbidden controls, or
content exceeding 16,000 characters / 64 KiB; it returns
`APPROVAL_REVIEW_UNAVAILABLE` and retains the original draft rather than trimming
the text for approval.

After reviewing, use the existing
`pnpm gateway agents approve --approval-id <approval-id> --yes` command, then
repeat the original workflow ID, input and Agent. The AES-GCM sealed arguments
and authenticated review bind the exact input, owner, target, content and
effective policy. Request IDs, claim IDs, lease instances and current timestamps
are not part of retry matching. A restart or knowledge edit cannot regenerate
the prepared content. Rejection or expiration never executes the old grant;
another approval is requested only when the operator explicitly repeats the run.

An occupied reviewed target produces `WORKFLOW_TARGET_OCCUPIED` and is
preserved. The service does not silently select another version after review.
Replacing a directory or staging inode, including a replacement with equal
bytes, also stops publication. The writer rechecks the frozen filesystem
identities and hash after the final asynchronous Agent authorization check,
immediately before its final signal check and hardlink. These path and identity
checks close the explicit authorization-await window; they are not a native,
atomic filesystem namespace guarantee against arbitrary concurrent local actors.

Approval consumption remains one-shot. Cancellation after consumption but before
publication leaves the grant consumed, the draft retained, and no final artifact.
An explicit retry needs a new approval of the same frozen material. A durable
publication intent records the original actual authorization and, when required,
the consumed approval ID before the file effect. An interrupted intent remains
unknown until the recorded target can be reconciled; missing original evidence
cannot be replaced by current permission or a caller-supplied recovery flag.

Completed or reconciled receipt replay still validates current Agent ownership,
the signed policy and ancestor chain, current tool denial and full resource
scope, current usage limits and result governance. It uses a zero-increment
usage reservation, so an existing receipt may be returned at the exact
`maxToolCalls` limit without authorizing another write. Stricter current limits
or scope can reject delivery. Receipt replay may update governance audit/usage
state and finalize an already-reconciled journal record; it does not repeat the
file effect or consume another write/sandbox grant. Its audit tool label is
`workflow_receipt`. A failed delivery of an already-completed historical receipt
does not downgrade that historical completion to a new unknown publication.

## Persistence and concurrency

The journal is `workflow-runs.sqlite` under the existing `WORKFLOW_OUTPUT_DIR`
(default `.data/workflows`). It uses Node's existing `node:sqlite` runtime,
SQLite WAL, `synchronous=FULL`, a versioned application schema, bounded records,
and operation-scoped connections. No service or background dispatcher is added.
History reads do not initialize an absent store. Unknown or malformed existing
state is preserved and rejected, not overwritten with an empty database.

A record becomes format version 2 when its governed publication target is frozen.
Version 2 binds the target and original authorization receipt without changing the
SQLite table schema or adding a state file. Genuine legacy version 1 records are
still readable; a new-format record cannot be relabeled version 1 while retaining
the new fields. An explicit authorized run can bind a legacy prepared draft; no
bulk or production migration/reset is performed. Older code rejects version 2
records, and older approval readers reject the new `workflow:artifact-write`
effect. Downgrading a gateway with this state therefore fails closed and is not
a drop-in rollback. Preserve protected state and use a compatible reader or a
forward correction; do not delete approvals, journals or staging to force a
downgrade to start.

An atomic, root-bound `.workflow-runs.initialization.json` marker is published
before creating the database. An interrupted empty database can initialize only
with that pending module marker, zero application/schema versions, and no schema
objects. Foreign/unclaimed empty files and foreign schema are refused. Before the
first run can be claimed, the marker records completed initialization; a later
missing/truncated established database cannot silently reset the history.

Workflow health exposes persistence as `unverified` until a real store operation
has validated it. Observed storage faults make the workflow component `degraded`
with a safe error code. A successful verification clears read faults; an observed
write fault requires a successful write before clearing. Reading health performs
no filesystem or database probe and creates no state.

A run claim binds the owner, input fingerprint, attempt, and lease. The default
pre-publication lease is 120 seconds. A superseded worker must pass a claim check
before progressing. The publication intent commits before the filesystem effect.
A subsequent `BEGIN IMMEDIATE` transaction holds the claim across the actual
atomic `link()` publication, identity/content readback, and result commit. Another
process cannot take ownership between the check and the file effect; it receives
`WORKFLOW_BUSY`. Read-only history remains available during that transaction.

Publishing uses the existing private staging-file and atomic hardlink mechanism.
Existing files, symlinks, and hardlinks are never overwritten. The original
staging inode is removed before the completion transaction commits; a crash may
retain that private staging entry for reconciliation. Ordinary preparation
failures remove the newly created staging inode only after confirming it was not
registered in the journal. A failed/uncertain prepare commit is checked before
cleanup. If that check or inode identity is uncertain, the entry is preserved.
Successfully reconciled registered entries are cleaned as described above.

A process crash before registration can retain an unknown orphan. The service
does not guess ownership or select it as execution proof. New staging is refused
at 32 retained entries per tenant directory (`WORKFLOW_STAGING_CAPACITY`);
initialization staging has its own 32-entry bound. Maintenance must stop workflow
mutations, preserve the directory and journal, and identify any unknown files
explicitly before removal. Do not bulk-delete by filename pattern or clear the
database to bypass this bound. No general garbage collector is introduced.

Records are limited to 2 MiB, the journal to 10,000 runs, and one run to 32
execution attempts. Error history preserves the first events and the latest
error separately, with at most 64 history entries. Capacity exhaustion refuses
new work rather than evicting evidence. No automatic history deletion is added.
Archive/retention policy for an indefinitely running product remains separate
work; this change does not claim a complete data lifecycle.

This is a **single-host** recovery boundary. UNC paths and filesystem roots are
rejected as workflow state roots; network-mounted SQLite is unsupported. It is
not distributed coordination, an independently protected snapshot authority,
administrator resistance, or proof of recovery from power loss. Files use
0600/0700 where supported, plus existing directory/inode checks. Windows
deployment ACLs remain the operator's responsibility; POSIX mode calls do not
attest Windows ACL protection. Directory fsync is attempted where supported.

## Verification and rollback

`durableWorkflowRecovery.test.ts` uses temporary synthetic state and real child
process termination before intent, after intent, and after file publication.
It also covers cross-process publication locking, stale-worker fencing, restart
reconciliation without duplicate writes, equal-content inode replacement,
tenant/owner isolation, cancellation, malformed/linked state, and production
enterprise authorization plus the dispatcher over real loopback HTTP.
The existing local-workflow and governed-workflow tests remain applicable.

Rollback must retain the journal and artifacts. Stop accepting workflow mutations
before restoring older code: older code does not understand durable run IDs and
must not be used to retry these runs. Preserve unresolved intents for explicit
reconciliation; do not delete state or clear unknown outcomes to allow a retry.
No existing artifact or database migration is required. The new dedicated store
does not open or modify any existing application database.

## Language Selection

- **Workload:** persist and fence the existing three-step local workflow and
  reconcile publication after process interruption.
- **Primary path:** a TypeScript `durableWorkflowRunStore.ts` owns the journal,
  state transitions, leases and publication transaction; existing JavaScript
  service/writer/HTTP code supplies narrow integration points.
- **Alternatives:** JavaScript alone fits the runtime (5/5) but provides weaker
  state/contract checking (3/5). A separate runtime or general workflow engine
  introduces a bridge and new deployment/state ownership without a need here.
- **Chosen language:** TypeScript scores 5/5 for domain, maintenance, safety and
  ecosystem fit and uses the existing Node SQLite dependency. Existing writer
  and HTTP modules remain JavaScript to avoid an unrelated migration.
- **Compatibility/rollback:** success payloads and unique-run behavior are
  retained; explicit repeated IDs now deduplicate or reject changed input.
  History and recovery endpoints are additive. The bounded approval DTO and
  version 2 target/authorization records have the downgrade boundary described
  above. Preserve state during rollback.
- **Policy impact:** tenant and owner come from server identity; Agent approvals,
  metering and lease release still gate governed runs. No Provider, deployment,
  native client configuration, external runner or cross-host behavior is added.
- **Size rationale:** the existing workflow, governance, shared-contract and CLI
  owners each enforce a distinct boundary: durable claims/targets, exact review
  sealing, current policy checks, controlled file publication and operator
  delivery. Their focused, actual-governance and process-crash tests are necessary
  to verify those boundaries and the recovery contract.
  There is no new dependency or reusable workflow framework.

The language scores are engineering judgments, not performance measurements:

| Option | Domain | Maintenance | Operability | Safety | Migration debt | Ecosystem | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| TypeScript in the existing Node runtime | 5 | 5 | 5 | 5 | 4 | 5 | 29 |
| JavaScript for the entire state engine | 5 | 4 | 5 | 3 | 5 | 5 | 27 |
| Separate runtime/service | 2 | 2 | 2 | 4 | 1 | 2 | 13 |
