# Native Gateway service templates

`node tools/render-gateway-service.mjs` prints a platform service definition for
the existing `apps/ai-gateway-service/src/index.js` HTTP entrypoint. It does not
read environment files, install/register a service, spawn the Gateway or migrate
state. The OS owns restarts; no extra supervisor or dependency is introduced.
MCP remains a separate service with its own entrypoint and logs.

Use the repository's supported Node version (`>=22.18.0`), an absolute Node binary,
a **fixed actual installation directory**, and an explicit private environment
file outside the checkout. The renderer's flag is `--private-env-file`; generated
Node commands use `--env-file=...`. This distinction avoids Node interpreting the
renderer's argument as its own env-file option before running the renderer.
Missing private files stop the generated Gateway command. Inherited environment
variables override file values, so deployment accounts must not carry conflicting
Gateway or Node options. See [Node's env-file behavior](https://nodejs.org/api/cli.html#--env-filefile).

The private file must set a nonempty `PME_AUTH_TOKEN`,
`PME_ENTERPRISE_AUTH_ENABLED=true`, `AI_GATEWAY_PROVIDER_MODE=fake`,
`AI_GATEWAY_SERVICE_HOST=127.0.0.1`, the chosen `AI_GATEWAY_SERVICE_PORT`, and
`AI_GATEWAY_SHUTDOWN_TIMEOUT_MS=10000`, along with the explicit state paths below.
Restrict the file and state directories to the service account. Never include
secret values in service definitions, source control, command-line arguments or
review evidence. Real-provider operation requires its own approved configuration.

## Generate and inspect definitions

These examples only print definitions. Redirect the output to a new review file
with UTF-8 encoding if needed; do not overwrite a registered definition during
review. The renderer rejects relative/traversal/control paths, unsupported options
and platforms. Paths with double quotes are unsupported; other supported path
characters use the destination platform's quoting rules.

```sh
# Linux user unit; --scope system --user uai-gateway renders a system unit instead.
node tools/render-gateway-service.mjs --platform linux --node /usr/bin/node --install-root /opt/uai --private-env-file /private/uai/gateway.env

# macOS LaunchAgent; log-dir must already be a private, writable persistent directory.
node tools/render-gateway-service.mjs --platform macos --node /opt/homebrew/bin/node --install-root /Users/operator/uai --private-env-file /Users/operator/private/gateway.env --log-dir /Users/operator/Library/Logs/uai-gateway
```

```powershell
node tools/render-gateway-service.mjs --platform windows --node 'C:\Program Files\nodejs\node.exe' --install-root 'E:\UAI' --private-env-file 'E:\Private\gateway.env' --user 'MACHINE\operator'
```

| Platform | Generated lifecycle and later installation boundary |
| --- | --- |
| Linux systemd user | `default.target`, journal output, restart on failure; later install as `~/.config/systemd/user/unified-ai-system-gateway.service`. User session/linger policy is a separate host decision. |
| Linux systemd system | Explicit non-root `User=`, `multi-user.target`, journal output; later install as `/etc/systemd/system/unified-ai-system-gateway.service`. This tool does not create accounts or grant permissions. |
| Windows Task Scheduler | Explicit interactive user, logon trigger, least privilege, `IgnoreNew`, no duration limit, three restart attempts one minute apart. Save XML for later Task Scheduler import; no password or SYSTEM account is embedded. |
| macOS LaunchAgent | GUI session owner, run at load, restart on unsuccessful exit, five-second throttle and explicit log files; later use `~/Library/LaunchAgents/io.github.happy520ai.unified-ai-system-gateway.plist`. This is not a boot-time LaunchDaemon. |

Validate a saved Linux unit with `systemd-analyze verify`, a macOS plist with
`plutil -lint`, and Windows XML against the
[Task Scheduler schema](https://learn.microsoft.com/en-us/windows/win32/taskschd/task-scheduler-schema)
before authorizing installation. The renderer escapes systemd `%` specifiers and
argument `$` expansion separately from `WorkingDirectory`; dollar signs in the
Node executable path are unsupported. Windows arguments use Windows quoting plus
XML escaping and reject `%` expansion markers. LaunchAgent arguments are separate
plist strings with XML escaping; restart timing is at the plist's top level.
See the [systemd command rules](https://github.com/systemd/systemd/blob/main/man/systemd.service.xml)
and [Apple's LaunchAgent guide](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html).

The Linux and macOS stop timeout is 15 seconds for the configured 10-second Gateway
shutdown deadline. Windows Task Scheduler termination can be a hard process stop;
this template does not establish graceful draining on Windows. Test crash recovery
for the chosen state configuration before relying on it. `IgnoreNew` only protects
one task definition; never create a second task or service against the same state.
After an authorized start, check `/ready`, `/health/check` build identity and an
authenticated fake request. Parsing a service definition proves none of these.

## State paths: WorkingDirectory is not a global data-root setting

Let `R` be the actual repository installation root derived from module locations,
`S = R/apps/ai-gateway-service`, and `C` the process working directory. These
templates set `C = R` for compatibility. Changing C cannot change module-derived
R or S; replacing a versioned checkout/symlink can change those roots. There is no
supported universal `--state-root` switch.

| State owner | Current default resolution | Explicit configuration / preservation |
| --- | --- | --- |
| Agent Governance | `R/.data/agent-governance` | `AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR`; use a stable absolute path. An in-repository path must remain under protected `R/.data`. |
| Workflow records and artifacts | `R/.data/workflows` | `WORKFLOW_OUTPUT_DIR`; keep its directory/file identities and durable records together. |
| Local-client registry, execution log, discovery hints | `R/.data/local-clients/{registry.json,execution-log.jsonl,discovery-hints.json}` | `AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH`, `AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH`, `AI_GATEWAY_LOCAL_CLIENT_DISCOVERY_HINTS_PATH`. |
| Local-client route plans, authority epoch, execution control | `R/.data/local-clients/{route-plans.sqlite,verification-authority-epoch.sqlite,execution-control}` when applicable | `AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH`, `AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH`, `AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CONTROL_DIR`; optional receipt/PoP/outbox stores also retain their separately configured paths. |
| Model-library catalog/test/default-selection state | Legacy `S/evidence/phase-312a-model-library-state.json` | **New:** `AI_GATEWAY_MODEL_LIBRARY_STATE_PATH` passes a storage path to the existing store. Use an absolute protected path. Unset preserves the legacy default; no copying or migration occurs. |
| Enterprise users and API-key counters | `C/.data/enterprise/{users.json,api-keys.json}` | `PME_ENTERPRISE_USER_STORE_PATH`, `PME_API_KEY_STORE_PATH`; keep additional revocation/auth state under the same preserved runtime tree. |
| Enterprise audit and checkpoints | `C/.data/audit/enterprise-audit.jsonl`, its `.chain`, and configured checkpoint files | `PME_AUDIT_LOG_PATH`, `PME_AUDIT_CHAIN_PATH`, `PME_AUDIT_CHECKPOINT_PATH` plus existing checkpoint key/anchor references. Backups use `PME_ENTERPRISE_BACKUP_DIR` and `PME_ENTERPRISE_BACKUP_CHECKPOINT_DIR`. |
| Usage/request logs | `C/.data/request-logs` | `AI_GATEWAY_USAGE_LOG_DIR`. |
| Knowledge document/vector persistence | Memory by default; configured disk modes default to `C/.data/knowledge` | `KNOWLEDGE_PERSISTENCE_DIR`, `KNOWLEDGE_FILE_STORE_PATH`, `KNOWLEDGE_SQLITE_PATH`, `KNOWLEDGE_SQLITE_VEC_PATH`. Changing paths does not enable a persistence mode. |
| Controlled workforce execution | Primarily `C/.data/workforce`, with sandbox-merge derived from R | `WORKFORCE_EXECUTION_DIR` routes its supported stores; other cwd-based workforce state still requires preserving `C/.data/workforce`. |
| Optional Provider-dispatch/external-effect/idempotency state | C-relative `.data` SQLite/HMAC paths when enabled/configured | Preserve each configured database and secret/anchor reference; use existing `AI_GATEWAY_PROVIDER_DISPATCH_*`, `AI_GATEWAY_EXTERNAL_EFFECT_*`, `AI_GATEWAY_IDEMPOTENCY_*` path settings for the enabled mode. No mode is enabled by these templates. |
| Legacy capability/neuron state | `S/.data/capabilities` derived from module location | Preserve `S/.data`; no single factory env override covers these paths. |
| Legacy persistent response cache | `S/evidence/response-cache` derived from module location | Preserve this exact directory if the feature is used; this batch does not relocate its module-default store. |
| Optional persisted runtime Provider credentials | Memory by default; local-file/SQLite modes use `LOCALAPPDATA` or `homedir()/.pme-moving-earth`, then `PME-Moving-Earth/unified-ai-system/` | `PME_RUNTIME_CREDENTIAL_STORE_PATH` and the existing encryption mechanism. Preserve the service account, protected key references and selected store; C has no effect on the home-derived default. |

The mapping follows the actual
[application factory](../../apps/ai-gateway-service/src/application/createGatewayApplication.js),
[workflow owner](../../apps/ai-gateway-service/src/workflow/localWorkflowService.js),
[enterprise owner](../../apps/ai-gateway-service/src/enterprise/enterpriseGovernanceService.js),
[knowledge persistence](../../apps/ai-gateway-service/src/knowledge/knowledgePersistence.js),
[capability roots](../../apps/ai-gateway-service/src/capabilities/neuronRuntimeConstants.js),
[cache defaults](../../apps/ai-gateway-service/src/cache/responseCacheStore.js) and
[credential path resolver](../../apps/ai-gateway-service/src/providers/runtimeCredentialStore.js).
It does not claim that every opt-in feature is persistent or centrally relocatable.

For a new installation, assign absolute external paths for the table's required
state and use a stable installed R for defaults that cannot be relocated. Retain
`R/.data`, `S/.data` and applicable legacy evidence-state paths across source updates.
A real filesystem mount can preserve an exact path; symlinks/junctions are not a
substitute where governance/workflow identity checks prohibit them. Neither the
renderer nor a WorkingDirectory value proves that a mount exists or contains the
original data. Do not deploy by deleting R or switching disposable release folders
unless every required state path and original-file identity constraint is handled.

For an existing installation, record the service account, actual R/C/S and all
configured paths before changing configuration. Stop the sole process, take a
protected consistent backup, and explicitly copy only the intended model-library
state to the new absolute destination if adopting its new override. Preserve the
original file for rollback and verify reload from the new destination before
resuming. Do not replace it with an empty file to make a startup succeed. Workflow
and local-client receipts can depend on device/inode/birthtime identities; copying
bytes to new files does not establish their recovery. No automatic migration or
editing of receipt/anchor state is performed.

Upgrade source/dependencies while retaining these exact state locations, service
identity, private environment file and previous release artifact. Roll back the
source and definition together; if data formats changed, restore a verified
compatible backup while stopped. A second code directory cannot safely share
single-process JSON counters or local SQLite state with the first. These templates
do not provide multi-host HA or Kubernetes support.

## MCP correction and evidence boundary

The existing MCP systemd builder now receives its selected scope: user units use
`default.target`, system units use `multi-user.target`. Both send stdout/stderr to
the journal instead of making a user service write `/var/log`. The MCP daemon's
own rotating file log remains its existing `R/logs/mcp-service.log` or explicit
log-file option; the service account still needs access to that separate path.
Only generated content is tested here; no installed MCP service is modified.

Focused checks are `node --test tools/render-gateway-service.test.mjs` and the
MCP package tests. The application test exercises explicit model-library storage
and reloading synthetic state. Systemd, Task Scheduler and launchd runtime startup,
restart, shutdown, login persistence and upgrade recovery remain separate native
host evidence. Existing Windows direct-Gateway and Linux amd64 container checks,
including the DPL02 same-volume recreate/rollback on two older images, do not prove
these generated services or the current changed source has run on those platforms.

## Language Selection

Workload: format three bounded OS service definitions and pass one explicit storage
path through the existing factory. Node.js ESM reuses the repository's ops runtime;
TypeScript would add an ops loader/compile step, and PowerShell alone would impose
a shell dependency on Linux/macOS. Domain fit/maintenance/operability/safety/migration
debt/ecosystem scores are Node ESM `5/5/5/4/5/5` (29/30), TypeScript `4/4/4/5/4/5`
(26/30), PowerShell `4/3/2/4/3/2` (18/30). Existing JS owners receive only local edits.

Nine files are required for the renderer/test, MCP builder/test, their two existing
test entrypoints, factory/test and this runbook. There is no generic deployment
framework, new dependency, supervisor or store. Rollback removes the renderer,
restores the MCP builder and removes the optional factory mapping; deployments
using that mapping must first preserve/repoint their model-library state explicitly.
No public HTTP contract, Provider selection default or automatic activation changes.
