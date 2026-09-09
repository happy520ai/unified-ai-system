# Local AI Control Center

The local AI control center is the first personal-developer product surface. It
answers one question without changing state: are multiple opted-in clients
actually using one gateway control plane for models, budget accounting, and MCP
tool access?

## Inspect the control center

Set the admin virtual key in the environment so it is not stored in shell
history, then run:

```bash
pnpm gateway control-center
pnpm gateway control-center --json
```

`center` is a short alias. `--url` and `--timeout` select a different
self-hosted gateway in the same way as the other networked CLI commands.

The status operation is strictly read-only. It reads:

- gateway health, chat readiness, Provider mode, and Provider identifiers;
- the OpenAI-compatible model catalog exposed by the shared gateway URL;
- tenant-level aggregate virtual-key and budget usage, without returning key
  identifiers or credentials;
- the redacted local-client registry;
- the three governed onboarding profiles and each profile's exact installation
  state.

Status never writes client configuration, creates a key, changes a budget, enables
a Provider, sends a chat request, or calls a Provider.

## Configure several clients from one manifest

The checked-in example is a credential-free desired-state document:

```json
{
  "schema": "unified-ai-system/local-ai-control-center/v1",
  "gatewayUrl": "http://127.0.0.1:3100",
  "profiles": [
    "claude-compatible-mcp-json",
    "cursor-mcp-json",
    "vscode-mcp-json"
  ]
}
```

The v1 manifest retains its two-or-three JSON profile contract. Use the explicit
v2 schema to select two to six profiles across JSON, JSONC, TOML and YAML:

```json
{
  "schema": "unified-ai-system/local-ai-control-center/v2",
  "gatewayUrl": "http://127.0.0.1:3100",
  "profiles": [
    "cursor-mcp-json",
    "vscode-mcp-jsonc-v1",
    "codex-mcp-toml-v1",
    "continue-mcp-yaml-v1"
  ]
}
```

Each selected profile must already be configured and available at this gateway.
The manifest selects its existing path and format contract; it does not supply
new filesystem paths. The parser rejects extra keys, invalid profile counts,
duplicates, unknown profiles or schema versions, URL credentials, URLs that
disagree with `--url`, symbolic links, paths outside the current working
directory, invalid JSON, and files above 32 KiB.

Plan every profile without changing client configuration:

```bash
pnpm gateway control-center configure \
  --manifest docs/examples/local-ai-control-center.json \
  --json
```

After reviewing the manifest and plan output, apply the same desired state:

```bash
pnpm gateway control-center configure \
  --manifest docs/examples/local-ai-control-center.json \
  --apply --yes \
  --idempotency-key personal-setup-001 \
  --json
```

The supplied prefix is extended into distinct approval and apply keys for each
profile. The CLI sends each request once, stops at the first rejected or
unknown result, preserves earlier redacted receipts in its JSON result, and
does not attempt automatic rollback. Configuration of several independent
client files is therefore ordered and fail-stop, not cross-file atomic.

An uncertain apply is reported with `clientConfigOutcomeUnknown: true`. If no
earlier apply receipt was confirmed, `clientConfigWritesPerformed` is `null`
and status is `unknown-reconcile-required`; a lost first receipt must never be
reported as proof that no client file changed. Earlier confirmed receipts remain
in `completed`, and the failed operation (`approve` or `apply`) stays explicit.
Post-apply inspection does not replace the missing authoritative receipt.

After success, restart or reload every client and rerun `control-center`. An
already-open desktop application is not proven to have loaded new MCP settings
until it is observed independently.

Run the isolated real-gateway smoke without Provider credentials:

```bash
pnpm smoke:control-center
```

It starts the actual gateway on an ephemeral loopback port, creates one
temporary budgeted virtual key, applies the manifest to three temporary JSON
client files, and launches three real MCP protocol sessions from those entries.
Each session calls `gateway_chat` against the same gateway and fake model using
the same virtual-key budget. The smoke then verifies aggregate request/token
usage, closes every owned process and resource, and removes the temporary root.
It does not start the actual Claude/Cursor/VS Code applications or call a real
Provider.

Native `/chat` budget admission and successful token accounting occur inside the
idempotent execution operation. Replaying its completed result, including a
concurrent duplicate, does not charge another request or token usage. This is
different from making a new request that happens to hit the response cache.

## Readiness contract

The command exits `0` only when all five checks are ready:

| Check | Required evidence |
| --- | --- |
| Gateway | health is `ready` and chat readiness is true |
| Models | at least one model is exposed at the shared gateway URL |
| Budget | the authenticated tenant has at least one active virtual key |
| Clients | at least two onboarding profiles are installed exactly |
| Tools | those installed profiles point to the same `unified-ai-system` stdio MCP server |

