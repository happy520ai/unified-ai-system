# OpenAI-Compatible API

Unified AI System exposes a focused OpenAI-compatible surface for existing
chat applications:

- `GET /v1/models`
- `GET /v1/engines`
- `GET /v1/models/{id}`
- `GET /v1/engines/{id}`
- `POST /v1/chat/completions`
- `POST /v1/completions`
- `POST /v1/responses`
- `POST /v1/embeddings`
- `POST /v1/audio/speech`
- `POST /v1/audio/transcriptions`
- `POST /v1/images/generations`
- non-streaming and `stream: true` responses
- OpenAI-style JSON errors and `data: [DONE]` stream termination
- Chat Completions function tools, tool selection, tool-result messages, and
  streamed `tool_calls` deltas
- optional local natural-language prompt enhancement
- Azure-style deployment route compatibility:
  - `/openai/deployments/{deployment}/chat/completions`
  - `/openai/deployments/{deployment}/completions`
  - `/openai/deployments/{deployment}/responses`
- Legacy OpenAI routes:
  - `POST /v1/engines/{engine}/chat/completions`
  - `POST /v1/engines/{engine}/completions`
- `GET /models/{id}`
- `GET /engines/{id}`
- compatibility aliases for some SDKs that send root paths:
  - `/chat/completions`
  - `/completions`
  - `/responses`
  - `/embeddings`
  - `/audio/speech`
  - `/audio/transcriptions`
  - `/images/generations`
  - `/models`
  - `/engines`

This is a focused OpenAI-compatible layer with text, function-tool, and
multimodal route coverage, not an implementation of the entire OpenAI API.
Unsupported Responses tools, background Responses, stored response retrieval,
and unsupported multimodal chat content are rejected with an explicit error
rather than silently ignored.

## Start The Gateway

From a source checkout:

```bash
pnpm install --frozen-lockfile
pnpm gateway serve
```

The credential-free default uses the local fake provider. Real provider calls
remain disabled until they are explicitly configured and authorized. This
repository does not operate a public hosted gateway.

## JavaScript SDK

The credential-free verifier runs this surface through the official OpenAI
JavaScript SDK `7.4.0`, including model listing, regular and streaming Chat
Completions, regular and streaming Responses, the prompt-enhancement extension,
and structured errors.

For legacy clients that still speak `/v1/completions`, the gateway also supports
non-streaming and streaming completions with text-only prompt content.

```bash
pnpm add openai
```

```js
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://127.0.0.1:3100/v1",
  apiKey: process.env.PME_AUTH_TOKEN || "local-development",
});

const completion = await client.chat.completions.create({
  model: "local-fake-model",
  messages: [{ role: "user", content: "Plan a small API migration" }],
});
const legacyCompletion = await client.completions.create({
  model: "local-fake-model",
  prompt: "Plan a small API migration",
});

console.log(completion.choices[0].message.content);
console.log(completion.unified_ai);
```

The same client can use the Responses API:

```js
const response = await client.responses.create({
  model: "local-fake-model",
  instructions: "Answer briefly",
  input: "Plan a small API migration",
  store: false,
});

console.log(response.output_text);
console.log(response.unified_ai);
```

If your client uses Azure-style deployment routes, omit `model` and call the SDK
against the OpenAI-compatible base URL; the gateway will infer the model from
the path deployment name when possible.

For clients that only support legacy completions endpoints, you can use the same
gateway URL and API key:

```js
const legacy = await client.completions.create({
  model: "local-fake-model",
  prompt: "Generate a one-line summary of this repo.",
  stream: true,
});

for await (const chunk of legacy) {
  process.stdout.write(chunk.choices[0]?.text || "");
}
```

Run the same checked example against a local gateway:

```bash
node docs/examples/openai-sdk-chat.mjs
```

Run the cross-language certification pass:

```bash
pnpm exec node tools/verify-client-runtimes.mjs --client automated
```

When enterprise authentication is enabled, use its scoped bearer token as
`apiKey`. The client never needs a provider key; provider credentials stay at
the gateway boundary.

## Python SDK

```bash
py -m pip install openai
```

```python
import os
from openai import OpenAI

client = OpenAI(
    base_url="http://127.0.0.1:3100/v1",
    api_key=os.getenv("PME_AUTH_TOKEN", "local-development"),
)

completion = client.chat.completions.create(
    model="local-fake-model",
    messages=[{"role": "user", "content": "Plan a small API migration"}],
)

print(completion.choices[0].message.content)
```

```bash
py docs/examples/openai-sdk-chat.py --base-url http://127.0.0.1:3100
```

## Mainstream Wrapper Clients

