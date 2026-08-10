# OpenAI-Compatible API

Unified AI System exposes a focused OpenAI-compatible surface for existing
chat applications:

- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /v1/responses`
- non-streaming and `stream: true` responses
- OpenAI-style JSON errors and `data: [DONE]` stream termination
- optional local natural-language prompt enhancement

This is a focused text compatibility layer, not an implementation of the entire
OpenAI API. Tool calls, image/audio/file inputs, JSON response formats,
background Responses, stored response retrieval, and streamed usage totals are
rejected with an explicit error rather than silently ignored.

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

```bash
npm install openai
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

Run the same checked example against a local gateway:

```bash
node docs/examples/openai-sdk-chat.mjs
```

When enterprise authentication is enabled, use its scoped bearer token as
`apiKey`. The client never needs a provider key; provider credentials stay at
the gateway boundary.

## Python SDK

```bash
pip install openai
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
| `messages` | Text `developer`, `system`, `user`, and `assistant` messages. |
| `stream` | Optional boolean. |
| `temperature` | Number from 0 to 2. |
| `top_p` | Number from 0 to 1. |
| `max_tokens`, `max_completion_tokens` | Positive integer output limit. |
| `stop` | A string or non-empty string array. |
| `n` | Only `1` is supported. |
| `response_format` | Only `{ "type": "text" }` is supported. |
| `unified_ai.provider_id` | Optional explicit gateway provider selection. |
| `unified_ai.prompt_enhancement` | Optional local enhancement controls. |

Responses include standard Chat Completions fields plus a `unified_ai` object
with the selected provider, selected model, execution mode, execution status,
and gateway request ID. This metadata makes fake and real execution visible.

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
