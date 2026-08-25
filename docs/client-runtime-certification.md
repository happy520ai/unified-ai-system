# Client Runtime Certification

This document defines the boundary between protocol compatibility and a real
client-runtime result.

- Protocol compatibility proves that the gateway implements the wire contract.
- Runtime certification proves that a named client, version, and command ran
  against the local fake-provider gateway.
- A catalog entry is not a pass. An entry without a run is reported as
  `manual` with `runtimeExecuted=false`.

## Supported Protocol Families

The gateway exposes four interoperable surfaces:

- MCP over stdio and Streamable HTTP;
- OpenAI-compatible HTTP under `/v1`, including Chat Completions,
  Completions, Responses, streaming, model discovery, common root aliases,
  Azure-style deployment aliases, embeddings, image generation, and audio
  routes;
- A2A v1.0 Agent Card discovery and JSON-RPC task lifecycle;
- public HTTP/REST endpoints that can be consumed by `fetch`, `curl`, or any
  equivalent HTTP client.

New clients that follow one of these contracts can be added through a catalog
entry without changing gateway routing code.

## Canonical Commands

The repository intentionally keeps root `package.json` small. Use the tools
directly so the full option surface stays discoverable and composable.

Run the repeatable local profiles:

```bash
pnpm exec node tools/verify-client-runtimes.mjs --client automated
```

Run mainstream entries one at a time:

```bash
pnpm exec node tools/verify-client-runtimes-serial.mjs --client tag:mainstream
```

Generate a runbook without starting the gateway:

```bash
pnpm exec node tools/verify-client-runtimes.mjs --runbook --client global
pnpm exec node tools/verify-client-runtimes.mjs --runbook --client protocol:openai* --runbook-format json
```

Run the worldwide manifest in serial mode. `--max 0` means no local cap:

```bash
pnpm exec node tools/run-global-client-discovery.mjs \
  --source-manifest docs/client-runtime-catalog-sources-worldwide.json \
  --execute --serial --max 0
```

Run only the protocol families:

```bash
pnpm exec node tools/run-global-client-discovery.mjs \
  --source-manifest docs/client-runtime-catalog-sources-worldwide.json \
  --client protocol:openai* --client protocol:mcp* \
  --client protocol:a2a* --client protocol:public* \
  --execute --serial --max 10000
```

Require evidence for every selected manual entry:

```bash
pnpm exec node tools/run-global-client-discovery.mjs \
  --source-manifest docs/client-runtime-catalog-sources-worldwide.json \
  --execute --serial --require-manual-evidence \
  --manual-evidence docs/client-runtime-evidence.example.json --max 0
```

Generate a template and run strict onboarding as one operation:

```bash
pnpm exec node tools/run-global-clients-certification.mjs \
  --source-manifest docs/client-runtime-catalog-sources-worldwide.json \
  --source-manifest-dir docs/source-manifests.d --max 10000
```

Refresh the official MCP Registry catalog without running client checks:

```bash
pnpm exec node tools/sync-mcp-registry-client-catalog.mjs \
  --output .tmp/client-runtime-catalog.mcp-registry.json --max 0
```

## Evidence and Status

Automated evidence is written to:

```text
apps/ai-gateway-service/evidence/client-runtime-verifications/
```

The directory is ignored by the public repository except for its README. Each
automated run writes JSON and Markdown containing the command, checks, gateway
metadata, sanitized output tails, and the `realProviderCallsMade` flag.

The serial summary records one row per selected client. Large catalogs write
batched `in_progress` checkpoints and finish with `status: complete`; this
keeps an interrupted world-scale run auditable without rewriting a large file
for every pending entry.

Status meanings:

- `verified`: an automated run passed, or a manual report has a readable
  evidence path, a real command, and no failed checks;
- `manual`: the client is registered but has not supplied accepted proof;
- `failed`: an automated check failed, or strict mode found missing/invalid
  manual proof;
