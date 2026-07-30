# Getting Started

## One-Command Container Demo

With Docker installed, prove the terminal path without cloning the repository
or configuring credentials:

```bash
docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.3.2 pnpm gateway demo
```

The disposable container starts the gateway on an isolated port, verifies
health, sends one deterministic fake-provider chat request, prints the result,
and exits. No real provider is called.

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

## Run From The Terminal

```bash
pnpm gateway doctor
pnpm gateway serve
```

In another terminal:

```bash
pnpm gateway status
pnpm gateway chat "Hello from Unified AI System"
```

No API key is required for the default local fake provider. The chat command
refuses to send when a real provider may be active unless the operator adds
`--allow-real-provider` explicitly for that request. See the complete
[terminal CLI reference](cli.md).

The HTTP API remains available directly. No browser UI is exposed by default;
terminal and API workflows are the supported public path.

## Connect Codex Through MCP

Add the anonymously pullable container as a local stdio MCP server:

```bash
codex mcp add unified-ai-system -- docker run --rm -i ghcr.io/happy520ai/unified-ai-system/mcp-server:0.3.2
```

Restart Codex and use `/mcp` to inspect the connected tools. From a trusted
source checkout, the project-level `.codex/config.toml` starts the same Node
entrypoint directly.

The MCP server starts an isolated fake-provider gateway, verifies its safety
state, and stops it with the MCP session. Run `pnpm verify:mcp` to exercise the
official MCP client handshake and every exposed tool. The dedicated image is
described in the root [`server.json`](../server.json) for Registry-compatible
installation.

## Run The Public Container

Docker users can run the anonymously pullable `latest` image without cloning
or configuring credentials:

```bash
docker run --rm --publish 3100:3100 \
  ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.3.2
```

For a local image build, run `docker compose up --build`. The Compose file
treats `.env` as optional, so the credential-free fake provider works from a
fresh clone.
