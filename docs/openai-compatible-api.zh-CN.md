# OpenAI 兼容 API

Unified AI System 为现有聊天应用提供一组聚焦的 OpenAI 兼容接口：

- `GET /v1/models`
- `POST /v1/chat/completions`
- 普通响应与 `stream: true` 流式响应
- OpenAI 风格 JSON 错误和 `data: [DONE]` 流式结束标记
- 可选的本地自然语言提示词增强

这是核心 Chat Completions 兼容层，不是完整 OpenAI API。工具调用、图片或
音频输入、JSON 响应格式和流式 usage 统计尚未支持；网关会返回明确错误，
不会静默忽略这些参数。

## 启动网关

在源码目录执行：

```bash
pnpm install --frozen-lockfile
pnpm gateway serve
```

无凭据默认路径使用本地 fake provider。真实 provider 只有在显式配置并授权
后才会调用。本仓库目前不提供公共托管网关。

## JavaScript SDK

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
| `messages` | 文本 `developer`、`system`、`user`、`assistant` 消息。 |
| `stream` | 可选布尔值。 |
| `temperature` | 0 到 2。 |
| `top_p` | 0 到 1。 |
| `max_tokens`、`max_completion_tokens` | 正整数输出上限。 |
| `stop` | 字符串或非空字符串数组。 |
| `n` | 仅支持 `1`。 |
| `response_format` | 仅支持 `{ "type": "text" }`。 |
| `unified_ai.provider_id` | 可选的网关 provider 显式选择。 |
| `unified_ai.prompt_enhancement` | 可选的本地增强控制。 |

响应包含标准 Chat Completions 字段，并增加 `unified_ai` 对象，展示实际选择
的 provider、模型、执行模式、执行状态和网关请求 ID，让 fake 与真实执行
保持可见。

## 无凭据验证

```bash
pnpm verify:public-clone
```

验证器会启动隔离网关，执行模型列表、普通与流式 Chat Completions、提示词
增强检查，确认使用 fake provider，并在结束后关闭服务进程。
