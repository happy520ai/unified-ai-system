# MCP 客户端兼容性矩阵

本页说明已发布的 `v0.4.9` MCP 接入方式和对应证据。文档中存在安装命令，
不等于已经完成客户端认证；客户端运行时能力必须有真实客户端报告支持。

## 已发布基线

- 镜像：`ghcr.io/happy520ai/unified-ai-system/mcp-server:0.4.9`
- 传输：本地 Docker 进程通过 MCP stdio 通信
- 工具：9 个受治理工具，包括无需 Provider 的提示词增强
- 默认模式：`local-fake-provider`，不需要 Provider Key
- 源码证据：`pnpm verify:mcp` 和 `pnpm verify:public-clone`
- Registry：[官方 MCP Registry v0.4.9](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.happy520ai%2Funified-ai-system/versions/0.4.9)

## 源码基线

当前源码新增 MCP Streamable HTTP 入口：
`http://127.0.0.1:3210/mcp`。`pnpm verify:mcp` 使用官方 MCP v2 客户端同时
验证 stdio 和 HTTP，并检查访问拒绝与托管进程清理。这个 HTTP 入口尚未包含在
已发布的 `v0.4.9` 镜像中。

## 矩阵

| 客户端路径 | 安装或配置 | 首次检查 | 证据边界 |
| --- | --- | --- | --- |
| Node MCP SDK 测试宿主 | 运行 `pnpm verify:mcp`。 | `@modelcontextprotocol/client` 测试宿主会验证 stdio 和 Streamable HTTP、列出 9 个工具、调用受治理工具、检查 HTTP 访问控制并关闭托管网关。 | 这是真实协议集成证据，不代表已经认证第三方客户端界面。 |
| Codex | `codex mcp add unified-ai-system -- docker run --rm -i ghcr.io/happy520ai/unified-ai-system/mcp-server:0.4.9` | 运行 `codex mcp get unified-ai-system --json`，重启 Codex，再使用 `/mcp verbose`。 | 仓库已验证 MCP stdio 服务和托管网关；除非有贡献者报告，否则不宣称 Codex CLI 会话已验证。 |
| Cursor | `pnpm dlx add-mcp@2.0.0 "docker run --rm -i ghcr.io/happy520ai/unified-ai-system/mcp-server:0.4.9" --name unified-ai-system -a cursor -y` | 打开 MCP 工具检查器，先运行 `gateway_health`，再运行 `gateway_readiness`。 | 命令和发布镜像已有文档；Cursor 客户端运行时仍需要真实证据。 |
| Cline | `cline mcp install unified-ai-system --yes --json -- docker run --rm -i ghcr.io/happy520ai/unified-ai-system/mcp-server:0.4.9` | 启动全新的 Cline 会话，列出 9 个工具，并在聊天前检查健康和就绪状态。 | 安装契约已有文档；Cline 客户端运行时需要真实使用报告。 |
| 通用 MCP stdio 宿主 | 按[通用客户端配置](mcp-generic-client.md)加入 `mcpServers.unified-ai-system`。 | 重启宿主，确认 9 个工具，调用 `gateway_health`，再调用 `gateway_readiness`。 | JSON 配置和 MCP 服务路径由仓库的 provider-free 验证覆盖。 |
| 通用 MCP Streamable HTTP 宿主 | 运行 `pnpm mcp:http`，配置 `http://127.0.0.1:3210/mcp`。 | 列出 9 个工具，再调用 `gateway_health` 和 `gateway_readiness`。 | 源码端点已通过协议测试；具名客户端只有提交真实运行报告后才算已认证。 |

## 安全验证顺序

1. 确认宿主已加载服务，并列出预期的 9 个工具。
2. 调用 `gateway_health` 和 `gateway_readiness`。
3. 只有在就绪状态证明真实 Provider 已禁用时，才继续调用
   `gateway_chat`，并把结果标记为 fake-provider 输出。
4. 在[MCP 客户端报告模板](https://github.com/happy520ai/unified-ai-system/issues/new?template=mcp-client-report.yml)
   中记录客户端、传输方式、操作系统、命令、工具数量和一行脱敏输出。

不要把 Provider Key 加入公开安装命令。本矩阵不宣称生产就绪、L5 自主、
AGI 或对所有客户端的普遍支持。
