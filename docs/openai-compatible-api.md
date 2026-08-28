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
- bounded inline image input for Chat Completions and Responses
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
The Responses surface supports `store`, `previous_response_id` conversation
chaining, `reasoning` effort passthrough with retained reasoning summaries,
and function tools end to end (`tools`, `tool_choice`, `function_call` and
`function_call_output` input items, and `function_call` output items), plus
stored-response retrieval and deletion (`GET`/`DELETE /v1/responses/{id}`).
Unsupported Responses built-in tools (for example `web_search`), background
Responses, remote image URLs, files, and audio content are rejected with an
explicit error rather than silently ignored.

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
Completions, regular and streaming Responses, inline image inputs, the
prompt-enhancement extension, and structured errors.

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

## Long Conversation Compaction

Chat requests with a very long history are compacted before the provider
call, using the same unified context compaction engine that powers the
agentic loop (`packages/codex-context-gateway`): system instructions and the
recent turns stay verbatim, and older turns are replaced by one summary
message. Compaction never blocks or fails a request, and the response carries
a `context_compacted` warning with the before/after counts whenever it fires.

| Setting | Default | Behavior |
| --- | --- | --- |
| `AI_GATEWAY_CHAT_COMPACTION_THRESHOLD_MESSAGES` | `60` | Compact when the history exceeds this many messages. `0` disables this trigger. |
| `AI_GATEWAY_CHAT_COMPACTION_MAX_TOKENS` | `24000` | Compact when the estimated history exceeds this token budget. `0` disables this trigger. |
| `AI_GATEWAY_CHAT_COMPACTION_KEEP_RECENT_TURNS` | `10` | Recent turns kept verbatim in full detail. |

Ordinary conversations stay byte-identical; only over-threshold histories are
rewritten.

## Supported Request Fields

| Field | Behavior |
| --- | --- |
| `model` | Required. Use an ID returned by `GET /v1/models`. |
| `prompt` | For `/v1/completions`: required string or string array. |
| `messages` | Text `developer`, `system`, `user`, and `assistant` messages, assistant `tool_calls`, and `tool` result messages with `tool_call_id`. |
| `messages[].content[].image_url` | User-message inline base64 PNG, JPEG, WebP, or GIF data URL with optional `auto`, `low`, or `high` detail. Remote URLs fail closed. |
| `stream` | Optional boolean. |
| `temperature` | Number from 0 to 2. |
| `top_p` | Number from 0 to 1. |
| `max_tokens`, `max_completion_tokens` | Positive integer output limit. |
| `stop` | A string or non-empty string array. |
| `n` | Integer from 1 to 8. `n>1` executes n generations and returns indexed `choices`; prompt tokens count once, completion tokens sum across choices. Multi-choice requests bypass the response cache. |
| `tools` | Up to 128 OpenAI function declarations with validated names, descriptions, and JSON Schema parameters. |
| `tool_choice` | Supports `none`, `auto`, `required`, and a named function that exists in `tools`. |
| `parallel_tool_calls` | Optional boolean forwarded to the selected provider. |
| `response_format` | Supports `text`, `json_object`, and validated `json_schema` objects. The normalized object is forwarded to real OpenAI-compatible providers. |
| `stream_options.include_usage` | Supported with `stream=true`; the final usage chunk is estimated and marked with `unified_ai.usage_estimated=true`. |
| `unified_ai.provider_id` | Optional explicit gateway provider selection. |
| `unified_ai.prompt_enhancement` | Optional local enhancement controls. |
| `unified_ai.rag` | Optional opt-in knowledge injection: `true` or `{ enabled, topK?, sourceIds? }` (`topK` 1–10). The last user message retrieves tenant-scoped knowledge and the cited context is injected as a system message (`unified_ai.ragInjection` reports the outcome). Injected context re-passes guardrails; RAG-augmented requests bypass the response cache. |

Legacy `/v1/completions` additionally supports `n` (1–8) and
`stream_options.include_usage` (terminal usage chunk prefers
provider-reported usage and falls back to estimates).

Responses include standard Chat Completions fields plus a `unified_ai` object
with the selected provider, selected model, execution mode, execution status,
and gateway request ID. This metadata makes fake and real execution visible.
Non-streaming responses preserve assistant `tool_calls`; streaming responses
emit indexed `tool_calls` deltas and end with `finish_reason: "tool_calls"`
when the provider selects a function.

## Responses API Text And Inline Image Profile

