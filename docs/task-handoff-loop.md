# Task Handoff Loop

This page documents how a task card is produced, delivered to an MCP client,
executed, and reported back. The loop is preview-only: producing or delivering a
card never executes it.

## Endpoints

| Method and path | Required scope | Effect |
| --- | --- | --- |
| `GET /codex-handoff/next-task` | `provider:read` | Returns the current task card and its rendered Markdown. Writes nothing. |
| `POST /codex-handoff/next-task` | `workflow:run` | Renders the same card to `.codex-handoff/outbox/latest-codex-task.md` and `.codex-handoff/outbox/latest-codex-task.json`, and returns the payload with an added `safety` block. |

Both responses use the standard ok envelope. `.codex-handoff/` is gitignored, so
delivered cards stay local and never enter a commit.

The read path is deliberately separated from the write path: a client can poll
the next card with a read-only scope and never gain the ability to publish one.

## Card Schema

`createNextCodexTask()` returns these fields:

| Field | Meaning |
| --- | --- |
| `taskId` | Stable identifier for the round |
| `title` | One-line statement of the round |
| `createdAt` | ISO timestamp |
| `projectRoot` | Absolute repository root the card applies to |
| `currentStatus` | Facts the executor must not contradict |
| `roundGoal` | What this round must produce |
| `whyNow` | Why the round is worth running |
| `allowedScope` | The only actions permitted |
| `blockedScope` | Actions that must not happen |
| `requiredCommands` | Commands that must be run |
| `stopConditions` | Conditions that end the round immediately |
| `outputFormat` | Lettered sections the report must contain |
| `markdown` | The card rendered for pasting into a client |

Four safety fields are constants, not negotiable inputs:

- `mode: "manual-handoff-only"`
- `executionEnabled: false`
- `codexExecInvoked: false`
- `approvalPreviewIsExecutionPermission: false`

The last one is the governing rule of this loop: **an approval preview is never
an execution permission.** The gateway describes work; a human or a client host
decides whether to run it. The `POST` payload restates this in its `safety`
block, which also records `codexCliInvoked`, `workflowRunnerConnected`,
`worktreeCreated`, and `autoCommitPush` as `false`.

## Standard Loop

1. **Fetch.** The client calls `GET /codex-handoff/next-task` and reads the card.
2. **Deliver (optional).** An operator calls `POST /codex-handoff/next-task` to
   write the card to the outbox for hosts that read files instead of HTTP.
3. **Confirm scope.** The client checks that every action it plans to take is in
   `allowedScope` and absent from `blockedScope`.
4. **Run.** The client runs `requiredCommands` and nothing else.
5. **Stop early.** If any entry in `stopConditions` becomes true, the client
   stops at once and reports the condition instead of working around it.
6. **Report.** The client answers every letter in `outputFormat`.
7. **Propose.** The report's final section proposes the next card, which becomes
   the input to the next round.

A round that ends on a stop condition is a successful round. Reporting a blocked
state is the expected outcome, not a failure to be papered over.

## Read-Only Connection Verification Card

This card is the smallest complete instance of the loop. It uses only MCP tool
calls, so any MCP host can run it without shell access, and it modifies nothing.

- **taskId:** `mcp-connection-verification-readonly`
- **title:** Verify a managed MCP gateway connection without touching the tree
- **roundGoal:** Prove the host discovered the governed tool set, that the
  managed gateway is authenticated, that real provider calls are disabled, and
  that the managed process is reclaimed on disconnect.
- **allowedScope:**
  - List the host's tools for this server.
  - Call `gateway_health`.
  - Call `gateway_readiness`.
  - Call `gateway_chat` once, and label the output as fake-provider.
- **blockedScope:**
  - Do not modify any file.
  - Do not commit or push.
  - Do not write to `.codex-handoff/outbox/`.
  - Do not supply a provider key.
  - Do not enable or attempt a real provider call.
  - Do not change the default `/chat` route or provider selection.
- **requiredCommands:** the MCP requests `tools/list`, then `tools/call` for
  `gateway_health`, `gateway_readiness`, and `gateway_chat`.
- **stopConditions:**
  - The tool count is not twelve.
  - `gateway.realProviderCallsAllowed` is true.
  - `gateway_chat` reports an `executionMode` other than `fake`.
  - Any tool returns `401` with `enterprise_token_expired`.
  - A managed gateway port is still listening after the host disconnects.
- **outputFormat:**
  - A. Tool count and the tool names.
  - B. `gateway_health`: status, `managed`, `authenticated`.
  - C. `gateway_readiness`: the real-provider boundary.
  - D. `gateway_chat`: `executionMode` and `selectedProvider`.
  - E. Managed loopback port, and whether it was reclaimed after disconnect.
  - F. Any `401` or token-expiry occurrence.
  - G. Files modified. Must be none.
  - H. Proposal for the next card.

Section F exists because a long-lived host previously lost every authenticated
tool once a fixed token window elapsed. Any reappearance of
`enterprise_token_expired` is a regression, not an operational hiccup.

## Evidence Boundary

The card above has been run against the three converged local hosts described in
[MCP client compatibility](mcp-client-compatibility.md). Each host discovered
twelve tools, reported an authenticated managed gateway with real provider calls
disabled, returned fake-provider chat output, held its own loopback port, and
released that port on disconnect.

That is protocol and launch-parameter evidence produced by a config-equivalent
host in this repository. It does not certify any vendor client UI, and it does
not claim production readiness, L5 autonomy, or AGI. Regenerate it locally with
the harness under `apps/ai-gateway-service/evidence/`; its output is gitignored
because it records machine-specific ports and process ids.