- `skipped`: the runtime was intentionally omitted and the report explains why.

The default provider mode is local fake mode. The verifier removes
credential-shaped environment variables from child processes by variable
name, without inspecting their values. It also fails the run if gateway logs
contain a non-fake `provider_call_start` event. A successful certification
therefore requires both client-side checks and zero observed real-provider
attempts.

## Manual Evidence Format

`docs/client-runtime-evidence.example.json` is a schema example, not proof.
Replace its placeholder paths with real, sanitized output before marking a
client `verified`:

```json
{
  "openai-java": {
    "clientId": "openai-java",
    "status": "verified",
    "command": "java -jar target/openai-java-smoke.jar",
    "checks": {
      "status200": true,
      "modelsListed": true,
      "chatCompleted": true,
      "protocolCompliance": true
    },
    "notes": "Run against the local fake-provider gateway.",
    "evidencePath": "apps/ai-gateway-service/evidence/client-runtime-verifications/openai-java.json"
  }
}
```

Evidence paths must exist. A verified entry also needs a non-placeholder
command and must not contain a `false` check.

## Python Runtime

The official Python profile accepts an explicit interpreter, so Windows users
do not need the `py` launcher:

```powershell
$env:AI_GATEWAY_PYTHON_EXECUTABLE = "python"
python -m pip install openai
pnpm exec node tools/verify-client-runtimes.mjs --client openai-python
```

The verifier passes its temporary gateway URL to the sample with `--base-url`
and records the SDK result. The same smoke entrypoint also supports HTTPie,
Requests, HTTPX, aiohttp, LangChain, LlamaIndex, A2A, MCP, LiteLLM,
PydanticAI, AutoGen, OpenAI Agents SDK, Haystack, DSPy, Semantic Kernel,
LangGraph, CrewAI, Instructor, and Guidance when their optional packages are
installed:

```powershell
$env:AI_GATEWAY_PYTHON_EXECUTABLE = "python"
python -m pip install openai requests httpx aiohttp httpie langchain-openai `
  llama-index-llms-openai a2a-sdk mcp litellm pydantic-ai langgraph `
  autogen-agentchat==0.7.5 "autogen-ext[openai]==0.7.5" openai-agents haystack-ai `
  dspy semantic-kernel crewai==1.15.14 instructor guidance
pnpm exec node tools/verify-client-runtimes.mjs --client http-python-requests,http-python-httpx,http-python-aiohttp,http-httpie
pnpm exec node tools/verify-client-runtimes.mjs --client openai-langchain-py,openai-llamaindex-python,a2a-python,mcp-python-sdk,openai-litellm,openai-pydantic-ai,openai-autogen,openai-agents-python,openai-haystack,openai-dspy,openai-semantic-kernel,openai-langgraph,openai-crewai,openai-instructor,openai-guidance,openai-python-root-alias,openai-azure-sdk-python-compat
```

## Node, .NET, and HTTP Runtime Profiles

`docs/examples/client-runtime-smoke.mjs` provides credential-free runtime
profiles for the official MCP Node SDK, MCP Inspector CLI, Codex App Server,
VS Code Extension Host, Claude Code, Gemini CLI, OpenCode, Cursor Agent CLI,
Cline CLI, Continue CLI, LangChain JS, LlamaIndex JS, Vercel AI SDK, OpenAI
Agents JS, AzureOpenAI JS, Promptfoo, Axios, Postman/Newman, native `fetch`,
native REST, and curl. Install optional packages outside the workspace
dependency graph and point the verifier at them with
`CLIENT_RUNTIME_NODE_MODULES`:

```powershell
pnpm add --dir .tmp\client-runtime-node --ignore-workspace --no-lockfile --ignore-scripts `
  @modelcontextprotocol/sdk @modelcontextprotocol/inspector@2.1.0 @openai/codex@0.147.0 `
  @langchain/openai @langchain/core ai @ai-sdk/openai `
  llamaindex @llamaindex/openai @openai/agents openai zod promptfoo axios newman
$env:CLIENT_RUNTIME_NODE_MODULES = (Join-Path (Get-Location) ".tmp\client-runtime-node\node_modules")
$env:VSCODE_EXECUTABLE = "C:\Program Files\Microsoft VS Code\Code.exe"
pnpm exec node tools/verify-client-runtimes.mjs --client mcp-node-sdk,mcp-inspector,codex-mcp,mcp-vscode,openai-langchain,openai-llamaindex-js,openai-vercel-ai-sdk,openai-agents-js,openai-azure-sdk-js-compat,openai-promptfoo,http-axios,http-node-fetch,http-node-graphql-or-rest,http-curl,http-postman
```

