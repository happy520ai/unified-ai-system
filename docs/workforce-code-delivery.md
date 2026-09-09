# Workforce code delivery in an owned local worktree

An explicitly configured code profile can produce a complete patch and run its fixed test command in a real container. The implementation uses the existing plan approval, signed Agent policy, claimed role execution, Gateway Provider operation and Forge action hooks. Success requires durable artifact readback and confirmed cleanup. The local fake Provider remains the default; this feature does not enable a real Provider, deploy, commit, merge or publish code.

## Configuration and approval

The application accepts `AI_GATEWAY_WORKFORCE_CODE_DELIVERY_PROFILES_JSON`, a bounded array of at most sixteen server profiles. Each binds exact relative read/write files, immutable test hashes, baseline revision, fixed command, digest-pinned image and artifact/resource limits. The request selects only `codeDelivery: { profileId }`. Request JSON cannot supply a root, implementation, callback, container authority or readiness capability.

`AI_GATEWAY_WORKFORCE_CODE_DELIVERY_ENABLED=true` explicitly connects the concrete factory. `AI_GATEWAY_WORKFORCE_CODE_DELIVERY_ENGINE_PATH` must name an absolute local Docker-compatible engine executable. `AI_GATEWAY_WORKFORCE_CODE_DELIVERY_SCRATCH_ROOT` may name an absolute existing scratch directory. Execution also requires `WORKFORCE_EXECUTION_ENABLED=true` and an approved employee role profile or server role selection. Preview remains available with the delivery factory disabled.

The current profile supports **local execution control on one host**. PostgreSQL/distributed lifecycle and multi-instance modes fail before code admission. Other Workforce analysis modes keep their existing storage behavior. This does not complete the broader distributed employee collaboration objective.

The default execution-family policy still denies code execution and does not grant `workforce_verify_snapshot`. An operator must separately create and activate an appropriate policy version through existing governance. It must explicitly allow `file_read`, `file_write`, `file_edit` and `workforce_verify_snapshot`, permit writes/code execution and cover the exact project paths. Global per-tool approval, unsupported sandbox requirements, record ceilings, insufficient remaining budget or exclusions that remove artifact fields cause rejection. `workforce_execute` can retain its separate Tool Proxy approval. General shell/code tools remain denied; the snapshot validator has no public execution callback or namespace alias.

The backend employee needs at least three requests: analysis, Forge compilation and one worker operation. Its configured output ceiling must cover the 16,384-token compiler request; additional workers or corrective model calls need a sufficient approved role/run budget. Forge requests are clamped to that role ceiling. Existing Gateway token/cost guards, input limits, deadlines and dispatch rules still apply. These minimums do not guarantee model success.

Both plan approval and execution perform current preflight against the owning active root Agent, verified policy, actual clean Git baseline, approved file bytes and container attestation. Execution repeats preflight before Tool Proxy admission, plan approval consumption, model dispatch or worktree creation. Preview reports `executionAllowed: false`; `implementation: available` describes the factory only. Readiness data grants no execution authority. CLI review displays the complete code scope and verification settings.

## Execution and evidence

Forge runs inside a worktree proven to belong to the current scoped execution. Its compiler does not probe the project, and implicit project-content gathering is disabled. The backend role's private operation handles every model request, sharing the analysis/implementation budget and Gateway receipts. Private live DAG task and Agent fences are checked at effect boundaries. Copied callbacks, unrelated tasks/runs and JSON objects cannot satisfy those capabilities.

Each read, write or edit must pass the actual enforcing Tool Proxy and match an exact approved path. Path topology checks inspect filesystem metadata to reject escapes; this is not zero filesystem observation. Approved project contents are the only project contents supplied to the model. Forge uses an external temporary database without creating a project `.forge` directory.

The validator copies only approved files into a separate snapshot, mounts it read-only and disables network access. It uses the fixed command, image and limits. Nonzero exit, killed/OOM results, truncated output, uncertain cleanup, changed snapshots or source changes after validation fail delivery. The rest of the repository is absent.

The response contains one complete `codeDelivery.artifact`: full unified patches, before/after file hashes, source snapshot hash, diff bytes and aggregate digest. Oversized patches fail instead of being truncated. Verification includes the actual command/image, snapshot hash, exit code, cleanup state and governed output. Gateway receipts remain in `roleExecution`; Forge calls consume the same backend role limit.

Each claimed task receives a separate evidence filename, even when roles share an Agent. The existing lifecycle summary holds a bounded index outside the approved worktree. Only metadata created after actual verification can preserve its hashes through log redaction; patch contents and commands still pass redaction checks. Evidence is written and read back before normal cleanup.

The owner-bound `/workforce/execute/status` reads artifacts after restart. Missing, oversized or inconsistent evidence yields `evidenceUnavailable: true` and no verified artifact; it never reruns the task. Index hashes check consistency and separate evidence from the model's write domain. Ordinary server files do not prove authenticity against an administrator replacing or rolling back the entire index/evidence set.

Validation or evidence failure after a write retains the worktree and reports recovery required. Unconfirmed local quiescence prevents destructive cleanup. Inspect retained files and evidence before any new approved run. Terminal response/audit acknowledgement failure remains an uncertain HTTP outcome; persisted evidence is available through execution status. No automatic retry or merge follows failure.

## Verification and rollback

Direct tests cover artifact/path/link bounds, actual patch application, private operation/task/proxy provenance, snapshot capability denial, role budgets, external Forge database placement and bounded per-task evidence. The opt-in container fixture covers actual HTTP approvals, signed governance, claimed roles, real Forge mutation, real container verification, owner readback after restart, corruption detection, failed tests and evidence I/O failure. Its model is a local fake Provider with fixed responses, not a real-provider or production claim.

For that fixture, set `AI_GATEWAY_CODE_DELIVERY_CONTAINER_TEST=1`, `AI_GATEWAY_CODE_DELIVERY_TEST_ENGINE` and `AI_GATEWAY_CODE_DELIVERY_TEST_IMAGE` to an already available absolute engine and digest-pinned image. Tests do not pull images or modify existing containers. Container tests, module tests, repository gates, hosted CI and production evidence must be reported separately.

Disable `AI_GATEWAY_WORKFORCE_CODE_DELIVERY_ENABLED` to stop new code admissions while preserving evidence. A source revert restores the unavailable code lane. No database migration or new dependency is required. Do not delete approvals, retained worktrees or user data as rollback.

## Language Selection

Workload: enforce bounded file/process operations, preserve capability provenance and serialize reviewable artifacts across existing HTTP/governance/Workforce components. TypeScript implements the new runtime and typed bindings; existing ESM entrypoints and lifecycle writers receive local changes.

| Option | Domain fit | Maintenance | Operability | Safety | Migration | Ecosystem | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| TypeScript for the new runtime/contracts | 5 | 5 | 5 | 5 | 5 | 5 | 30 |
| ESM JavaScript for the new runtime | 5 | 4 | 5 | 3 | 5 | 5 | 27 |

These are design scores, not measurements. File-count/net-line thresholds are necessary because one approved delivery crosses application/HTTP admission, Agent Tool Proxy, role budget, DAG claim, Forge constructor, filesystem/container operations and existing evidence/lifecycle persistence. No alternative service, framework or persistent process is added. Requests without `codeDelivery` keep their analysis behavior; v4 digests bind the complete code review, while earlier approval formats keep their existing meaning.
