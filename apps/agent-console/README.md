# Agent Console

The terminal console operates the Unified AI Gateway through the shared SDK. It
does not read provider credentials or bypass Gateway authorization.

## Agent Governance

Set a scoped control-plane key in the environment. Keeping the key out of the
command line avoids exposing it through shell history and process listings.

```powershell
$env:AGENT_CONSOLE_ADMIN_KEY = "<scoped-key>"
pnpm gateway agents status
pnpm gateway agents list
```

Create and inspect an Agent:

```powershell
pnpm gateway agents generate --name report-reader --task "Read the report" --tool file_read --yes
pnpm gateway agents show --agent-id agt_<id>
```

Run and revoke an Agent:

```powershell
pnpm gateway agents run --agent-id agt_<id> --goal "Read README" --tool file_read --yes
pnpm gateway agents revoke --agent-id agt_<id> --reason operator_requested --yes
```

Review pending approvals and make the human decision:

```powershell
pnpm gateway agents approvals --agent-id agt_<id>
pnpm gateway agents approve --approval-id appr_<id> --yes
pnpm gateway agents reject --approval-id appr_<id> --yes
```

`generate`, `run`, `revoke`, `approve`, and `reject` require `--yes`. Each
mutation is sent once and is never retried automatically. If the transport
fails after dispatch, the console reports `AGENT_GOVERNANCE_OUTCOME_UNKNOWN`;
reconcile through `agents list`, `agents show`, `agents approvals`, and Agent
audit before issuing another mutation.

Agent runs default to `tool-mode=none`. Supplying `--tool` changes the default
to `readonly`; `--tool-mode none` cannot be combined with tools. Selecting a
provider other than `local-fake-provider` additionally requires
`--allow-real-provider`. The default Agent wall-clock budget is 60 seconds and
the console transport automatically adds a five-second completion cushion;
use `--run-timeout-ms` to choose a smaller or larger bounded run budget.

Policy creation and activation are intentionally absent from this command.
They remain platform control-plane operations, and Agent approval decisions
remain human console operations rather than MCP model tools.

Use `--json` for machine-readable output and `--url` to select a Gateway.

## Forge

The repaired Forge entry uses normal positional parsing:

```powershell
pnpm gateway forge status
```

Provider-backed and mutating Forge subcommands remain intentionally disabled
until they share the console's real-provider confirmation, one-shot mutation,
and unknown-outcome reconciliation gates.