An incomplete setup still returns the redacted snapshot and concrete next
actions, but exits `1`. Invalid input exits `2`. Missing or invalid authority
fails before the command can report readiness.

## Evidence boundary

This checkpoint proves control-plane visibility, not application control. In
particular:

- MCP onboarding does not read or reroute Codex, ZCode, Claude, or another
  client's native login, Base URL, model path, or quota;
- an `exact` profile state means the governed JSON MCP entry matches the
  registered profile; it is not proof that an already-open desktop session has
  reloaded it;
- the model catalog and spend totals are gateway observations, not a real
  Provider call or Provider-side billing statement;
- the smoke proves three MCP processes share one fake model and one virtual-key
  budget through native `/chat`; it does not prove a desktop application's
  native model channel was rerouted;
- profile fixtures remain `fixture-tested-not-real-client-certified` until a
  named real client passes its own runtime certification.

The manifest flow preserves the existing per-client plans, approvals,
idempotency records, redacted receipts, and rollback API. It does not invent a
weaker parallel configuration writer.

The v2 flow uses the same sequential operation: plan every selected profile,
then approve and apply each one with a separate idempotency key. Its completed
receipts retain each profile's format and transaction identity. A failure stops
later mutations; completed clients are not automatically rolled back. Use their
individual receipts with `clients-onboarding plan --action rollback` followed by
approval and rollback. Do not convert a receipt to another format or assume a
batch is an atomic transaction across clients.

Actual HTTP/CLI tests configure JSON, JSONC, TOML and YAML together, verify four
independent approvals and receipts, and restore each original byte sequence via
its own governed rollback. The existing v1 tests retain the unknown-result and
partial-application boundaries. These tests do not certify that four native
applications loaded their configuration.

## Language Selection

The v2 manifest addition is a local change to the existing ESM JavaScript CLI
parser; it reuses the current format validators and the existing governed APIs.
A new batch service or transaction layer would duplicate those owners. No new
dependency, endpoint or persistent schema is introduced by v2. Reverting the CLI
addition restores v1 parsing; configurations already written still require their
original receipts and compatible per-format rollback support.

- **Workload:** add a control-center CLI and make virtual-key accounting cover
  its shared MCP `gateway_chat` path.
- **Primary path:** `apps/agent-console/src/cli-core.js` and the existing
  `httpServerRoutes06.js`; no new application runtime language is introduced.
  The reproducible smoke remains Node.js ESM under `tools/`, matching the
  repository's tooling policy.
- **Alternative A:** TypeScript offers stronger local typing and the supported
  Node runtime can load it. Extracting this already implemented CLI flow solely
  to change its language would add a module migration and a larger compatibility
  review without a measured runtime benefit for the current task.
- **Chosen language:** retain the existing Node.js ESM CLI and native-route
  integration while selectively restoring the implemented control-center flow.
  No dependency, generic control plane, or new service is introduced. New budget
  regression tests use the existing gateway TypeScript convention.
- **Compatibility/rollback boundary:** no endpoint or persisted schema changes.
  Authenticated virtual-key calls to existing non-streaming `/chat` now enter
  the same budget check/record flow as compatible chat. Reverting that route
  hook and the control-center files restores prior behavior.
  Code rollback does not undo committed client configuration; use the retained
  per-client receipts and existing governed rollback API for that operation.
- **Policy impact:** admin authority is required; output is projected and
  redacted; virtual-key `/chat` usage is now accounted; fake-provider defaults,
  native client authentication, and Provider enablement are unchanged.
- **Verification coverage:** the Agent Console suite covers the complete
  ready state, incomplete two-client state, no-authority refusal, zero-mutation
  planning, complete three-client application, fail-stop partial application,
  receipt retention, URL/manifest rejection, credential non-disclosure, and an
  isolated actual-gateway smoke with three temporary client files, three MCP
  processes, three shared fake-model calls, and one shared budget ledger.
- **Size rationale:** the 11-file change restores the CLI, bounded manifest
  example, discoverable usage documentation, native budget integration, tests,
  and isolated smoke as one operable flow. The additional native tests cover
  idempotent/concurrent replay without duplicate charges and unavailable
  accounting; the CLI covers a lost first apply receipt without claiming no
  file changed. The size is required by that operation and evidence chain.

The smoke includes a candidate HEAD, clean/dirty source status, a digest of eight
relevant runtime files, and stage timings. Failed CLI reads report only the
surface, safe error code/kind, exit code and elapsed time. It never reports an
unstructured remote error payload. A HEAD or digest change during the smoke is a
failure; final candidate acceptance should run on a frozen clean commit. Keep
earlier failed runs even when a later run succeeds.