Install the six official MCP CLI hosts into a separate ignored directory.
The versions below are the exact versions in the 2026-08-11 certification
run, not a claim about the latest release:

```powershell
New-Item -ItemType Directory -Path .tmp\client-runtime-hosts -Force | Out-Null
pnpm add --dir .tmp\client-runtime-hosts --ignore-workspace --save-exact --ignore-scripts `
  @anthropic-ai/claude-code@2.1.227 @google/gemini-cli@0.54.4 opencode-ai@1.18.16 `
  cline@3.0.52 @continuedev/cli@1.5.47

$cursorVersion = "2026.08.04-aaa8809"
$cursorRoot = Join-Path (Get-Location) ".tmp\client-runtime-hosts\cursor-agent-package"
$cursorArchive = Join-Path $cursorRoot "agent-cli-package.zip"
New-Item -ItemType Directory -Path $cursorRoot -Force | Out-Null
Invoke-WebRequest `
  -Uri "https://downloads.cursor.com/lab/$cursorVersion/windows/x64/agent-cli-package.zip" `
  -OutFile $cursorArchive
if ((Get-FileHash -Algorithm SHA256 $cursorArchive).Hash -ne "18B30E9EFBBE339EF5B6AB56F6B36AD8CE5247F4F0F8BC8C176DA3EDA50B7159") {
  throw "Cursor Agent CLI package hash mismatch"
}
Expand-Archive -LiteralPath $cursorArchive -DestinationPath $cursorRoot -Force

$env:CLIENT_RUNTIME_HOST_ROOT = (Join-Path (Get-Location) ".tmp\client-runtime-hosts")
pnpm exec node tools/verify-client-runtimes-serial.mjs `
  --client mcp-claude-code,mcp-gemini-cli,mcp-opencode-cli,cursor-mcp,cline-mcp,mcp-continue
