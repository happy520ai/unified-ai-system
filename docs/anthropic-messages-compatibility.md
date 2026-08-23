# Anthropic Messages Compatibility

The gateway exposes a credential-free Anthropic Messages compatibility surface at
`POST /v1/messages`. The official `@anthropic-ai/sdk` client is exercised by the
public-clone verifier against the managed local fake provider.

## Supported profile

- Non-streaming Messages responses.
- Streaming Messages SSE lifecycle: `message_start`, content-block events,
  `message_delta`, and `message_stop`.
- Text message blocks and text system prompts.
- `model`, `max_tokens`, `temperature`, `top_p`, and `stop_sequences`.
- Function tools end to end: `tools` (`{ name, description, input_schema }`),
  `tool_choice` (`{ type: "auto" | "any" | "tool", name? }`), assistant
  `tool_use` input blocks, user `tool_result` input blocks, `tool_use` output
  content blocks with `stop_reason: "tool_use"`, and streamed `tool_use`
  blocks (`content_block_start` + `input_json_delta` + `content_block_stop`).
  Tools map onto the gateway's shared chat tool contract, so any tool-calling
  backend provider serves Anthropic clients.
- Anthropic-shaped validation, authentication, rate-limit, and API errors.
- Virtual-key budget/rate gates and per-key usage recording, identical to the
  chat completions and Responses surfaces.
- Existing gateway provider/model resolution, governance, request limits, and
  disconnect cleanup.
- Native streaming from the Anthropic provider adapter itself: when a real
  Anthropic provider is enabled, `POST /v1/messages` with `stream: true`
  consumes the upstream Anthropic SSE stream directly (`generateStream`),
  including usage accounting, stop-reason mapping, an inactivity timeout, and
  abort propagation.

Run the official SDK example while the gateway is listening on port 3100:

```bash
node docs/examples/anthropic-sdk-messages.mjs
```

Run the full credential-free clone verifier:

```bash
pnpm verify:public-clone
```

## Fail-closed boundary

This profile rejects images, documents, citations, thinking blocks,
prompt caching controls, batches, token counting, and beta features.
Unsupported fields and block types return `invalid_request_error`; they are
never silently dropped or represented as supported.

The verifier passes a local placeholder key only because the official SDK
requires a client-side API-key value. The gateway remains in
`local-fake-provider` mode, forwards no credential environment variables, and
makes no real provider call. Passing this verifier proves compatibility only for
the documented text profile; it is not universal Anthropic certification or a
production-readiness claim.
