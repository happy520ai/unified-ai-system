# MCP 客户端兼容性矩阵

本页说明已发布的 `v0.5.0` MCP 接入方式和对应证据。文档中存在安装命令，
不等于已经完成客户端认证；客户端运行时能力必须有真实客户端报告支持。

## 已发布基线

- 镜像：`ghcr.io/happy520ai/unified-ai-system/mcp-server:0.6.0`
- 传输：本地 Docker 进程通过 MCP stdio 通信
- 工具：12 个受治理工具，包括无需 Provider 的提示词增强
- 默认模式：`local-fake-provider`，不需要 Provider Key
- 源码证据：`pnpm verify:mcp` 和 `pnpm verify:public-clone`
- Registry：[官方 MCP Registry v0.5.0](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.happy520ai%2Funified-ai-system/versions/0.6.0)

## 源码基线

当前源码新增 MCP Streamable HTTP 入口：
`http://127.0.0.1:3210/mcp`。`pnpm verify:mcp` 使用官方 MCP v2 客户端同时
验证 stdio 和 HTTP：固定现代无状态 `2026-07-28`，保留旧版
`2025-11-25`/`2025-06-18` 协商，并检查现代路由头/CORS、访问拒绝与托管
进程清理。这个 HTTP 入口尚未包含在已发布的 `v0.5.0` 镜像中。

## 矩阵

