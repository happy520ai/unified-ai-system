# Scoped Windows verification

Run `pnpm verify:windows` with the repository's supported Node runtime (CI uses
Node 22). This is a local Windows validation profile, not the full release gate.
The checked-in Windows workflow invokes the same entry point; a workflow file
existing locally does not prove that hosted CI has run.

The profile runs these stages in order and stops at the first non-passing stage:

1. `check:critical-js`: syntax and TypeScript binding diagnostics on the explicit
   14-file scope in `tools/check-critical-js.mjs`. It catches undefined identifiers
   such as the former `vm` reference, unbound shorthand, missing named exports and
   unresolved imports. It does not perform complete JavaScript type checking,
   execute modules, certify dynamic imports, or replace the existing TS typecheck.
2. The existing project TypeScript check.
3. MCP management and child-environment regression tests using node:test.
4. Windows authority anchor, broker and JSON configuration transaction tests
   using Vitest with two workers. Test assertions and deadlines are unchanged.

The Windows authority tests include injected OS/broker fixtures. Passing them on
Windows is not certification of a deployed privileged service, service-account
isolation or a real third-party client. The profile never provisions that service,
changes client configuration, starts Docker or makes a real Provider call.

Each run writes a new `result.json` below the existing ignored
`apps/ai-gateway-service/evidence/windows-validation/` directory. Previous runs are
not overwritten. The artifact records HEAD, worktree dirty/clean state, platform,
Node version, stage timestamps, exit codes, and counts for passed/failed/skipped
tests. HEAD is a reference point: a dirty-worktree result must not be advertised
as validation of that commit's immutable contents. Protected `.mcp.json` and
environment files are excluded from the Git-state query and are never scanned.

Stage states are `passed`, `failed`, `skipped`, or `not_run`. All-skipped or
missing test reports cannot produce a passing test stage; partial skips remain
visible in counts and `hasSkippedTests`. A started stage is checkpointed as failed
with `completion_not_confirmed` until completion is proved. Abrupt termination
therefore cannot leave a false success. Missing prerequisites leave later stages
not-run. Non-Windows invocation produces an explicit skipped result and exit 2.

Child environments contain platform essentials and isolated user/temp paths,
with fake-provider mode pinned. Account/provider variables and NODE_OPTIONS are
not inherited. Raw stdout/stderr and raw assertion payloads are not stored in the
published summary. Interrupted commands fail validation; if child cleanup cannot
be confirmed, the dedicated temporary directory is retained and marked for
operator recovery. Cleanup retries address file locks only, never rerun tests.

The profile does not run or bypass `check:public` / `verify:public-clone`, validate
real Provider entitlements, establish HA/DR, or certify every supported runtime.
Those results must remain separate. Use `pnpm test:verification-tools` to verify
the binding checker and report-state contracts; these tests also run in `pnpm test`.

Read the retained summaries with `pnpm gateway verification`, or add `--json` for
machine-readable output. This command reads only the fixed Windows evidence
directory; it does not run tests, contact the Gateway or inspect raw logs. Each
run remains visible, newest first, including a failure followed by a later pass.
It never substitutes an older success when the newest record is invalid or failed.

A current scoped pass requires a clean matching local checkout before/after the
run, this exact Windows/architecture/Node environment, a result less than 24 hours
old, all four stages passed with no skipped tests, and explicit confirmed cleanup.
The producer now writes schema version 2 with a profile ID and cleanup summary.
Its directory ID binds the same start timestamp as the report; contradictory
cleanup types or failure reasons cannot be accepted as a passing record.
Older version 1 records remain readable but have unconfirmed cleanup and cannot
produce a current pass. Missing, stale, interrupted, mismatched or unsafe records
return exit 2. Only a current scoped pass returns 0; CLI usage errors retain their
existing exit code. These local unsigned records do not attest the running server,
prove publication or approve a release.

The reader rejects links, oversized/nonregular files, invalid schemas and more
than 100 run entries. It outputs only known summary fields and safe reason codes;
arbitrary strings, log fields and paths inside a report are not displayed. Preserve
the directory in protected archival storage if it reaches the bound; the command
never deletes history. Its file identity checks detect observed replacement, but
do not provide an atomic OS security boundary against a concurrent privileged writer.

For a resource-constrained full-suite diagnostic, explicitly set
`AI_GATEWAY_TEST_MAX_WORKERS=2` before `pnpm test`. Values 1-8 are accepted; invalid
values fail configuration. The default remains the existing CPU-based 2-8 worker
policy. This changes suite parallelism only, preserves assertions and deadlines,
and must be recorded as a separate profile. A bounded-profile pass never erases a
default-profile failure or proves the absence of product concurrency defects.

## Language Selection

Workload: local static analysis and reproducible test orchestration. Node.js ESM
JavaScript follows the repository's `tools/*.mjs` policy and reuses installed
TypeScript/Vitest, with no new dependency. TypeScript would require a separate
tool compilation/loader boundary; PowerShell alone would duplicate the Linux
binding check. Domain/operations scores: JS 5/5, TS 4/4, PowerShell 3/4. Gateway
request handling and public HTTP contracts remain unchanged. Rollback is these
tooling/workflow/package-script changes; generated reports remain historical
evidence, not a migration or production state store.

The CLI summary reader uses TypeScript to check bounded JSON and filesystem
states, with a small dispatch branch in the existing JS CLI. The root TypeScript
check includes this console source so regular gates also check its types. For this workload,
domain/maintenance/operations/safety/migration/ecosystem scores are TS
5/5/5/5/5/5 (30), JS 5/4/5/3/5/5 (27), and a separate Python CLI
3/3/2/4/2/3 (17). It adds no dependency, public HTTP route or persistent store.
Rollback removes the CLI reader/dispatch and schema-2 producer additions; historical
reports remain untouched. Reader regressions use synthetic summaries and owned
temporary repositories; a fixture pass is not a real Windows validation run.
