# @unified-ai-system/shared-sdk

Part of the unified-ai-system monorepo.

## Usage

```js
import {
  createGatewayChatRequest,
  createGatewayClient,
} from "@unified-ai-system/shared-sdk";

const gateway = createGatewayClient({
  baseUrl: "http://127.0.0.1:3100",
});

const preview = await gateway.enhancePrompt({
  input: "Build a Node API with tests",
  profile: "coding",
});

const response = await gateway.chat(createGatewayChatRequest({
  prompt: "Build a Node API with tests",
  promptEnhancement: {
    enabled: true,
    profile: "coding",
  },
}));
```

Pass an `AbortSignal` when a client needs caller-controlled cancellation. The
signal applies to JSON requests and `chatStream` calls made by that client:

```js
const controller = new AbortController();
const gateway = createGatewayClient({
  baseUrl: "http://127.0.0.1:3100",
  signal: controller.signal,
});

const request = gateway.chat({
  messages: [{ role: "user", content: "Hello" }],
});
controller.abort();
await request.catch((error) => {
  console.error(error.name, error.cause?.name); // GatewayClientError, AbortError
});
```

`enhancePrompt` is deterministic and provider-free. Chat enhancement is
explicit opt-in; requests without `promptEnhancement.enabled` are unchanged.

All request methods reject with `GatewayClientError` when the gateway cannot
complete a request. The error preserves `statusCode` and `responseBody` for
HTTP failures and exposes the original transport or parsing error as `cause`.
Caller cancellation preserves the underlying abort reason; internal timeouts
use a cause named `TimeoutError`, so callers can distinguish the two when the
runtime provides those names.

Run the provider-free loopback proof from the repository root:

```bash
node docs/examples/shared-sdk-cancellation.mjs
```

The example makes no external provider request and exits non-zero unless both
error paths expose the expected cause.
The client trims surrounding whitespace and trailing slashes from `baseUrl` so
the same configuration works in local scripts and deployed environments.

## Development

```bash
# From repo root
pnpm --filter @unified-ai-system/shared-sdk test
pnpm --filter @unified-ai-system/shared-sdk check
```
