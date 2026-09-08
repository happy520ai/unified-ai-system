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
binding check. Domain/operations scores: JS 5/5, TS 4/4, PowerShell 3/4. Runtime
application code and public protocol behavior are unchanged. Rollback is these
tooling/workflow/package-script changes; generated reports remain historical
evidence, not a migration or production state store.
