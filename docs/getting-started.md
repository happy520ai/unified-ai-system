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

## Run

```bash
pnpm start
```

Open `http://127.0.0.1:3100/ui`.

No API key is required for the default local fake provider.
