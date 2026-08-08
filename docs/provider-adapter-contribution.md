# Provider Adapter Contribution Guide

This guide is for adding or changing a model provider without weakening the
gateway contract, credential boundary, or public verification path.

## Ownership Map

| Concern | Current owner |
| --- | --- |
| Adapter runtime and provider registration | `apps/ai-gateway-service/src/providers/` and `apps/ai-gateway-service/src/application/createGatewayApplication.js` |
| Adapter type contract | `apps/ai-gateway-service/src/providers/providerAdapter.ts` |
| Provider/model defaults | `packages/shared-config/src/index.ts` and `packages/shared-config/src/provider-catalog.js` |
| Credential storage and redaction | `apps/ai-gateway-service/src/providers/runtimeCredentialStore.js` and `securityPatterns.js` |
| Public protocol changes | `packages/shared-contracts/` |

Keep the change in the smallest owner boundary that explains it. A new
provider should not require a new UI, a change to the default `/chat` lane, or
committed runtime evidence.

## The Adapter Contract

The runtime assertion in `providerAdapter.js` requires:

- `descriptor.id` to be stable and unique;
- `descriptor.models` to be an array;
- `generate(providerRequest)` to be an async function.

The TypeScript contract in `providerAdapter.ts` describes the request and
response shape:

```text
providerRequest = {
  request,       // normalized gateway request
  target,        // { providerId, modelId }
  trace,         // requestId and traceId
}

providerResponse = {
  text,
  message,
  usage,
  latencyMs,
  executionStatus, // success | dry_run | unavailable | error
  warnings,
  raw,
}
```

Use `createProviderDescriptor()` from `providerAdapter.js` and
`createProviderResponse()` from `providerMapping.js` so descriptors and
responses remain compatible with the gateway and evidence tooling.

## Choose The Smallest Adapter

For an OpenAI-compatible chat endpoint, prefer the existing
`HttpLLMProviderAdapter`. The NVIDIA adapter in `nvidiaAdapter.js` is the
smallest wrapper example, while `openAiAdapter.js` shows a provider-specific
default endpoint. The shared HTTP adapter already handles request mapping,
timeouts, retries, response validation, health counters, and private/reserved
endpoint blocking.

For a provider with a different protocol, implement the same adapter surface
and keep network code inside the provider module. Register the factory in
`createGatewayApplication.js`; do not bypass `ProviderRegistry` or call a
provider directly from an HTTP route.

If streaming is supported, preserve the existing `generateStream()` event
shape used by the HTTP adapter and add a test for it. A provider does not gain
verified streaming support merely because its catalog entry lists a chat
model.

## Add Catalog And Configuration Carefully

Add a model entry to `DEFAULT_RUNTIME_CONFIG` only when the gateway can build
the adapter from that configuration. Use `providerType`, stable provider/model
ids, capabilities, priority, and an endpoint placeholder. Keep providers
disabled by default unless the project already has a credential-free path for
them.

Add detection and discovery metadata to `provider-catalog.js` only when it is
useful for provider selection or model import. A catalog entry is recognition
metadata, not proof that the provider works at runtime. Runtime support needs a
passing adapter test and separately authorized provider evidence.

When environment variables are needed:

1. Add the variable name and an empty placeholder to `.env.example`.
2. Load only presence and configuration metadata into safe diagnostics.
3. Keep the actual value in a local `.env` or runtime credential store.
4. Never print, snapshot, commit, or place the value in a fixture.

Real provider execution stays opt-in through
`AI_GATEWAY_REAL_PROVIDER_ENABLED=true` and an explicit provider selection.
The fake provider remains the default for tests and clean-clone verification.

## Credential-Free Test First

Start with a dry-run or fake test. This example exercises the real adapter
contract without opening a network connection or requiring a key:

```js
import { describe, expect, it } from "vitest";
import { createHttpLLMProviderAdapter } from "../httpLlmProviderAdapter.js";

function request() {
  return {
    target: { providerId: "acme", modelId: "acme-test-model" },
    request: {
      messages: [{ role: "user", content: "hello" }],
      options: {},
    },
  };
}

describe("acme provider adapter", () => {
  it("proves the dry-run contract without a provider call", async () => {
    const adapter = createHttpLLMProviderAdapter({
      providerId: "acme",
      modelId: "acme-test-model",
      endpoint: "https://example.com",
      enabled: true,
      dryRun: true,
    });

    const response = await adapter.generate(request());

    expect(response.executionStatus).toBe("dry_run");
    expect(adapter.health.totalRequests).toBe(0);
  });
});
```

Then add provider-specific tests for request mapping, response normalization,
error classification, retry behavior, redaction, private endpoint blocking,
and streaming when applicable. A successful dry-run test does not establish
that a real provider endpoint or model is available.

## Verification And Review

Run the focused gateway tests while iterating, then run every public gate
before opening a pull request:

```bash
pnpm --filter @unified-ai-system/ai-gateway-service test:vitest
pnpm check
pnpm test
pnpm check:public
pnpm verify:public-clone
```

Also run `pnpm verify:mcp` when the change touches MCP packaging or tool
discovery. The clean-clone and MCP checks must remain credential-free and must
leave no service process behind.

Review checklist:

- Is the provider id stable, unique, and registered through `ProviderRegistry`?
- Does the descriptor advertise only capabilities that are actually mapped?
- Is catalog recognition clearly separated from runtime support evidence?
- Are keys absent from source, logs, fixtures, screenshots, and test output?
- Are private/reserved endpoints rejected before a real request?
- Is the fake or dry-run path still the default?
- Does the PR explain provider authorization, compatibility, and migration risk?

For provider setup after an adapter is merged, see the
[provider setup guide](providers.md). For contribution scope and repository
safety rules, see [CONTRIBUTING](../CONTRIBUTING.md).