| Field | Behavior |
| --- | --- |
| `model` | Optional when the gateway has an enabled default model. |
| `input` | Required text or a non-empty message array containing `input_text` and bounded inline `input_image` data URLs. |
| `instructions` | Optional system instruction string. |
| `stream` | Optional boolean; emits standard Responses event names. |
| `temperature`, `top_p`, `max_output_tokens` | Mapped to gateway generation options. |
| `metadata` | Preserved in the response and gateway request metadata. |
| `text.format` | Only `{ "type": "text" }` is supported. |
| `store` | Optional boolean, defaults to `true`. Stored responses enable `previous_response_id` chaining. |
| `previous_response_id` | Continues a stored conversation: the gateway replays the stored context (instructions, prior turns, tool calls, and assistant outputs) before the new input. Unknown or expired ids return `404` with `code: "response_not_found"`. |
| `reasoning` | Optional `{ "effort": "minimal" \| "low" \| "medium" \| "high" \| "xhigh", "summary": "auto" \| "concise" \| "detailed" }`. `effort` is passed to supporting providers as `reasoning_effort` and echoed back on the response. Provider reasoning content is captured, returned as a `reasoning` output item, retained in the session, and replayed as bounded context on chained turns so multi-turn agents stop re-deriving conclusions. Client-sent `reasoning` input items are accepted and dropped (counted in `unified_ai` metadata). |
| `tools` | Function tools in the flat Responses shape (`{ type: "function", name, description, parameters, strict }`), mapped to the chat tool contract. Built-in tools such as `web_search` are rejected. |
| `tool_choice` | `"none"`, `"auto"`, `"required"`, or `{ "type": "function", "name" }`. |
| `parallel_tool_calls` | Optional boolean. |
| `input` items | `message`, `function_call` (assistant tool call), `function_call_output` (tool result), and `reasoning` items are supported; other item types are rejected. |
| `unified_ai` | Supports the same provider and local prompt-enhancement controls. |

The response includes completed output items (`reasoning` when the provider
returned reasoning content, `function_call` items when the provider selected
a function, and the assistant `message`), `output_text`, token usage, and
`unified_ai` execution evidence. Stored responses can be retrieved
(`GET /v1/responses/{id}`) or deleted (`DELETE /v1/responses/{id}`, returns
`{ "deleted": true }`); unknown or expired ids return `404
response_not_found`. Response sessions are held in memory with a
TTL (`AI_GATEWAY_RESPONSE_SESSION_TTL_MS`, default 30 minutes; `0` disables
chaining) and a bounded table
(`AI_GATEWAY_RESPONSE_SESSION_MAX_ENTRIES`, default 256, least-recently-used
eviction). Sessions store normalized message text and captured reasoning
summaries only — never credentials or raw provider payloads. Background
execution, remote images, files, and audio are not implemented in this
profile.

Virtual-key budgets and rate limits are enforced uniformly across the chat
completions, Responses, and Anthropic `/v1/messages` surfaces, and per-key
usage is recorded on each call. A virtual-key holder can inspect their own
key's live budget and rate state:

```bash
curl http://127.0.0.1:3100/usage/my-key -H "Authorization: Bearer uai-…"
```

See [Secure inline image input](openai-inline-image-input.md) for size limits,
provider capability routing, privacy boundaries, and credential-free evidence.

## Bounded Agent Execution

`POST /agent-exec/run` is the non-interactive execution tier (the `codex exec`
pattern): one request runs the gateway's agentic loop under hard bounds and
returns structured JSON. It requires the `workflow:run` permission.

```bash
curl http://127.0.0.1:3100/agent-exec/run \
  -H "Content-Type: application/json" \
  -H "x-pme-auth-token: $TOKEN" \
  -d '{
    "goal": "Summarize the repository layout.",
    "providerId": "local-fake-provider",
    "maxIterations": 8,
    "timeoutMs": 60000,
    "toolMode": "readonly"
  }'
```

Bounds and semantics: `maxIterations` is a fixed cap (1–25, default 8) with
dynamic budgets disabled; `timeoutMs` (1,000–120,000, default 60,000) aborts
the run and reports `status: "timeout"`; tool access is `readonly`
(`file_read` only) by default, `none`, or an explicit `toolAllowlist`. The
result reports status, final answer, iterations used, timing, tool usage, and
the unified compaction policy. Fail-open compaction uses the same engine as
the chat path.

## Codex CLI Interop

The open-source OpenAI Codex CLI can drive the gateway directly. Point a
custom model provider at the Responses surface:

```toml
# $CODEX_HOME/config.toml
model = "agnes-2.5-flash"
model_provider = "unified-gateway"

[model_providers.unified-gateway]
name = "Unified AI Gateway"
base_url = "http://127.0.0.1:3100/v1"
env_key = "OPENAI_API_KEY"
wire_api = "responses"
```

Set `OPENAI_API_KEY` to a gateway enterprise token; in fake-only preview mode
any value works from loopback. Codex-style requests are supported end to end:
flat function tools (mapped to the chat contract), built-in tool declarations
(`web_search`, `namespace`, …) accepted and dropped with the drop recorded in
`unified_ai` request metadata, `include: ["reasoning.encrypted_content"]`
dropped in favor of session-side reasoning retention, `prompt_cache_*` hints
dropped, and blank assistant history items skipped. Verified with Codex CLI
0.149.0 `codex exec --json` against both the fake provider and a real
function-calling model: the model issues `function_call` items, Codex runs
the tool, and `function_call_output` continues the conversation.

## Verify Without Credentials

```bash
pnpm verify:public-clone
```

The verifier starts an isolated gateway, exercises the protocol directly and
through the official OpenAI JavaScript SDK `7.4.0`, confirms fake-provider
execution, checks structured errors, and terminates the service process.

### Audio Input

User-message `input_audio` parts (`{ data: <base64>, format: "wav" | "mp3" }`)
are accepted and forwarded verbatim to OpenAI-compatible providers. Limits:
at most 4 audio parts per request and 20MB of base64 per part; audio is only
allowed in user messages. `unified_ai.multimodalAudio` reports the accepted
count. The Gemini inbound lane maps `audio/wav` and `audio/mpeg`
`inlineData` parts to the same `input_audio` shape.
