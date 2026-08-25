# 首次运行排障

当 provider-free 快速开始没有按预期工作时，可以先从下面的矩阵排查。
默认路径不需要 API Key，也不会调用真实 provider。

| 现象 | 可能原因 | 下一步 |
| --- | --- | --- |
| 找不到 `docker` 命令 | Docker 未安装，或没有加入 `PATH`。 | 安装 Docker Desktop，重启终端后重新运行[60 秒演示](../README.zh-CN.md#60-秒体验)。 |
| Docker 无法连接 daemon | Docker Desktop 已安装但还没有启动。 | 启动 Docker Desktop，并等待引擎显示运行中。 |
| `3100` 端口已被占用 | 其他本地服务正在使用该端口。 | 将宿主机端口改为 `3210`，例如 `--publish 3210:3100`，然后访问 `http://127.0.0.1:3210`。 |
| 找不到 `pnpm` 或 `corepack` | Node.js 未安装，或当前 Shell 尚未启用 Corepack。 | 安装 Node.js 22.18.0 或更高版本，运行 `corepack enable` 和 `corepack prepare pnpm@11.19.0 --activate`。 |
| PowerShell 执行多行命令失败 | 把 Bash 的续行语法直接粘贴到了 PowerShell。 | 使用[Windows PowerShell 示例](getting-started.md#windows-powershell)，或先运行单行容器演示。 |
| 命令似乎要求 provider Key | 可能启用了真实 provider，或使用了不适合首次验证的命令。 | 先运行 `pnpm gateway demo`，保持 `AI_GATEWAY_PROVIDER_MODE=fake` 和 `AI_GATEWAY_REAL_PROVIDER_ENABLED=false`。不要在 Issue 中粘贴密钥。 |
| Codex 中看不到 MCP 工具 | 客户端还没有重新加载 MCP 配置。 | 重启 Codex 或打开新任务，然后运行 `/mcp verbose`；源码目录中可运行 `pnpm verify:mcp`。 |
| GHCR 或 Docker 当前不可用 | 当前网络无法拉取公开容器。 | 使用浏览器 [Prompt Lab](https://happy520ai.github.io/unified-ai-system/#enhance)，或安装依赖后运行源码验证路径。 |

## 可复制的运行转录

下面是经过脱敏的预期路径，不包含任何凭据；耗时和模型文本可能不同。
提交问题时，请在每条命令旁边保留操作系统和 Shell 信息。

### Windows PowerShell

```powershell
# Windows PowerShell
PS> docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.5.0 pnpm gateway demo
[ready] provider      local-fake-provider
[ready] execution     fake
[ready] real calls    disabled
[done] ... | no API key | process cleaned up
```

如果 PowerShell 报告 `docker : The term 'docker' is not recognized`，请安装
Docker Desktop，或使用下面的 [Codespaces 无 Docker 路径](#codespaces-无-docker)。

如果需要修改端口，PowerShell 的续行符必须放在第一行末尾：

```powershell
# Windows PowerShell
PS> docker run --rm --publish 3210:3100 `
>> ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.5.0 pnpm gateway demo
[ready] provider      local-fake-provider
[ready] execution     fake
[done] ... | no API key | process cleaned up
```

### macOS/Linux Bash 或 Zsh

```bash
# macOS/Linux Bash 或 Zsh
$ docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.5.0 pnpm gateway demo
[ready] provider      local-fake-provider
[ready] execution     fake
[ready] real calls    disabled
[done] ... | no API key | process cleaned up
```

如果 Shell 报告 `docker: command not found`，可以使用浏览器 [Prompt
Lab](https://happy520ai.github.io/unified-ai-system/#enhance)，或继续使用下面的源码路径。

Bash 或 Zsh 使用反斜杠续行：

```bash
# macOS/Linux Bash 或 Zsh
$ docker run --rm --publish 3210:3100 \
> ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.5.0 pnpm gateway demo
[ready] provider      local-fake-provider
[ready] execution     fake
[done] ... | no API key | process cleaned up
```

### Codespaces 无 Docker

```bash
# GitHub Codespaces 终端（Bash）
$ pnpm install --frozen-lockfile
$ pnpm verify:public-clone
{ "ok": true, "realProviderCallsMade": false, "managedGatewayCleanedUp": true }
$ pnpm gateway demo
[ready] provider      local-fake-provider
[ready] execution     fake
[done] ... | no API key | process cleaned up
```

仓库的 devcontainer 默认保持 provider-free。若工作区尚未完成启动，请等待终端
准备就绪后重试，不要为了首次验证添加 provider Key。

如果首次验证早于依赖安装完成，请等待安装任务结束后重试同一命令；不要通过开启
真实 provider 来修复本地启动问题。

## 提交可复现问题

请提供：

1. 操作系统和 Shell。
2. 完整命令，并删除其中的密钥或敏感值。
3. 完整错误信息和第一行相关输出。
4. Docker 是否运行，以及是否配置过 provider Key。
5. 已经成功尝试过的最小路径，例如 `pnpm gateway demo`。

不要提交 `.env`、provider Key、原始 webhook 或私有授权记录。
详细边界请阅读[贡献指南](../CONTRIBUTING.md)。
