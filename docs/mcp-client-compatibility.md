# MCP Client Compatibility Matrix

This page describes the published `v0.5.0` MCP entry points and the evidence
behind them. A documented install command is not a client certification: client
runtime claims require an actual report from that client.

## Published Baseline

- Image: `ghcr.io/happy520ai/unified-ai-system/mcp-server:0.7.0`
- Transport: local Docker process over MCP stdio
- Tools: twelve governed tools, including provider-free prompt enhancement
- Default mode: `local-fake-provider`; no provider key is required
- Source evidence: `pnpm verify:mcp` and `pnpm verify:public-clone`
- Registry: [official MCP Registry v0.5.0](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.happy520ai%2Funified-ai-system/versions/0.7.0)

## Source-Build Baseline

The current source tree adds MCP Streamable HTTP at
`http://127.0.0.1:3210/mcp`. `pnpm verify:mcp` uses the official MCP v2 client
to test both stdio and HTTP. It pins the stateless `2026-07-28` era, retains
legacy `2025-11-25` and `2025-06-18` negotiation, and checks modern routing
headers/CORS, access rejection, and managed-process cleanup. This HTTP entry
point is not part of the published `v0.5.0` image.

## Matrix

| Client path | Install or configure | First check | Evidence boundary |
| --- | --- | --- | --- |
| Official MCP SDK (automated baseline) | `pnpm verify:mcp` | Run `pnpm verify:mcp` and inspect JSON result | Protocol-level evidence. This also feeds `tools/verify-client-runtimes.mjs` certification records. |
| Codex | `codex mcp add unified-ai-system -- docker run --rm -i ghcr.io/happy520ai/unified-ai-system/mcp-server:0.7.0` | Run `codex mcp get unified-ai-system --json`, restart Codex, then use `/mcp verbose`. | Automated source-tree profile verified the official Codex App Server `0.147.0`, all twelve tools, a provider-free enhancement call, and cleanup without a model turn. |
| WorkBuddy | Declare `mcpServers.unified-ai-system` in `.mcp.json`. Keep any machine-absolute interpreter path as a local uncommitted override; see [local client convergence](#local-client-convergence). | Restart the host, confirm the twelve tools, then call `gateway_health`. | A config-equivalent host launched the exact `command`/`args`/`cwd` recorded in `.mcp.json`, negotiated MCP `2025-06-18`, discovered twelve tools, and returned fake-provider output. This is launch-parameter and protocol evidence, not a certification of the WorkBuddy UI. |
| ZCode | Declare `mcp.servers.unified-ai-system` in `.zcode/config.json`. The directory is gitignored because it stores a per-machine interpreter path. | Restart the host, confirm the twelve tools, then call `gateway_health`. | A config-equivalent host launched the exact `command`/`args`/`cwd`/`env` recorded in `.zcode/config.json`, negotiated MCP `2025-06-18`, discovered twelve tools, and returned fake-provider output. This is launch-parameter and protocol evidence, not a certification of the ZCode UI. |
| VS Code | Configure the source MCP server in an isolated VS Code profile. | Inspect `vscode.lm.tools`, then invoke `gateway_prompt_enhance` through `vscode.lm.invokeTool`. | VS Code `1.118.1` Extension Host discovered all twelve tools, invoked enhancement, made no model/provider request, and cleaned up. |
| Claude Code | Install the pinned host profile from [client runtime certification](client-runtime-certification.md). | The verifier runs Claude Code `mcp add` and `mcp list`. | Claude Code `2.1.227` issued the real MCP handshake and `tools/list`, discovered twelve tools, made no model/provider call, and cleaned up. |
| Gemini CLI | Install the pinned host profile from [client runtime certification](client-runtime-certification.md). | The verifier runs `mcp add`, the connection probe, and a minimal ACP initialization. | Gemini CLI `0.54.4` used its real MCP client to discover twelve tools without a prompt or model call; cleanup is verified. |
| OpenCode CLI | Install the pinned host profile from [client runtime certification](client-runtime-certification.md). | The verifier runs `opencode --pure mcp list` under isolated inline configuration. | OpenCode `1.18.16` discovered twelve tools, loaded no external plugin/configuration, made no model/provider call, and cleaned up. |
| Cursor Agent CLI | Configure `.cursor/mcp.json`, then use the pinned host profile from [client runtime certification](client-runtime-certification.md). | The verifier runs `mcp enable` and `mcp list-tools unified-ai-system`. | Cursor Agent CLI `2026.08.04-aaa8809` negotiated MCP `2025-11-25`, discovered twelve tools without account credentials or a model request, and cleaned up. |
| Cline CLI | `cline mcp install unified-ai-system --yes --json -- docker run --rm -i ghcr.io/happy520ai/unified-ai-system/mcp-server:0.7.0` | Run the pinned isolated profile from [client runtime certification](client-runtime-certification.md). | Cline `3.0.52` discovered twelve tools and called only read-only `gateway_health` through a local fake model; no real provider was enabled or called, and cleanup is verified. |
| Continue CLI | Declare the server in local `config.yaml`, or run the pinned host profile from [client runtime certification](client-runtime-certification.md). | The verifier launches `cn --config ... -p` against the local fake model. | Continue `1.5.47` negotiated MCP `2025-11-25`, discovered twelve tools, called only read-only `gateway_health`, made no real-provider attempt, and cleaned up. |
| Generic MCP stdio host | Add the `mcpServers.unified-ai-system` entry from [generic client configuration](mcp-generic-client.md). | Restart the host, confirm the twelve tools, call `gateway_health`, then `gateway_readiness`. | The JSON configuration and MCP server path are covered by the repository's provider-free verification. |
| Generic MCP Streamable HTTP host | Run `pnpm mcp:http` and configure `http://127.0.0.1:3210/mcp`. | List the twelve tools, then call `gateway_health` and `gateway_readiness`. | The source endpoint is protocol-tested. A named client is not certified until a real client report records it. |
| Node MCP SDK test host | Run `pnpm verify:mcp`. | The `@modelcontextprotocol/client` harness tests stdio and Streamable HTTP, lists the twelve tools, calls governed tools, checks HTTP access controls, and closes the managed gateways. | This is real protocol integration evidence covered by the source tests. It does not certify a third-party client UI. |

## Local Client Convergence

Three hosts in this repository launch the same source MCP server. They converge
on one server entry point while keeping machine-specific paths out of version
control.

| Config file | Tracked in git | Launch shape |
| --- | --- | --- |
| `.codex/config.toml` | Committed, portable | `command = "node"` with the repository-relative server path |
| `.mcp.json` | Committed as the portable Docker launch | A source checkout may override it locally with an absolute interpreter path; that override stays uncommitted |
| `.zcode/config.json` | Ignored (`.gitignore`) | Stores a per-machine interpreter path, so the whole directory is local-only |

Keep absolute interpreter paths, drive letters, and user directories out of
committed configuration. A portable ZCode entry looks like this:

```json
{
  "mcp": {
    "servers": {
      "unified-ai-system": {
        "command": "node",
        "args": ["packages/mcp-server/src/index.js"],
        "env": {
          "AI_GATEWAY_PROVIDER_MODE": "fake",
          "AI_GATEWAY_REAL_PROVIDER_ENABLED": "false"
        }
      }
    }
  }
}
```

Each connected host gets its own managed gateway child process on its own
loopback port. Disconnecting one host reclaims only that host's port and leaves
the other hosts serving tools. Regenerate this evidence locally with the
harness under `apps/ai-gateway-service/evidence/`; the output is gitignored
because it records machine-specific ports and process ids.

## Safe Verification Sequence

1. Confirm the host loaded the server and lists the expected twelve tools.
2. Call `gateway_health` and `gateway_readiness`.
3. Continue to `gateway_chat` only when readiness proves real-provider execution
   is disabled; label the result as fake-provider output.
4. Record the client, transport, operating system, command, tool count, and one sanitized
   output line in the [MCP client report template](https://github.com/happy520ai/unified-ai-system/issues/new?template=mcp-client-report.yml).

Do not add provider keys to the published install command. The matrix does not
claim production readiness, L5 autonomy, AGI, or universal client support.

### Certified Runtime Report Output

Run `pnpm exec node tools/verify-client-runtimes.mjs --client mcp-official` to create one evidence bundle for protocol
clients that can be automated in this environment.
