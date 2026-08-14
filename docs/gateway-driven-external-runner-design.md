# Gateway-Driven External Runner (Design Only)

**Status: design only. Not implemented. No runtime code implements this
document.**

Today the [task handoff loop](task-handoff-loop.md) stops at delivery: the
gateway renders a task card, and a human or a client host decides whether to run
it. This page describes what it would take for the gateway to drive an external
runner process directly, and why that capability stays closed until the
repository owner grants written authorization.

Nothing here may be implemented before that authorization exists. A design
review is not an approval, and an approval preview is not an execution
permission.

## Goal And Non-Goals

Goal: allow an authorized operator to hand a task card to an external runner
process that executes the card's `requiredCommands` inside the repository, under
an audited approval gate.

Non-goals, all of which stay closed by this design:

- Autonomous execution without a human decision per round.
- Real provider calls, or reading provider credentials.
- Changing the default `/chat` route or provider selection.
- Automatic `git commit`, `git push`, release, or deployment.
- Claims of production readiness, L5 autonomy, or AGI.

## Why This Is Gated

An external runner turns a description of work into real local side effects. The
existing loop is safe because the gateway's most privileged output is a Markdown
file in a gitignored outbox. Driving a runner removes that gap, so it needs its
own authorization, not an inherited one.

## 1. Token Scope Design

Permissions are matched exactly. `isPermissionAllowed` accepts only an exact
scope string or the `*` wildcard; roles grant nothing implicitly. Least
privilege is therefore expressed purely by the scope list on the identity.

The managed MCP identity (`userId` and `tenantId` both `managed-mcp`, role
`operator`) currently holds five scopes:

```
session:read  dashboard:read  chat:use  knowledge:read  workflow:run
```

It deliberately does **not** hold `provider:write`, `knowledge:write`,
`memory:write`, `connector:write`, `workflow:approve`, `audit:read`, or
`user:admin`.

This design would add exactly one new scope rather than widening an existing
one:

| Scope | Grants | Withheld from |
| --- | --- | --- |
| `runner:execute` | Submit an approved task card to the external runner | The managed MCP identity, by default |

Two rules follow:

- `runner:execute` must never be added to the managed MCP identity's default
  scope list. A managed MCP child process is created automatically when a client
  connects; it must not inherit the ability to run commands.
- `runner:execute` must not imply `workflow:approve`. Submitting an approved card
  and approving a card are separate scopes held by separate identities, so one
  compromised token cannot both approve and execute.

### Prerequisite: a scope inversion in the handoff routes

The handoff endpoints resolve to asymmetric scopes:

| Route | Required scope | Held by managed MCP identity |
| --- | --- | --- |
| `GET /codex-handoff/next-task` | `provider:read` | No |
| `POST /codex-handoff/next-task` | `workflow:run` | Yes |

The managed MCP identity can therefore publish a card to the outbox but cannot
read one back. That inversion is harmless while cards are only read by humans,
but it must be resolved before a runner depends on the read path, and it should
be resolved by narrowing the write side rather than by widening the managed
token. This document does not change it; it is listed here as a prerequisite for
the owner to rule on.

## 2. Command Whitelist

The runner must execute from an explicit allowlist derived from the card's
`requiredCommands`, and must additionally reject anything matching the existing
`PATCH_BLOCKED_COMMANDS` denylist:

```
git add    git commit    git push    git reset    git clean
deploy     release       curl        codex exec
```

Whitelist rules:

- A command runs only if it appears verbatim in the card's `requiredCommands`.
- The denylist is applied after the allowlist and always wins.
- Path arguments are rejected if they touch `PATCH_FORBIDDEN_PATHS`, which
  already covers `.git`, `.git/`, `node_modules`, `node_modules/` plus the shared
  `BLOCKED_PATHS` set.
- Network egress stays closed. `curl` is denied, so a card cannot turn the runner
  into an outbound fetch tool.
- `codex exec` is denied, so the runner cannot recursively spawn another agent
  runner.
- Reuse `PATCH_RUNNER_DEFAULTS` as the starting posture: `dryRun: true`,
  `humanApprovalRequired: true`, `realPatchApplyDefault: false`,
  `autoCommit: false`, `autoPush: false`, `releaseOrDeployAllowed: false`,
  `fullOpenEnabled: false`, `maxOperations: 25`.

## 3. Approval Gate

The gate reuses the existing agent-runner policy rather than introducing a
parallel one.

**Mode selection** uses `getPatchApprovalPolicy(mode)`, restricted to
`PATCH_RUNNER_ALLOWED_MODES`:

| Mode | Approval scope | Task-level approval |
| --- | --- | --- |
| `manual` | `patch` only | Not allowed |
| `auto_review` | `task` or `patch` | Allowed |

Both modes hold `humanApprovalRequired: true`,
`requireApprovalBeforeApply: true`, `requireApprovalBeforeWrite: true`,
`autoCommit: false`, `autoPush: false`, `releaseOrDeployAllowed: false`, and
`fullOpenEnabled: false`. `full_open` is not a selectable mode:
`isPatchApplyApproved` returns false unless
`isFullOpenDisabledForPatchRunner()` is true, so a build with full-open enabled
can never execute an approved patch.

**Per-round verdict** uses `buildGoNoGoReview`, whose status is one of `go`,
`no-go`, `review-required`. The runner may proceed only on `go`. The function
already forces `no-go` when any blocker exists or when `boundaryCheck` reports
`fullOpenEnabled`, `autoCommit`, `autoPush`, or `releaseOrDeploy` as true, and it
returns `autoCommit`, `autoPush`, and `releaseOrDeploy` as hard `false`
regardless of input. `review-required` is produced by warnings, skipped
commands, or `approvalRequired`, and must be treated as a stop, not a soft pass.

**Sequence** for one round:

1. Operator fetches the card.
2. Operator approves, producing an approval record with `status: "approved"` and
   a `scope` of `task` or `patch`.
3. `isPatchApplyApproved(mode, approvalRecord)` must return true.
4. The command whitelist is applied to `requiredCommands`.
5. `buildGoNoGoReview` must return `go`.
6. The runner executes, bounded by `maxOperations`.
7. The runner reports in the card's `outputFormat`, and the round ends. Approval
   does not carry over to the next round.

## 4. Audit

Every decision point emits an audit record through the existing enterprise audit
path, including denials. At minimum: the identity, the resolved scope, the
card `taskId`, the approval record status and scope, the go/no-go status, each
command accepted or rejected with the rule that decided it, and the changed file
list. `audit:read` remains a separate scope, so a runner identity cannot read
the audit trail it writes.

## Authorization Checklist

Before any runtime code is written, the repository owner must rule on:

- [ ] Whether `runner:execute` is introduced at all.
- [ ] How the scope inversion in the handoff routes is resolved.
- [ ] Which identity may hold `runner:execute`, and confirmation that the managed
      MCP identity is excluded.
- [ ] Whether `auto_review` task-level approval is permitted, or only `manual`.
- [ ] Whether the runner is allowed to write files, or is limited to read-only
      command execution in its first iteration.
- [ ] The retention and review process for runner audit records.

Until every box is checked and the authorization is recorded, the gateway
continues to stop at delivery.
