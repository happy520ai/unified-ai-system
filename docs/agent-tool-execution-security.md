# Agent Tool Execution Security

The agentic runtime deliberately separates capability discovery from execution
authority. Powerful tools are useful only when their activation and approvals
are explicit, attributable, and fail closed.

## Secure defaults

- A registry without a callable permission checker denies every
  permission-bearing tool.
- Permission checks run before any cache lookup.
- Results from permission-bearing tools are never placed in the registry's
  caller-agnostic cache.
- `shell_exec`, `code_run`, and `web_fetch` are absent by default.
- High-risk tools appear only when `enableHighRiskTools: true` and a callable
  permission checker are both supplied.
- Shell permission evaluation receives the actual command for risk
  classification, while file contents and other arbitrary arguments are not
  copied into the permission context.

These controls are library-level defaults. A future HTTP agent endpoint must
also bind its permission gate, workspace, approvals, budgets, and audit trail to
the authenticated tenant and user before it can be enabled.

Session persistence additionally bounds file loading and directory scans,
releases per-session mutex entries after every save, and uses atomic private
files. Persistent memory is still a local-runtime feature; it must be assigned a
tenant-specific storage directory before any multi-tenant HTTP exposure.

## Trust boundary

Node's `vm` module is not a security boundary. `code_run` now uses the existing
Forge container backend, with no VM, worker-thread, or host-process fallback.
`shell_exec` remains a separate privileged host capability; do not treat its
command blocklist as isolation or authorization.

### Isolated code_run

High-risk opt-in and `code:run` permission remain required. The operator must
also configure `AI_GATEWAY_CODE_RUN_ENGINE_PATH` (absolute Docker/Podman binary)
and `AI_GATEWAY_CODE_RUN_IMAGE` (an already-present Linux Node image pinned by
`@sha256:` digest). Neither engine startup nor image download is automatic.
Library callers may supply server-owned `codeRunIsolation: { enginePath, image,
scratchRoot }` to `createAgentToolRegistry`; execution arguments/context cannot
select the engine, image, mounts, or environment. Use a trusted minimal image
with Node and `/bin/sh`, without embedded secrets or a custom entrypoint.

Only a new temporary directory containing the submitted snippet and runner is
mounted, read-only. Project files are not mounted. The backend disables network,
drops capabilities, uses UID 65532 and a read-only root, and bounds memory (128 MiB),
process count (32), CPU (1), and output (64 KiB per stream). Persistent container
logging is disabled with `--log-driver none`; stdout/stderr are captured through
the attached process only. Host credentials are
not injected. This is container isolation, not protection against a malicious
container daemon, administrator, image, or kernel compromise.

Input is a JavaScript async function body (up to 64 KiB UTF-8), with optional
`timeout_ms` from 1 to 30000 (default 10000). The timeout limits snippet execution;
bounded engine preparation and cleanup take additional time. Awaitable allowlisted
`require` calls support `node:crypto`, `node:buffer`, `node:util`, `node:url`,
`node:path`, and `node:querystring`. Results remain untrusted strings/logs.

Missing backend returns `CODE_RUN_ISOLATION_UNAVAILABLE`; cancellation, timeout,
oversized output, and unconfirmed cleanup have separate error codes. No successful
result is returned when terminal container state or cleanup is unconfirmed.
Temporary inputs are retained when container cleanup is uncertain and require
operator recovery; do not retry while the previous execution may still exist.
Dynamic tools cannot occupy the reserved `code_run` identity, including normalized
case, separator, fullwidth, and invisible-format aliases when the built-in is disabled.

Real isolation acceptance is opt-in via `AI_GATEWAY_TEST_CODE_RUN_ENGINE` and
`AI_GATEWAY_TEST_CODE_RUN_IMAGE`, then:

```bash
pnpm exec vitest run apps/ai-gateway-service/src/claude-code-patterns/codeRunIsolation.local.test.ts
```

The local test is excluded from the default unit scope and skips without explicit
configuration. Mock backend tests prove dispatch and error contracts only; they do
not prove actual container isolation or deployment readiness.

## Compatibility and rollback

Read-only discovery APIs continue to list ordinary tools. Callers that relied
on implicit execution must provide a permission checker. Callers that require
the three high-risk tools must also opt in. No persisted state or wire format is
changed; rollback is limited to the registry policy wiring.

## Language Selection

- Workload: synchronous capability classification and permission-context
  construction on the agent tool hot path.
- Selected language: TypeScript for explicit checker, decision, and context
  contracts while remaining directly importable by the Node ESM runtime.
- Alternatives: JavaScript would make malformed checker shapes easier to miss;
  a separate Go or Rust service would not itself provide process isolation.
- Compatibility: no dependency or runtime is added, and existing JavaScript
  registry APIs remain callable.