| 客户端路径 | 安装或配置 | 首次检查 | 证据边界 |
| --- | --- | --- | --- |
| Node MCP SDK 测试宿主 | 运行 `pnpm verify:mcp`。 | `@modelcontextprotocol/client` 测试宿主会验证 stdio 和 Streamable HTTP、列出 12 个工具、调用受治理工具、检查 HTTP 访问控制并关闭托管网关。 | 这是真实协议集成证据，不代表已经认证第三方客户端界面。 |
| Codex | `codex mcp add unified-ai-system -- docker run --rm -i ghcr.io/happy520ai/unified-ai-system/mcp-server:0.6.0` | 运行 `codex mcp get unified-ai-system --json`，重启 Codex，再使用 `/mcp verbose`。 | 自动化源码档案已验证官方 Codex App Server `0.147.0`、全部 12 个工具、一次无需 Provider 的增强调用和无模型回合清理。 |
| WorkBuddy | 在 `.mcp.json` 中声明 `mcpServers.unified-ai-system`。机器绝对解释器路径只作为本地未提交覆盖保留，参见[本地客户端收敛](#本地客户端收敛)。 | 重启宿主，确认 12 个工具，再调用 `gateway_health`。 | 配置等价宿主使用 `.mcp.json` 中记录的 `command`/`args`/`cwd` 原样启动，协商 MCP `2025-06-18`，发现 12 个工具并返回 fake-provider 输出。这是启动参数与协议证据，不代表已认证 WorkBuddy 界面。 |
| ZCode | 在 `.zcode/config.json` 中声明 `mcp.servers.unified-ai-system`。该目录已被 gitignore，因为它保存按机器不同的解释器路径。 | 重启宿主，确认 12 个工具，再调用 `gateway_health`。 | 配置等价宿主使用 `.zcode/config.json` 中记录的 `command`/`args`/`cwd`/`env` 原样启动，协商 MCP `2025-06-18`，发现 12 个工具并返回 fake-provider 输出。这是启动参数与协议证据，不代表已认证 ZCode 界面。 |
| VS Code | 在隔离的 VS Code 配置中加入源码 MCP Server。 | 检查 `vscode.lm.tools`，再通过 `vscode.lm.invokeTool` 调用 `gateway_prompt_enhance`。 | VS Code `1.118.1` Extension Host 发现全部 12 个工具，完成增强调用，没有模型或 Provider 请求，并完成清理。 |
| Claude Code | 按[客户端运行时认证](client-runtime-certification.md)安装固定版本宿主。 | 认证器执行 Claude Code 的 `mcp add` 和 `mcp list`。 | Claude Code `2.1.227` 发出真实 MCP 握手和 `tools/list`，发现 12 个工具，没有模型或 Provider 调用，并完成清理。 |
| Gemini CLI | 按[客户端运行时认证](client-runtime-certification.md)安装固定版本宿主。 | 认证器执行 `mcp add`、连接探针和最小 ACP 初始化。 | Gemini CLI `0.54.4` 使用真实 MCP 客户端发现 12 个工具，没有发送提示词或调用模型，并完成清理。 |
| OpenCode CLI | 按[客户端运行时认证](client-runtime-certification.md)安装固定版本宿主。 | 认证器在隔离内联配置下执行 `opencode --pure mcp list`。 | OpenCode `1.18.16` 发现 12 个工具，没有加载外部插件或配置，没有模型或 Provider 调用，并完成清理。 |
| Cursor Agent CLI | 配置 `.cursor/mcp.json`，再按[客户端运行时认证](client-runtime-certification.md)使用固定版本宿主。 | 认证器执行 `mcp enable` 和 `mcp list-tools unified-ai-system`。 | Cursor Agent CLI `2026.08.04-aaa8809` 协商 MCP `2025-11-25`，无需账号凭据或模型请求即发现 12 个工具，并完成清理。 |
| Cline CLI | `cline mcp install unified-ai-system --yes --json -- docker run --rm -i ghcr.io/happy520ai/unified-ai-system/mcp-server:0.6.0` | 按[客户端运行时认证](client-runtime-certification.md)运行隔离的固定版本档案。 | Cline `3.0.52` 发现 12 个工具，并通过本地 fake 模型仅调用只读 `gateway_health`；未启用或调用真实 Provider，清理已验证。 |
| Continue CLI | 在本地 `config.yaml` 中声明 Server，或按[客户端运行时认证](client-runtime-certification.md)运行固定版本档案。 | 认证器使用本地 fake 模型执行 `cn --config ... -p`。 | Continue `1.5.47` 协商 MCP `2025-11-25`，发现 12 个工具，仅调用只读 `gateway_health`，真实 Provider 尝试为 0，并完成清理。 |
| 通用 MCP stdio 宿主 | 按[通用客户端配置](mcp-generic-client.md)加入 `mcpServers.unified-ai-system`。 | 重启宿主，确认 12 个工具，调用 `gateway_health`，再调用 `gateway_readiness`。 | JSON 配置和 MCP 服务路径由仓库的 provider-free 验证覆盖。 |
| 通用 MCP Streamable HTTP 宿主 | 运行 `pnpm mcp:http`，配置 `http://127.0.0.1:3210/mcp`。 | 列出 12 个工具，再调用 `gateway_health` 和 `gateway_readiness`。 | 源码端点已通过协议测试；具名客户端只有提交真实运行报告后才算已认证。 |

## 本地客户端收敛

本仓库中有三个宿主启动同一个源码 MCP Server。它们收敛到同一个服务入口，
同时把机器相关路径挡在版本库之外。

| 配置文件 | 是否纳入 git | 启动形态 |
| --- | --- | --- |
| `.codex/config.toml` | 已提交，可移植 | `command = "node"`，配合仓库相对路径 |
| `.mcp.json` | 已提交为可移植 Docker 启动方式 | 源码检出可在本地覆盖为绝对解释器路径；该覆盖保持未提交 |
| `.zcode/config.json` | 已忽略（`.gitignore`） | 保存按机器不同的解释器路径，因此整个目录仅存于本地 |

不要把绝对解释器路径、盘符和用户目录写进已提交的配置。可移植的 ZCode
配置形如：

```json
{
  "mcp": {
    "servers": {
      "unified-ai-system": {
        "command": "node",
        "args": ["packages/mcp-server/src/index.js"],
        "env": {
          "AI_GATEWAY_PROVIDER_MODE": "fake",
          "AI_GATEWAY_REAL_PROVIDER_ENABLED": "false"
        }
      }
    }
  }
}
```

每个已连接宿主都会获得自己的托管网关子进程，监听各自的回环端口。断开某个
宿主只回收该宿主的端口，其余宿主继续提供工具。可用
`apps/ai-gateway-service/evidence/` 下的验证脚本在本地重新生成这份证据；
其输出记录了机器相关端口与进程号，因此已被 gitignore。

## 安全验证顺序

1. 确认宿主已加载服务，并列出预期的 12 个工具。
2. 调用 `gateway_health` 和 `gateway_readiness`。
3. 只有在就绪状态证明真实 Provider 已禁用时，才继续调用
   `gateway_chat`，并把结果标记为 fake-provider 输出。
4. 在[MCP 客户端报告模板](https://github.com/happy520ai/unified-ai-system/issues/new?template=mcp-client-report.yml)
   中记录客户端、传输方式、操作系统、命令、工具数量和一行脱敏输出。

不要把 Provider Key 加入公开安装命令。本矩阵不宣称生产就绪、L5 自主、
AGI 或对所有客户端的普遍支持。
