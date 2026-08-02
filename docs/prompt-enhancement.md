# Natural-Language Prompt Enhancement

Unified AI System can turn an ordinary natural-language request into a more
explicit prompt before a model receives it. The local engine preserves the
original request and adds execution requirements, output expectations, a
clarification policy, and completion criteria.

This is a deterministic heuristic transformation. It improves consistency and
inspectability; it is not a guarantee that every model or task will perform
better.

## Preview From The Terminal

Start the gateway, then preview an enhancement without calling a model:

```bash
pnpm gateway serve
pnpm gateway enhance "帮我开发一个用户登录接口" --profile coding
```

Use `--json` to receive the original request, enhanced prompt, detected
profile and language, clarification questions, and engine metadata.

## Preview Through HTTP

```bash
curl --request POST http://127.0.0.1:3100/prompts/enhance \
  --header "content-type: application/json" \
  --data '{
    "input": "Help me plan a product launch",
    "profile": "auto",
    "language": "auto"
  }'
```

Supported profiles are `auto`, `general`, `coding`, `analysis`, `writing`,
`research`, and `planning`. Supported language settings are `auto`, `zh-CN`,
and `en`. Input is limited to 20,000 characters.

## Opt In For Chat

Plain `/chat` behavior is unchanged. Apply enhancement only by sending an
explicit option:

```json
{
  "taskType": "chat",
  "messages": [
    {
      "role": "user",
      "content": "Build a Node API with tests"
    }
  ],
  "promptEnhancement": {
    "enabled": true,
    "profile": "coding",
    "language": "auto"
  }
}
```

The gateway enhances only the latest non-empty user message. Earlier user,
assistant, system, and tool messages remain unchanged. JSON chat responses
include a `data.promptEnhancement` summary. Streaming events include the same
summary under `meta.promptEnhancement`.

The terminal equivalent is:

```bash
pnpm gateway chat "Build a Node API with tests" --enhance --profile coding
```

## Shared SDK

```js
import {
  createGatewayChatRequest,
  createGatewayClient,
} from "@unified-ai-system/shared-sdk";

const gateway = createGatewayClient({
  baseUrl: "http://127.0.0.1:3100",
});

const preview = await gateway.enhancePrompt({
  input: "Analyze our deployment options",
  profile: "analysis",
});

const response = await gateway.chat(createGatewayChatRequest({
  prompt: "Analyze our deployment options",
  promptEnhancement: {
    enabled: true,
    profile: "analysis",
  },
}));
```

## Codex And MCP

The current source build exposes `gateway_prompt_enhance` as a read-only MCP
tool. It returns a preview without checking provider health because it cannot
call a provider. The pinned `0.3.3` MCP container remains the stable eight-tool
release; use the source entrypoint for this unreleased ninth tool.

## Safety And Governance

- The enhancer does not call a model, access a network provider, or require a
  credential.
- The original request is included verbatim inside the enhanced prompt and is
  also returned separately by the preview API.
- Enhancement cannot enable a real provider or bypass chat authorization.
- `/prompts/enhance` uses the existing `chat:use` enterprise permission.
- Invalid profiles, languages, empty input, and oversized input fail with a
  validation error instead of silently falling back.
