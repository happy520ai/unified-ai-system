# Workforce Git workspaces

Workforce checks and creates worktrees in its configured repository. Git receives
only the process-launch environment it needs; `GIT_DIR`, `GIT_WORK_TREE`, injected
Git config, global config and system config cannot redirect these operations.
Hooks, filesystem monitors, recursive submodule checkout and network protocols
are disabled. Local filters and external attributes configuration, including local
includes and worktree configuration, block status checks and checkout.

Each candidate uses a fresh server-generated directory ID and a new branch. A
source ref is resolved to a commit before checkout; an existing branch or directory
is never reused. The source repository may itself be a linked worktree.

Creation, listing and status return immutable receipts. Cleanup uses private
manager records and verifies the canonical root before invoking Git. It verifies
both directory and Git-registration removal, then deletes the candidate branch
unless `preserveBranch` is explicitly selected. A failed removal retains the
record and reports failure, including through plan-level and expiry cleanup.
Branch deletion compares the ref against the HEAD observed immediately before
this manager removed its worktree. If the worktree disappeared externally, or
the branch moved after removal, cleanup retains the branch for review.

For a locked or otherwise failed removal, inspect the reported worktree with
`git worktree list --porcelain`, resolve its lock or Git error, and retry the same
manager's removal operation. The manager does not recursively delete folders or
prune unrelated Git registrations. Expiry cleanup only visits records created by
that manager; after a process restart, existing worktrees require operator review.
Directories cannot be treated as owned merely because they are old.

These checks protect repository invocation and cleanup ownership. They assume
the configured repository and worktree root remain under the operator's control;
they do not isolate arbitrary host code or authorize model-generated code to run.
Code delivery separately requires its approved scope, task claim and sandbox.
The existing explicit analysis-mode Git guard override remains observable as
`forceSkipped`; it is not evidence that a code-delivery baseline was verified.

## Language Selection

- Workload: bounded Git subprocesses, private worktree bookkeeping and checks.
- Reuse: the existing Workforce entrypoints and Node Git/folder primitives remain.
  Forge's worktree helper allows existing-path replacement, existing-branch reuse
  and broader cleanup, so its behavior cannot satisfy this ownership contract.
- Choice: a small internal TypeScript invocation helper serves both existing
  JavaScript entrypoints; retaining their filenames preserves existing imports.
  A new runtime language, dependency or public API is unnecessary.
- Impact: five files, no persistence migration, no automatic exit cleanup.
  Rollback restores the prior modules and removes the helper, test and this guide;
  review retained candidate branches and worktrees before any manual cleanup.
- Verification: actual temporary Git repositories cover redirection, hooks,
  includes, immutable receipts, branch preservation, linked sources, root
  replacement and cleanup failure/retry. These checks do not claim sandbox or
  production validation.
