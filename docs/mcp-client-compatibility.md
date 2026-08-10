# MCP Client Compatibility Matrix

This page describes the published `v0.4.9` MCP entry points and the evidence
behind them. A documented install command is not a client certification: client
runtime claims require an actual report from that client.

## Published Baseline

- Image: `ghcr.io/happy520ai/unified-ai-system/mcp-server:0.4.9`
- Transport: local Docker process over MCP stdio
- Tools: nine governed tools, including provider-free prompt enhancement
- Default mode: `local-fake-provider`; no provider key is required
- Source evidence: `pnpm verify:mcp` and `pnpm verify:public-clone`
- Registry: [official MCP Registry v0.4.9](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.happy520ai%2Funified-ai-system/versions/0.4.9)

## Source-Build Baseline

The current source tree adds MCP Streamable HTTP at
`http://127.0.0.1:3210/mcp`. `pnpm verify:mcp` uses the official MCP v2 client
to test both stdio and HTTP, including access rejection and managed-process
cleanup. This HTTP entry point is not part of the published `v0.4.9` image.

## Matrix

| Client path | Install or configure | First check | Evidence boundary |
| --- | --- | --- | --- |
| Codex | `codex mcp add unified-ai-system -- docker run --rm -i ghcr.io/happy520ai/unified-ai-system/mcp-server:0.4.9` | Run `codex mcp get unified-ai-system --json`, restart Codex, then use `/mcp verbose`. | The repository verifies the MCP stdio server and managed gateway. A Codex CLI session is not claimed unless a contributor reports one. |
| Cursor | `pnpm dlx add-mcp@2.0.0 "docker run --rm -i ghcr.io/happy520ai/unified-ai-system/mcp-server:0.4.9" --name unified-ai-system -a cursor -y` | Open the MCP tool inspector and run `gateway_health`, then `gateway_readiness`. | The command and published image are documented. Cursor client runtime support remains an evidence-needed path. |
| Cline | `cline mcp install unified-ai-system --yes --json -- docker run --rm -i ghcr.io/happy520ai/unified-ai-system/mcp-server:0.4.9` | Start a fresh Cline session, list the nine tools, and check health/readiness before chat. | The installation contract is documented. Cline client runtime support requires an actual Cline usage report. |
| Generic MCP stdio host | Add the `mcpServers.unified-ai-system` entry from [generic client configuration](mcp-generic-client.md). | Restart the host, confirm the nine tools, call `gateway_health`, then `gateway_readiness`. | The JSON configuration and MCP server path are covered by the repository's provider-free verification. |
| Generic MCP Streamable HTTP host | Run `pnpm mcp:http` and configure `http://127.0.0.1:3210/mcp`. | List the nine tools, then call `gateway_health` and `gateway_readiness`. | The source endpoint is protocol-tested. A named client is not certified until a real client report records it. |
| Node MCP SDK test host | Run `pnpm verify:mcp`. | The `@modelcontextprotocol/client` harness tests stdio and Streamable HTTP, lists the nine tools, calls governed tools, checks HTTP access controls, and closes the managed gateways. | This is real protocol integration evidence covered by the source tests. It does not certify a third-party client UI. |

## Safe Verification Sequence

1. Confirm the host loaded the server and lists the expected nine tools.
2. Call `gateway_health` and `gateway_readiness`.
3. Continue to `gateway_chat` only when readiness proves real-provider execution
   is disabled; label the result as fake-provider output.
4. Record the client, transport, operating system, command, tool count, and one sanitized
   output line in the [MCP client report template](https://github.com/happy520ai/unified-ai-system/issues/new?template=mcp-client-report.yml).

Do not add provider keys to the published install command. The matrix does not
claim production readiness, L5 autonomy, AGI, or universal client support.
