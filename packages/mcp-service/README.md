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
- `GET /status` - full state JSON: pid, uptime, restartCount, lastExit, last stderr tail.
- `GET /logs?limit=N` - last N bytes of the child stderr tail.
- `POST /shutdown` - drains the daemon gracefully and exits.

All interfaces bind to `127.0.0.1` only.

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
