# 协议与客户端兼容性

项目通过开放协议扩大客户端覆盖。协议测试证明线上契约可用；只有真实运行记录了
产品版本、操作系统、配置和结果后，具名产品才会被标记为已认证。

## 已验证源码协议

| 接口面 | 验证实现 | 已覆盖行为 | 边界 |
| --- | --- | --- | --- |
| MCP stdio | 官方 `@modelcontextprotocol/client` `2.0.0` | 握手、9 个工具、提示词增强、fake chat、进程清理 | 协议已验证；具名宿主界面行为仍需报告。 |
| MCP Streamable HTTP | 官方 `@modelcontextprotocol/client` `2.0.0` | HTTP 握手、9 个工具、Bearer 拒绝、Origin 拒绝、进程清理 | 仅当前源码；已发布 `v0.4.9` 镜像仍只有 stdio。 |
| OpenAI Chat Completions | 官方 `openai` JS SDK `7.4.0` | 模型发现、文本响应、流式、结构化错误、提示词增强 | 文本档位；没有工具调用和多模态。 |
| OpenAI Responses | 官方 `openai` JS SDK `7.4.0` | 文本响应、`output_text`、流式事件、fake 执行证据 | 没有响应存储、后台任务、工具和多模态。 |
| A2A v1.0 JSON-RPC | 官方 `@a2a-js/sdk` `1.0.1` | Agent Card、`SendMessage`、`GetTask`、`ListTasks`、任务产物 | 当前源码、仅 fake provider、内存任务、没有流式。 |
| 原生 HTTP 与共享 SDK | Node `fetch`、curl 示例、仓库 SDK 测试 | 健康检查、聊天、流式、提示词增强、运维读取 | 属于 Unified AI System 契约，不是第三方协议。 |

## 客户端准入条件

- MCP 宿主支持 stdio 或 Streamable HTTP，并允许配置对应命令或端点。
- OpenAI 兼容客户端允许自定义 `baseURL`，并只使用文档中的文本 Chat
  Completions 或 Responses 档位。
- A2A 客户端支持 A2A v1.0 Agent Card 发现和 JSON-RPC。
- 通用 HTTP 客户端能发送 JSON、按需读取 SSE，并在启用鉴权时发送网关的
  作用域 Bearer Token。

满足准入条件不等于已经认证。通过[协议客户端报告](https://github.com/happy520ai/unified-ai-system/issues/new?template=protocol-client-report.yml)
提交真实结果，才能把候选客户端加入可复现矩阵。不要提交 Token、Provider Key、
私有提示词或私有端点名称。

本仓库不宣称覆盖全球每一个客户端、完整 OpenAI API、生产就绪、L5 自主或 AGI。