```

Each CLI runs with an isolated home and configuration. Claude Code uses its
real `mcp add` and `mcp list` commands. Gemini CLI uses `mcp add` plus a minimal
ACP `initialize` request because its shell-level `mcp list` performs a
connection probe without tool discovery. OpenCode runs with `--pure` and an
isolated inline configuration. Cursor uses its official `mcp enable` and
`mcp list-tools` commands without account credentials. Cline and Continue use
only the local fake OpenAI-compatible model and an exact certification prompt;
each may call only the read-only `gateway_health` tool. The verifier fails if
another MCP tool is called or a real provider is attempted.

The transcript proxy records only peer names and versions, MCP method names,
protocol versions, tool names, tool-call names, process IDs, and exit state. It
never records request parameters, response bodies, environment values, prompts,
or credentials. Every host runs with an isolated home, workspace, and
configuration, and every report verifies host and MCP server cleanup.

Preview and then remove only the allowlisted temporary certification runtimes
after the evidence run:

```powershell
pnpm exec node tools/clean-client-runtime-artifacts.mjs
pnpm exec node tools/clean-client-runtime-artifacts.mjs --execute
```

Add `--only=client-runtime-python` or `--only=client-runtime-hosts` to preview
or execute cleanup for one allowlisted target without removing the other
certification runtimes.

The repository also contains standard-library or official SDK examples for
Go `net/http`, `.NET HttpClient`, the official OpenAI .NET SDK, Java 11+
`HttpClient`, and PowerShell `Invoke-RestMethod`. They use the local fake
provider and do not read provider credentials. Run the PowerShell profile with:

```powershell
pnpm exec node tools/verify-client-runtimes.mjs --client http-powershell-invoke-restmethod
```

The Go profile stays `manual` until its sample is actually run with Go and
evidence is attached. Java profiles stay `manual` on machines that only have
Java 8 or no JDK because the source-file example requires Java 11+.

The credential-free verified set currently includes official OpenAI Node,
Python, and .NET SDKs; official MCP Node and Python SDKs; MCP Inspector CLI;
Codex App Server, VS Code Extension Host, Claude Code, Gemini CLI, OpenCode,
Cursor Agent CLI, Cline CLI, and Continue CLI as real MCP hosts; official A2A
JS and Python SDKs; LangChain JS/Python;
LangGraph; LlamaIndex
JS/Python; LiteLLM; PydanticAI; AutoGen; CrewAI; Instructor; Guidance; OpenAI
Agents SDK for Python and JavaScript; AzureOpenAI JS; Haystack; DSPy; Semantic
Kernel; Vercel AI SDK; Promptfoo; PowerShell `Invoke-RestMethod`; and the HTTP
clients listed above. This is a runtime evidence list, not a claim that every
cataloged desktop host or ecosystem wrapper has been tested.

The latest complete global serial baseline covered 2,136 unique catalog entries
with 49 verified, 0 failed, and 2,087 pending manual reports. Three subsequent
official-host reports promoted Cursor Agent CLI, Cline CLI, and Continue CLI,
so the current evidence-backed aggregate is 52 verified, 0 failed, and 2,084
pending. The joint host report recorded all three against one credential-free
gateway with zero real-provider attempts.

Every verified row needs a matching client ID, true runtime checks, a successful
outcome where the profile uses a subprocess, and no observed real-provider
attempt. The verifier also forces an empty in-memory runtime credential store;
native HTTP evidence exposes only local fake providers and fake models. Re-run
the global command after adding a real client command or sanitized evidence;
never promote a catalog row to `verified` from its name or a zero exit code
alone.

## Catalog Federation

Built-in definitions live in `tools/client-runtime-registry.mjs`. Ecosystem
extensions belong in `docs/client-runtime-catalog.d/*.json` and may use this
shape:

```json
{
  "clients": [
    {
      "id": "openai-example-wrapper",
      "name": "Example OpenAI-compatible wrapper",
      "protocol": "OpenAI-compatible",
      "transport": "HTTP /v1",
      "mode": "manual",
      "tags": ["openai-compatible", "language:python"],
      "command": "python examples/example-wrapper.py",
      "evidenceNotes": "Attach model listing and chat response evidence."
    }
  ]
}
```

The verifier accepts local files, catalog directories, and remote JSON catalogs:

```bash
pnpm exec node tools/verify-client-runtimes.mjs \
  --client-catalog docs/client-runtime-catalog.example.json \
  --client-catalog-dir docs/client-runtime-catalog.d \
  --client-catalog-url https://example.com/clients.json \
  --client global --runbook
```

Source manifests describe how catalogs are discovered. The world profile is
`docs/client-runtime-catalog-sources-worldwide.json`; additional manifests can
be placed in `docs/source-manifests.d/`.

## Coverage Claims

This system is protocol-first and globally extensible. It does not claim that
every client release worldwide has already been run. A trustworthy release
claim is the intersection of:

1. a supported protocol contract;
2. a named client/runtime command;
3. a saved successful report, or an explicitly pending manual report.

Use the latest serial JSON/Markdown summary and the per-client evidence files
as the source of truth for current coverage.
