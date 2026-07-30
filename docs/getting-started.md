# Getting Started

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
health, setup readiness, UI delivery, and fake-provider chat, then stops the
service.

## Run The Terminal Demo

```bash
pnpm demo
```

The demo starts an isolated gateway on a temporary local port, verifies its
health, sends one deterministic fake-provider chat request, and then shuts the
process down. It does not require an API key or call a real provider.

## Run

```bash
pnpm start
```

Call the HTTP API directly, or open the optional Workbench at
`http://127.0.0.1:3100/ui`.

No API key is required for the default local fake provider.

## Run The Public Container

Docker users can run the anonymously pullable `master` image without cloning
or configuring credentials:

```bash
docker run --rm --publish 3100:3100 \
  ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:master
```

For a local image build, run `docker compose up --build`. The Compose file
treats `.env` as optional, so the credential-free fake provider works from a
fresh clone.
