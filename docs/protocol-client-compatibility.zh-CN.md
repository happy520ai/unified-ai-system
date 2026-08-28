# 协议与客户端兼容性

项目通过开放协议扩大客户端覆盖。协议测试证明线上契约可用；只有真实运行记录了
产品版本、操作系统、配置和结果后，具名产品才会被标记为已认证。

## 已验证源码协议

| 接口面 | 验证实现 | 已覆盖行为 | 边界 |
| --- | --- | --- | --- |
| MCP stdio | 官方 `@modelcontextprotocol/client` `2.0.0` | 现代 `2026-07-28` `server/discover`、逐请求信封、12 个工具、提示词增强、fake chat、进程清理 | 现代协议源码已验证；具名宿主界面行为仍需报告。 |
| MCP Streamable HTTP | 官方 `@modelcontextprotocol/client` `2.0.0` | 现代 `2026-07-28`、旧版 `2025-11-25`/`2025-06-18`、路由头/CORS、12 个工具、Bearer/Origin 拒绝、清理 | 仅当前源码；已发布 `v0.5.0` 镜像仍只有 stdio。 |
| OpenAI Chat Completions | 官方 `openai` JS SDK `7.4.0` 以及真实 Cline/Continue 宿主 | 模型发现、文本响应、流式、结构化错误、提示词增强、函数工具与工具结果 | 文本与函数工具档位；尚未实现多模态 Chat 输入。 |
| OpenAI Responses | 官方 `openai` JS SDK `7.4.0` | 文本响应、`output_text`、流式事件、fake 执行证据 | 没有响应存储、后台任务、工具和多模态。 |
| A2A v1.0 JSON-RPC | 官方 `@a2a-js/sdk` `1.0.1` | 可验证 Agent Card/JWKS、`SendMessage`、`GetTask`、`ListTasks`、`CancelTask`、任务产物、有界 memory/SQLite/PostgreSQL 状态与 PostgreSQL execution fencing | 当前源码、仅 fake provider、没有流式；下游副作用尚未原子消费 fence。 |
| 原生 HTTP 与共享 SDK | Node `fetch`、curl 示例、仓库 SDK 测试 | 健康检查、聊天、流式、提示词增强、运维读取 | 属于 Unified AI System 契约，不是第三方协议。 |

## 已验证具名 MCP 宿主

以下是产品级真实运行结果，不是从协议兼容性推断出来的结论。所有条目均来自隔离的
Windows x64 认证：宿主必须发出 `initialize`、`notifications/initialized` 和
`tools/list`，发现全部 12 个网关工具，不调用真实 Provider，并且退出后不
留下宿主或 MCP Server 进程。需要实际调用工具的档案只能调用一次只读
`gateway_health`。

| 宿主 | 已测试版本 | 协商 MCP 版本 | 结果 |
| --- | --- | --- | --- |
| Claude Code | `2.1.227` | `2025-11-25` | 发现 12 个工具；无工具或模型调用；清理已验证。 |
| Gemini CLI | `0.54.4` | `2025-06-18` | 最小 ACP 初始化后由真实 Gemini MCP 客户端发现工具；无会话提示词或模型调用；清理已验证。 |
| OpenCode CLI | `1.18.16` | `2025-11-25` | 在 `--pure` 隔离配置下发现 12 个工具；无工具或模型调用；清理已验证。 |
| Cursor Agent CLI | `2026.08.04-aaa8809` | `2025-11-25` | 通过官方 `mcp list-tools` 发现 12 个工具；无账号或模型调用；清理已验证。 |
| Cline CLI | `3.0.52` | `2024-11-05` | 发现 12 个工具；通过本地 fake 模型仅调用只读 `gateway_health`；清理已验证。 |
| Continue CLI | `1.5.47` | `2025-11-25` | 发现 12 个工具；通过本地 fake 模型仅调用只读 `gateway_health`；清理已验证。 |

Codex App Server 和 VS Code Extension Host 也有同一认证器生成的自动化档案。
Claude Desktop、JetBrains、Windsurf 等已入目录的宿主，在提交具名版本和脱敏
运行报告前仍保持待人工状态。

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
