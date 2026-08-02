# Terminal CLI

The terminal CLI is the primary operator entry point for a source checkout.
It uses the existing gateway and shared SDK rather than maintaining a separate
runtime.

## Try It Without A Clone

The public container includes both the CLI and gateway runtime:

```bash
docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.3.3 pnpm gateway demo
```

This disposable command uses the local fake provider, prints one verified
response, and exits without leaving a service process behind.

## Command Map

```text
pnpm gateway demo [prompt]    isolated credential-free proof
pnpm gateway serve            start the local gateway
pnpm gateway status           inspect health and chat readiness
pnpm gateway chat [prompt]    send one request to a running gateway
pnpm gateway doctor           check the toolchain and connection
pnpm gateway help             show command help
pnpm gateway version          show the CLI version
```

`health` is an alias for `status`, and `start` is an alias for `serve`.

## First Run

Prove the complete local path without keeping a service process:

```bash
pnpm gateway demo
```

For a persistent gateway, use two terminals:

```bash
# Terminal 1
pnpm gateway serve
```

```bash
# Terminal 2
pnpm gateway status
pnpm gateway chat "Hello from the terminal"
```

The default runtime uses the deterministic local fake provider and requires no
API key.

## Diagnostics

```bash
pnpm gateway doctor
pnpm gateway status --json
```

`doctor` verifies Node.js, pnpm, workspace entrypoints, and the optional
gateway connection. An offline gateway is reported with the next startup
command but does not make an otherwise valid toolchain fail.

Use `--url` for a different self-hosted instance and `--timeout` to change the
request timeout:

```bash
pnpm gateway status --url http://127.0.0.1:4100 --timeout 5000
```

## Machine Output

`demo`, `status`, `chat`, `doctor`, and `version` support `--json`:

```bash
pnpm gateway doctor --json
pnpm gateway chat "Return a short answer" --json
```

Exit code `0` means the command completed, `1` means an environment or runtime
failure, and `2` means invalid input or a safety refusal.

## Real Provider Boundary

The CLI checks gateway health immediately before sending chat. If the runtime
may use a real provider, the command fails before the chat POST:

```text
[error] The gateway may use a real provider. The chat request was not sent.
```

After reviewing the configured provider, credentials, model, and expected
cost, authorize that one CLI command explicitly:

```bash
pnpm gateway chat "Your prompt" --allow-real-provider
```

This flag does not enable a provider, add credentials, or change routing. It
only records operator authorization for the current chat command.

## Serve Options

The gateway retains its existing configuration and credential boundaries.
Host and port can be overridden without changing provider selection:

```bash
pnpm gateway serve --host 127.0.0.1 --port 4100
```

Press `Ctrl+C` to stop the service.
