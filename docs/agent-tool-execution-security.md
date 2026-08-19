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

Node's `vm` module and an in-process shell are not treated as strong isolation
boundaries. Enabling `code_run` or `shell_exec` is appropriate only for an
explicitly trusted, disposable worker or an external sandbox with OS-level
containment. Command blocklists are defense in depth, not an authorization
mechanism.

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
