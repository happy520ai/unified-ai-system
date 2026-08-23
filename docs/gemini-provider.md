# Google Gemini Provider

The Gemini adapter implements the native `generateContent` and
`streamGenerateContent?alt=sse` (v1beta) surface with the same contract as the
OpenAI and Anthropic adapters — including SSE framing parity, abort support,
and the mandatory outbound SSRF policy. It is **disabled by default** and
follows the same three-gate real-provider whitelist
([real-provider enablement](real-provider-enablement.md)); the fake provider
remains the credential-free default.

## Enablement

1. Real providers must be globally allowed:

```bash
AI_GATEWAY_REAL_PROVIDER_ENABLED=true
AI_GATEWAY_PROVIDER_MODE=real   # or "auto"
```

2. Provide a key (in any of the three supported ways):

- Static config (`providerModels` entry `apiKey`)
- Runtime credential store (`POST` a credential for provider `gemini`; stored in a locally permissioned file in cleartext for local execution — see [real-provider enablement](real-provider-enablement.md) for the storage semantics and stricter alternatives)
- Environment: `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) **and** `gemini` listed in
  `AI_GATEWAY_ENABLED_PROVIDERS`

The key is always sent as the `x-goog-api-key` header — never in the URL, so
it cannot leak into access logs or error messages. Errors redact `AIza…`
fragments before they are surfaced.

## Models

`gemini-2.5-pro` ships as the default registered model (priority 70,
`enabled: false` until a credential activates it). Additional models
(`gemini-2.5-flash`, embeddings, Imagen/Veo) are declared in the provider
catalog and can be added to the registry at runtime through the model-import
/ credential-store paths.

## What is mapped

| Gateway request | Gemini field |
| --- | --- |
| `system` messages | `systemInstruction.parts[].text` (joined) |
| `assistant` turns | `contents[].role: "model"` |
| `image_url` inline data parts | `contents[].parts[].inlineData` |
| `options.maxOutputTokens` / `temperature` / `topP` / `stop` | `generationConfig` |
| `usageMetadata` | `usage` (+ `totalTokenCount`) |
| `finishReason` (`STOP`, `MAX_TOKENS`, `SAFETY`, …) | `finishReason` (`stop`, `length`, `content_filter`, …) |
| `promptFeedback.blockReason` | `GEMINI_CONTENT_BLOCKED` error (HTTP-equivalent 400) |

## Verification without a real key

The adapter ships 17 unit tests that fake the HTTP/SSE transport exactly like
the Anthropic adapter tests: request mapping, header-only key transport,
retryability by status, key-resolution order (static → credential store →
env), split SSE frames, mid-stream blocks, and abort propagation.

```bash
npx vitest run apps/ai-gateway-service/src/providers/geminiAdapter.test.ts
```

## Inbound Gemini Compatibility (v1beta)

Gemini-native clients can call the gateway directly on the Google wire
protocol (the adapter above remains the outbound path):

```text
POST /v1beta/models/{model}:generateContent
POST /v1beta/models/{model}:streamGenerateContent   # SSE (alt=sse)
GET  /v1beta/models                                 # model list
```

Translation behavior:

- Requests are converted to the internal chat input through the same
  normalizer as `/v1/chat/completions`, so model resolution, validation,
  guardrails, virtual-key budgets, and metrics are identical across lanes.
- `systemInstruction`, `contents`, `generationConfig` (temperature, topP,
  maxOutputTokens, stopSequences, JSON responseMimeType), `tools`
  (functionDeclarations), and `toolConfig` map to their OpenAI equivalents;
  assistant `functionCall`/`functionResponse` parts map to `tool_calls` /
  `tool` messages and back.
- `inlineData` image parts become data-URL image inputs (vision-capable
  models); non-image inline data is rejected with `INVALID_ARGUMENT`.
- Errors follow the Google REST error shape (`error.code/status/message`).
- Streaming emits Gemini-shaped SSE chunks and a terminal chunk carrying
  `finishReason` and `usageMetadata`.

Verification:

```bash
npx vitest run apps/ai-gateway-service/src/http/geminiCompatibilityRoutes.test.ts
```
