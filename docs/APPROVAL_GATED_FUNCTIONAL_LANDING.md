# Phase319A Approval-gated Functional Landing

Phase319A removes Workbench preview-only posture for the currently visible
functional buttons. Safe features are `real_enabled`, risky local actions are
`approval_required`, and high-risk actions stay `blocked_by_policy` with a
clear reason.

## real_enabled

- New session resets current messages, current task summary, and evidence
  status without changing Provider or model configuration.
- Model configuration reads Provider status and model library routes, and the
  page model selection is stored in localStorage.
- Chat send continues through the existing Chat Gateway dry-run or execute
  path and writes evidenceId into the UI.
- Quick search scans the local Workbench feature registry and help text only.
- Help, diagnostics, settings, and Provider config are wired to real local UI
  or read-only service routes.

## approval_required

- Local Agent generates intent preview, operation plan, patch proposal, and an
  approval record before any apply.
- Safe repair creates a dry-run patch proposal and approval record.
- Approval queue supports create, approve, reject, and rejected records cannot
  execute.
- Apply-approved requires approvalId and is limited by allowedFiles and
  forbiddenPaths.
- File context records only user-selected file metadata and blocks `.env`,
  secret, token, and credential-like names.
- Plugin registry is real and visible, but plugins are disabled by default and
  execution requires approval.

## blocked_by_policy

The following remain blocked in this phase: full-open, reading `.env`, printing
API keys, secret/token disclosure, commit, push, deploy, release, git reset,
git clean, unapproved local command execution, paid API auto-calls, and
embedding batch training.

Blocked actions must report `providerCalled=false`,
`localExecutionTriggered=false`, and no file mutation.

## Boundaries

- Default `/chat` behavior is unchanged.
- No MiMo, OpenAI, Claude, OpenRouter, or paid provider call is made.
- No API key or secret is printed in docs, evidence, UI, or logs.
- `legacy/` remains untouched.
- The workspace may be dirty; Phase319A must not claim workspace clean.
- Boundary phrase for verification: workspace dirty is allowed and is not a
  phase failure by itself.

## Phase320A Real Browser Gate

Phase320A is a hard gate for real-browser acceptance. DOM-only checks, HTTP
route simulations, and programmatic click probes are not enough to claim a
real browser pass.

- A pass requires `realBrowserUsed=true`.
- A pass requires `browserPluginAvailable=true`.
- If Browser Use cannot run because the required `node_repl js` surface is not
  exposed, or Playwright CLI cannot be executed in the current environment,
  Phase320A must fail with `blocker=real_browser_plugin_unavailable`.
- The live `/ui` page may still be checked for smoke markers such as
  `AI Gateway Workbench`, absence of `PME 移动地球`, and presence of the Chat
  shell, but those checks do not upgrade the result to a real browser pass.
- workspace dirty is allowed and is not a phase failure by itself.
