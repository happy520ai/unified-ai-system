# OpenAI 兼容 API

Unified AI System 为现有聊天应用提供一组聚焦的 OpenAI 兼容接口：

- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /v1/responses`
- 普通响应与 `stream: true` 流式响应
- OpenAI 风格 JSON 错误和 `data: [DONE]` 流式结束标记
- Chat Completions 函数工具、工具选择、工具结果消息和流式 `tool_calls` 增量
- 可选的本地自然语言提示词增强

这是聚焦文本、函数工具和专用多模态路由的兼容层，不是完整 OpenAI API。
尚未支持的 Responses 工具、后台 Responses、已存响应查询和多模态 Chat 内容会返回
明确错误，不会被静默忽略。

## 启动网关

在源码目录执行：

```bash
pnpm install --frozen-lockfile
pnpm gateway serve
```

无凭据默认路径使用本地 fake provider。真实 provider 只有在显式配置并授权
后才会调用。本仓库目前不提供公共托管网关。

## JavaScript SDK

无凭据验证器会使用官方 OpenAI JavaScript SDK `7.4.0` 运行这组接口，覆盖模型列表、
普通与流式 Chat Completions、普通与流式 Responses、提示词增强扩展和结构化错误。

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
  messages: [{ role: "user", content: "帮我规划一个小型 API 迁移" }],
});

console.log(completion.choices[0].message.content);
console.log(completion.unified_ai);
```

同一个客户端可以直接使用 Responses API：

```js
const response = await client.responses.create({
  model: "local-fake-model",
  instructions: "简洁回答",
  input: "帮我规划一个小型 API 迁移",
  store: false,
});

console.log(response.output_text);
console.log(response.unified_ai);
```

可以对本地网关直接运行同一个受检示例：

```bash
node docs/examples/openai-sdk-chat.mjs
```

启用企业鉴权后，把作用域受限的 Bearer Token 作为 `apiKey`。客户端不需要
持有 provider 密钥，provider 凭据保留在网关边界内。

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
    messages=[{"role": "user", "content": "帮我规划一个小型 API 迁移"}],
)

print(completion.choices[0].message.content)
```

## 流式响应

```js
const stream = await client.chat.completions.create({
  model: "local-fake-model",
  messages: [{ role: "user", content: "给我三个迁移步骤" }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}
```

线上协议使用纯 `data:` SSE 记录，并以 `data: [DONE]` 结束。
Responses 流使用 `response.output_text.delta`、`response.completed` 等命名事件，
最后使用同样的结束标记。

## 自然语言增强

加入可选的 `unified_ai.prompt_enhancement` 扩展。增强会在模型执行前于本地
完成，摘要返回在 `response.unified_ai.prompt_enhancement` 中。

```bash
curl http://127.0.0.1:3100/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "local-fake-model",
    "messages": [{"role": "user", "content": "帮我做一个 API"}],
    "unified_ai": {
      "prompt_enhancement": {
        "enabled": true,
        "profile": "coding",
        "language": "zh-CN"
      }
    }
  }'
```

也可以把这个扩展直接设为 `true`，自动判断 profile 和语言。

## 已支持字段

| 字段 | 行为 |
| --- | --- |
| `model` | 必填，使用 `GET /v1/models` 返回的 ID。 |
| `messages` | 文本 `developer`、`system`、`user`、`assistant` 消息，assistant `tool_calls`，以及带 `tool_call_id` 的 `tool` 结果消息。 |
| `stream` | 可选布尔值。 |
| `temperature` | 0 到 2。 |
| `top_p` | 0 到 1。 |
| `max_tokens`、`max_completion_tokens` | 正整数输出上限。 |
| `stop` | 字符串或非空字符串数组。 |
| `n` | 仅支持 `1`。 |
| `tools` | 最多 128 个 OpenAI 函数声明，会校验名称、描述和 JSON Schema 参数。 |
| `tool_choice` | 支持 `none`、`auto`、`required` 和 `tools` 中已声明的指定函数。 |
| `parallel_tool_calls` | 可选布尔值，会转发给选定 Provider。 |
| `response_format` | 支持 `text`、`json_object` 和经过校验的 `json_schema` 对象；标准化对象会转发给真实 OpenAI 兼容 provider。 |
| `stream_options.include_usage` | 与 `stream=true` 一起支持；最终 usage 块为估算值，并以 `unified_ai.usage_estimated=true` 标记。 |
| `unified_ai.provider_id` | 可选的网关 provider 显式选择。 |
| `unified_ai.prompt_enhancement` | 可选的本地增强控制。 |

响应包含标准 Chat Completions 字段，并增加 `unified_ai` 对象，展示实际选择
的 provider、模型、执行模式、执行状态和网关请求 ID，让 fake 与真实执行
保持可见。
非流式响应会保留 assistant `tool_calls`；流式响应会输出带索引的 `tool_calls` 增量，
并在 Provider 选择函数时以 `finish_reason: "tool_calls"` 结束。

## Responses API 文本档位

| 字段 | 行为 |
| --- | --- |
| `model` | 网关存在已启用默认模型时可省略。 |
| `input` | 必填文本，或非空的文本消息项数组。 |
| `instructions` | 可选系统指令字符串。 |
| `stream` | 可选布尔值，使用标准 Responses 事件名。 |
| `temperature`、`top_p`、`max_output_tokens` | 映射到网关生成参数。 |
| `metadata` | 保留在响应和网关请求元数据中。 |
| `text.format` | 仅支持 `{ "type": "text" }`。 |
| `store` | 可省略、设为 `false` 或 `null`；尚未实现响应查询。 |
| `unified_ai` | 支持相同的 provider 选择和本地提示词增强控制。 |

响应包含已完成的 assistant 消息、`output_text`、token usage 和 `unified_ai`
执行证据。这个档位尚未实现会话状态、响应查询/删除、工具、后台执行和非文本内容。

## 无凭据验证

```bash
pnpm verify:public-clone
```

验证器会启动隔离网关，直接并通过官方 OpenAI JavaScript SDK `7.4.0` 执行协议检查，
确认使用 fake provider、检查结构化错误，并在结束后关闭服务进程。
