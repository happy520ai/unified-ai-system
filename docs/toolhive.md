# Run the MCP preview under ToolHive

This page describes how the published MCP image is meant to be used with
[ToolHive](https://docs.stacklok.com/toolhive/) and gives a reproducible check
for it. It accompanies the ToolHive catalog submission
(stacklok/toolhive-catalog#1615).

> **Status: not yet executed.** The commands below have been written against the
> ToolHive CLI reference (`thv run`, `thv mcp list tools`, `thv mcp call`), but no
> maintainer has run them end to end yet. When someone does, record the output
> and the `thv version` used next to this page, and correct anything that
> differs.

## What the image is, and what it is not

- `ghcr.io/happy520ai/unified-ai-system/mcp-server:0.8.0` is a stdio MCP server.
  On start it launches an isolated gateway on container loopback, pinned to a
  deterministic **fake provider**. No credentials are needed and no model
  provider is called; the MCP surface refuses any gateway that could call a
  real provider.
- **Supported architecture: linux/amd64 only.** The `0.8.0` arm64 variant ships
  x86-64 native modules (#190), so use the amd64 manifest digest below.
- Useful without a provider:
  - `gateway_prompt_enhance` turns a plain-language request into a structured
    prompt (task profile, output language, optional plan-verify-report protocol
    when `target` is `agent`), locally and deterministically.
  - `workflow_run` runs a three-step local workflow that writes one artifact
    inside the container.
  - Read-only status tools: gateway health/readiness, knowledge, workflow,
    workforce and agent-governance state.
- Not useful for generating text: `gateway_chat` returns fake responses only.
  It exists to demonstrate the fail-closed provider check.

## Practical workflow

1. Run the server under ToolHive (amd64 host).
2. Connect your MCP client through ToolHive (`thv client setup`, or point the
   client at the URL `thv list` reports).
3. Ask the client to structure a request with `gateway_prompt_enhance`, then
   hand the structured prompt to whatever model you already use.

## Reproducible check (initialize, tools/list, one useful call)

Requires an amd64 host with Docker (or Podman) and the `thv` CLI.

```bash
set -euo pipefail

IMAGE='ghcr.io/happy520ai/unified-ai-system/mcp-server:0.8.0@sha256:626b0a0c9c503083ba34ae77d563da4edcb744d62723c58805621ed9262873f6'

thv version
thv run --name unified-ai-system --transport stdio "$IMAGE"

# ToolHive proxies stdio over streamable HTTP; read the URL it assigned.
thv list
URL="$(thv list --format json | jq -r '.[] | select(.name=="unified-ai-system") | .url')"
echo "server url: $URL"

# 1 + 2: thv connects, sends initialize, then tools/list.
#        Expect 15 tools for 0.8.0, including gateway_prompt_enhance.
thv mcp list tools --server "$URL" --format json | tee tools.json
jq -r '.. | .name? // empty' tools.json | sort -u

# 3: one useful operation, provider-free.
thv mcp call gateway_prompt_enhance --server "$URL" --format json \
  --args '{"input":"build a small REST API for my team to track equipment loans","profile":"coding","language":"en"}' \
  | tee enhance.json

# Cleanup
thv rm unified-ai-system
```

What to look for:

- `tools.json` lists the 15 tools of `0.8.0`.
- `enhance.json` contains the preserved original request, the detected
  profile/language, the structured prompt, and evidence that no provider was
  called.

If `thv list --format json` uses a different field layout in your ToolHive
version, copy the URL from the plain `thv list` output instead.
