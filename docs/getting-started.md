# Getting Started

## One-Command Container Demo

With Docker installed, prove the terminal path without cloning the repository
or configuring credentials:

```bash
docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.3 pnpm gateway demo "Build a small API for my team" --enhance --profile coding
```

The disposable container starts the gateway on an isolated port, verifies
health, turns the natural-language request into a structured prompt, sends one
deterministic fake-provider chat request, prints the result, and exits. No real
provider is called.

## Requirements

- Git
- Node.js 22 recommended; Node.js 20 or newer supported
- pnpm 9.15.4 or newer

On Windows, native dependencies may require Python and Visual Studio Build
Tools when a prebuilt binary is unavailable. Node.js 22 is the recommended
path for the broadest dependency compatibility.

## Install

```bash
git clone https://github.com/happy520ai/unified-ai-system.git
cd unified-ai-system
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm install --frozen-lockfile
```

## Verify

```bash
pnpm check:public
pnpm verify:public-clone
```

The public-clone verifier starts the gateway on a free local port, checks
health, setup readiness, the terminal-only public surface, and fake-provider
chat, then stops the service.

## Prove The Terminal Path

```bash
pnpm gateway demo
```

The demo starts an isolated gateway on a temporary local port, verifies its
health, sends one deterministic fake-provider chat request, and then shuts the
process down. It does not require an API key or call a real provider.

To see natural-language enhancement and fake-provider execution in one command:

```bash
pnpm gateway demo "Help me plan a small API" --enhance --profile planning
```

The command prints the structured prompt, proves `providerCalled: false`, and
cleans up the isolated gateway automatically.

## Try Prompt Enhancement With curl

If you want to inspect the natural-language transformation directly, use the
cross-platform [curl quickstart](examples/prompt-enhancement-curl.md). It
shows the original input, enhanced prompt, selected profile, and the explicit
`metadata.providerCalled=false` proof without configuring a provider.

For Server-Sent Events, use the [credential-free streaming quickstart](examples/streaming-chat-curl.md)
to inspect `start`, `chunk`, and `done` events with
`executionMode=fake`.

## Run From The Terminal

```bash
pnpm gateway doctor
pnpm gateway serve
```

In another terminal:

```bash
pnpm gateway status
pnpm gateway enhance "Help me plan a small API" --profile planning
pnpm gateway chat "Help me plan a small API" --enhance --profile planning
pnpm gateway chat "Hello from Unified AI System"
```

Prompt enhancement is deterministic and does not call a provider. No API key
is required for the default local fake provider. The chat command
refuses to send when a real provider may be active unless the operator adds
`--allow-real-provider` explicitly for that request. See the complete
[prompt enhancement guide](prompt-enhancement.md) and
[terminal CLI reference](cli.md).

## Call The Gateway From JavaScript

Keep `pnpm gateway serve` running, then use the standalone
[JavaScript chat example](examples/javascript-chat.mjs) from another terminal:

```bash
node docs/examples/javascript-chat.mjs "Hello from JavaScript"
```

Expected output:

```text
provider: local-fake-provider
mode: fake
response: [fake:local-fake-provider/local-fake-model] Hello from JavaScript
```

The example uses only built-in Node.js APIs. It checks gateway health before
sending, refuses to continue if a real provider may be enabled, pins the
request to the local fake provider, and verifies fake execution in the
response.

The HTTP API remains available directly. No browser UI is exposed by default;
terminal and API workflows are the supported public path.

## Connect Codex Through MCP

Add the anonymously pullable container as a local stdio MCP server:

```bash
codex mcp add unified-ai-system -- docker run --rm -i ghcr.io/happy520ai/unified-ai-system/mcp-server:0.4.3
```

Restart Codex and use `/mcp` to inspect the connected tools. From a trusted
source checkout, the project-level `.codex/config.toml` starts the same Node
entrypoint directly.

The MCP server starts an isolated fake-provider gateway, verifies its safety
state, and stops it with the MCP session. Run `pnpm verify:mcp` to exercise the
official MCP client handshake and every exposed tool. The dedicated image is
described in the root [`server.json`](../server.json) for Registry-compatible
installation.

For clients that use a JSON `mcpServers` configuration, see the
[generic MCP client guide](mcp-generic-client.md).

## Windows PowerShell

This credential-free smoke test uses a deterministic container name, waits
for the real health endpoint, calls the HTTP API, prints the fake-provider
evidence, and removes the container even when a request fails:

```powershell
$ErrorActionPreference = "Stop"
$container = "unified-ai-system-gateway-demo"
$port = 3100
$image = "ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.3"

docker rm -f $container 2>$null | Out-Null
try {
  docker run --detach --name $container `
    --publish "${port}:3100" `
    --env AI_GATEWAY_SERVICE_HOST=0.0.0.0 `
    $image
  if ($LASTEXITCODE -ne 0) { throw "Docker could not start $container." }

  $health = $null
  for ($attempt = 1; $attempt -le 30; $attempt++) {
    try {
      $health = Invoke-RestMethod `
        -Uri "http://127.0.0.1:$port/health/check" `
        -TimeoutSec 2
      if ($health.data.status -eq "ready") { break }
    } catch {
      Start-Sleep -Seconds 1
    }
  }
  if ($health.data.status -ne "ready") {
    docker logs --tail 40 $container
    throw "Gateway did not become ready."
  }

  $payload = @{
    prompt = "Help me plan a small API"
    promptEnhancement = @{ enabled = $true; profile = "planning" }
  } | ConvertTo-Json -Depth 4
  $result = Invoke-RestMethod `
    -Method Post `
    -Uri "http://127.0.0.1:$port/chat" `
    -ContentType "application/json" `
    -Body $payload

  [pscustomobject]@{
    provider = $result.data.selectedProvider
    model = $result.data.selectedModel
    execution = $result.data.executionMode
    enhanced = $result.data.promptEnhancement.applied
    response = $result.data.outputText
  } | Format-List
} finally {
  docker rm -f $container 2>$null | Out-Null
}
```

Expected evidence includes `execution: fake` and
`provider: local-fake-provider`. This example does not read credentials or
call a real provider. For a short cross-platform check, use the
[one-command container demo](#one-command-container-demo) above.

## Run The Public Container

Docker users can run the anonymously pullable `latest` image without cloning
or configuring credentials:

```bash
docker run --rm --publish 3100:3100 \
  ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.3
```

For a local image build with readiness reporting, run:

```bash
docker compose up --build -d
docker compose ps
curl http://127.0.0.1:3100/health/check
```

The service reports `healthy` only after the health endpoint responds
successfully. The Compose file treats `.env` as optional, so the
credential-free fake provider works from a fresh clone. Stop the service with
`docker compose down` when finished.