Any ecosystem client that can set a compatible base URL and issues text-only chat
or response calls should match this same route profile. Common examples:

- Litellm (`/v1` + OpenAI model/chat calls),
- Microsoft AutoGen,
- LlamaIndex (Python/JS),
- LangGraph,
- vLLM / Ollama OpenAI-compatible proxy mode,
- Any LangChain adapter using the OpenAI API shape.
- CrewAI, Microsoft Semantic Kernel, and other orchestration frameworks that
  route OpenAI-compatible `chat/completions`/`responses`.
- OpenRouter-style proxy clients using OpenAI-compatible `/v1` paths.

These are pre-registered in
[`docs/client-runtime-certification.md`](client-runtime-certification.md).
For each client/version, keep a one-run evidence snippet through
`pnpm exec node tools/verify-client-runtimes.mjs --client <client-id>` or a protocol-client report.

## Streaming

```js
const stream = await client.chat.completions.create({
  model: "local-fake-model",
  messages: [{ role: "user", content: "Give me three migration steps" }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}
```

The wire format uses data-only SSE records and ends with `data: [DONE]`.
Responses streams use named events such as `response.output_text.delta` and
`response.completed`, followed by the same termination marker.

## Natural-Language Enhancement

Add the optional `unified_ai.prompt_enhancement` extension. Enhancement runs
locally before model execution and its summary is returned in
`response.unified_ai.prompt_enhancement`.

```bash
curl http://127.0.0.1:3100/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "local-fake-model",
    "messages": [{"role": "user", "content": "Build me an API"}],
    "unified_ai": {
      "prompt_enhancement": {
        "enabled": true,
        "profile": "coding",
        "language": "en"
      }
    }
  }'
```

The extension also accepts `true` for automatic profile and language
detection.

## Supported Request Fields

| Field | Behavior |
| --- | --- |
| `model` | Required. Use an ID returned by `GET /v1/models`. |
| `prompt` | For `/v1/completions`: required string or string array. |
| `messages` | Text `developer`, `system`, `user`, and `assistant` messages, assistant `tool_calls`, and `tool` result messages with `tool_call_id`. |
| `stream` | Optional boolean. |
| `temperature` | Number from 0 to 2. |
| `top_p` | Number from 0 to 1. |
| `max_tokens`, `max_completion_tokens` | Positive integer output limit. |
| `stop` | A string or non-empty string array. |
| `n` | Only `1` is supported. |
| `tools` | Up to 128 OpenAI function declarations with validated names, descriptions, and JSON Schema parameters. |
| `tool_choice` | Supports `none`, `auto`, `required`, and a named function that exists in `tools`. |
| `parallel_tool_calls` | Optional boolean forwarded to the selected provider. |
| `response_format` | Supports `text`, `json_object`, and validated `json_schema` objects. The normalized object is forwarded to real OpenAI-compatible providers. |
| `stream_options.include_usage` | Supported with `stream=true`; the final usage chunk is estimated and marked with `unified_ai.usage_estimated=true`. |
| `unified_ai.provider_id` | Optional explicit gateway provider selection. |
| `unified_ai.prompt_enhancement` | Optional local enhancement controls. |

Responses include standard Chat Completions fields plus a `unified_ai` object
with the selected provider, selected model, execution mode, execution status,
and gateway request ID. This metadata makes fake and real execution visible.
Non-streaming responses preserve assistant `tool_calls`; streaming responses
emit indexed `tool_calls` deltas and end with `finish_reason: "tool_calls"`
when the provider selects a function.

## Responses API Text Profile

| Field | Behavior |
| --- | --- |
| `model` | Optional when the gateway has an enabled default model. |
| `input` | Required text or a non-empty array of text message items. |
| `instructions` | Optional system instruction string. |
| `stream` | Optional boolean; emits standard Responses event names. |
| `temperature`, `top_p`, `max_output_tokens` | Mapped to gateway generation options. |
| `metadata` | Preserved in the response and gateway request metadata. |
| `text.format` | Only `{ "type": "text" }` is supported. |
| `store` | Omit it, use `false`, or use `null`; response retrieval is not implemented. |
| `unified_ai` | Supports the same provider and local prompt-enhancement controls. |

The response includes a completed assistant message, `output_text`, token
usage, and `unified_ai` execution evidence. Conversation state, response
retrieval/deletion, tools, background execution, and non-text content are not
implemented in this profile.

## Verify Without Credentials

```bash
pnpm verify:public-clone
```

The verifier starts an isolated gateway, exercises the protocol directly and
through the official OpenAI JavaScript SDK `7.4.0`, confirms fake-provider
execution, checks structured errors, and terminates the service process.
