# Unified AI System MCP Service

A self-starting, supervised wrapper around the existing
`@unified-ai-system/mcp-server`. Adds:

- **Auto-start at logon** - registers a Windows Task Scheduler task, systemd unit, or launchd job.
- **Crash auto-restart** - a Node supervisor watches the MCP server child and restarts it with exponential backoff.
- **Graceful shutdown** - SIGTERM, SIGINT, task stop, and systemd stop are propagated cleanly.
- **File logging** - logs to `logs/mcp-service.log` with rotation instead of polluting the JSON-RPC stream.
- **Local HTTP health endpoint** - `127.0.0.1:7788` exposes `/healthz`, `/readyz`, `/status`, `/logs`, and `POST /shutdown`.
- **WorkBuddy MCP connector registration** - installs or removes the entry in `~/.workbuddy/mcp.json` while preserving other servers.
- **Cross-platform** - Windows Task Scheduler, Linux systemd, and macOS launchd.

The 15 source-build MCP tools exposed by `@unified-ai-system/mcp-server`
(`gateway_health`, `gateway_readiness`, `agent_governance_status`,
`agent_governance_list`, `agent_governance_describe`, `gateway_prompt_enhance`,
`gateway_prompt_enhance_llm`, `gateway_chat`, `knowledge_readiness`,
`knowledge_retrieve`, `workflow_health`, `workflow_actions`, `workflow_run`,
`workforce_health`, `workforce_agents`) are unchanged by this supervisor. The authoritative tool
list lives in `packages/mcp-server/README.md`. Agent creation remains a human
REST/SDK/CLI operation until MCP generation has durable idempotency and
cancellation proof. This package only
adds a supervising layer and platform integration.

## Layout

```text
packages/mcp-service/
  src/
    daemon.js               # entry: creates logger + supervisor + health server
    supervisor.js           # crash-resilient child process supervision
    logger.js               # rotating file logger with stderr tee
    health-server.js        # localhost HTTP /healthz /readyz /status /logs
    installer.js            # OS-aware dispatcher
    installer-windows.js    # Task Scheduler + failure recovery
    installer-systemd.js    # systemd unit (Linux)
    installer-launchd.js    # launchd plist (macOS)
    workbuddy-register.js   # ~/.workbuddy/mcp.json merge helper
  bin/
    install.js              # service installer CLI
    start-service.js        # daemon entry point used by the OS service
  package.json
  README.md
```

## CLI

```bash
# Install the platform service AND register WorkBuddy
node packages/mcp-service/bin/install.js install

# Install but do not start (review first)
node packages/mcp-service/bin/install.js install --no-start

# Uninstall platform service AND WorkBuddy entry
node packages/mcp-service/bin/install.js uninstall

# Just query the service status
node packages/mcp-service/bin/install.js status

# Just register / unregister WorkBuddy
node packages/mcp-service/bin/install.js register
node packages/mcp-service/bin/install.js unregister
node packages/mcp-service/bin/install.js inspect

# Print diagnosed system state + last 20 log lines
node packages/mcp-service/bin/install.js diagnose

# Print detected platform ("windows", "systemd", or "launchd")
node packages/mcp-service/bin/install.js platform
```

All commands accept `--repo-root PATH`, `--node PATH`, `--log-file PATH`,
`--no-start`, `--no-register`, and `--workbuddy-config PATH`.

## Compatibility

- `pnpm mcp` still invokes the legacy one-shot stdio MCP server entrypoint through `bin/start-service.js --stdio`, so existing Codex/Cline setups keep working.
- The service installer does **not** replace the legacy `pnpm mcp` flow. Both coexist.

## Logging

By default the service logs to `<repo>/logs/mcp-service.log` with size-based rotation.
Set `MCP_SERVICE_TEE_STDERR=1` to additionally mirror logs to stderr (useful
when running interactively for debugging). Set `MCP_SERVICE_DEBUG=1` for
verbose log lines (including child-process SIGTERM/EXIT detail).

## Health endpoints

- `GET /healthz` - liveness; returns 200 if the daemon itself is up.
- `GET /readyz` - readiness; returns 200 only when the MCP child is running.
- `GET /status` - public service/version, running, uptimeMs, and restartCount only;
  diagnostic errors and stderr are excluded.
- `GET /logs?limit=N` - authenticated child stderr tail, at most N characters
  (default 8000; one integer from 1 to 64000).
- `POST /shutdown` - authenticated, once-only request to drain and exit the daemon.

All interfaces bind to `127.0.0.1` only. Other `MCP_SERVICE_HEALTH_HOST` values,
including `localhost`, `::1`, and `0.0.0.0`, are rejected before startup.

### Administration token lifecycle

Health probes remain available without a token. HTTP logs and shutdown are
disabled (503) unless the daemon receives `MCP_SERVICE_HEALTH_ADMIN_TOKEN`.
Use a dedicated random token generated from at least 32 random bytes; the
accepted encoding is 32-256 ASCII letters, digits, `.`, `_`, `~`, `+`, `/`, or `-`.
Admin requests require exactly one `Authorization: Bearer <token>` header;
wrong/missing/duplicate credentials return 401. Query parameters are not credentials.
Do not reuse a gateway or Provider credential.

For a foreground PowerShell session, generate and inject a token without printing
it or putting it in command-line arguments:

```powershell
$env:MCP_SERVICE_HEALTH_ADMIN_TOKEN = node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))'
try {
  node packages/mcp-service/bin/start-service.js --daemon --repo-root . --log-file .data/mcp-service.log
} finally {
  Remove-Item Env:MCP_SERVICE_HEALTH_ADMIN_TOKEN -ErrorAction SilentlyContinue
}
```

Provision the same token to an authorized HTTP client through its protected
environment/secret mechanism, never URLs, logs, shared files, or committed config.
The daemon keeps its authentication digest in memory and does not pass the admin
token to the supervised child, including explicit child environment overrides.

The installer does not persist or inject this token into Task Scheduler, systemd,
or launchd. Default installed services therefore keep HTTP administration disabled;
OS service-manager status/stop commands remain available. Administrators enabling
HTTP management must provision the daemon's environment using their platform's
protected service configuration. Rotate by stopping the service with its service
manager (or Ctrl+C for foreground mode), replacing both daemon/client tokens, and
restarting. Old tokens then return 401. HTTP `/shutdown` is not a permanent service
stop: auto-restart policies, including systemd `Restart=always`, may relaunch it.

## Verification

```bash
pnpm --filter @unified-ai-system/mcp-service check
pnpm --filter @unified-ai-system/mcp-service test
```

For end-to-end validation, after `install`:

```bash
node packages/mcp-service/bin/install.js status
curl http://127.0.0.1:7788/healthz
curl http://127.0.0.1:7788/readyz
```

## Uninstall

```bash
node packages/mcp-service/bin/install.js uninstall
```
