# Unified AI System

<p align="center">
  <strong>面向自然语言增强、受治理执行与可复现验证的开源 AI 网关。</strong>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh-CN.md">简体中文</a> |
  <a href="https://happy520ai.github.io/unified-ai-system/">项目主页</a>
</p>

<p align="center">
  <a href="https://codespaces.new/happy520ai/unified-ai-system?quickstart=1">
    <img alt="在 GitHub Codespaces 中打开" src="https://github.com/codespaces/badge.svg" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/happy520ai/unified-ai-system/stargazers">
    <img alt="GitHub Stars" src="https://img.shields.io/github/stars/happy520ai/unified-ai-system?style=flat-square&label=Stars" />
  </a>
  <a href="https://github.com/happy520ai/unified-ai-system/actions/workflows/ci.yml">
    <img alt="CI" src="https://img.shields.io/github/actions/workflow/status/happy520ai/unified-ai-system/ci.yml?branch=master&style=flat-square&label=CI" />
  </a>
  <a href="https://github.com/happy520ai/unified-ai-system/actions/workflows/docker-build-push.yml">
    <img alt="Container" src="https://img.shields.io/github/actions/workflow/status/happy520ai/unified-ai-system/docker-build-push.yml?branch=master&style=flat-square&label=container" />
  </a>
  <a href="https://github.com/happy520ai/unified-ai-system/releases/latest">
    <img alt="Release" src="https://img.shields.io/github/v/release/happy520ai/unified-ai-system?style=flat-square" />
  </a>
  <a href="https://registry.modelcontextprotocol.io/v0.1/servers/io.github.happy520ai%2Funified-ai-system/versions/0.4.2">
    <img alt="Official MCP Registry" src="https://img.shields.io/badge/Official_MCP_Registry-active-1f883d?style=flat-square" />
  </a>
  <a href="LICENSE">
    <img alt="Apache-2.0 License" src="https://img.shields.io/github/license/happy520ai/unified-ai-system?style=flat-square" />
  </a>
</p>

Unified AI System 是一个面向模型、智能体、知识与工具的开源 AI 网关。
它把用户的自然语言需求整理成更清晰、更可执行的意图，再交给模型或工作流处理，同时保留明确的 provider 边界和可审计的验证证据。

它不是一个聊天页面包装器，而是一个面向 AI 工作流执行的控制平面。

**从这里开始：** [运行 60 秒体验](README.zh-CN.md#60-秒体验) · [在 Codespaces 中打开](https://codespaces.new/happy520ai/unified-ai-system?quickstart=1)。如果它对你的工作有帮助，欢迎[给仓库点 Star](https://github.com/happy520ai/unified-ai-system)，并在 [Issue #20](https://github.com/happy520ai/unified-ai-system/issues/20) 分享一行可复现结果。

## 为什么使用它

- 不擅长写提示词的用户，也能从自然语言开始工作。
- 无需账号或密钥即可完成干净克隆验证。
- 提供 curl、Python 标准库和 JavaScript 的无 provider 示例。
- 同时支持 CLI、HTTP API、SDK、MCP、Codex、Cursor 和 Cline。
- 默认使用本地 fake provider，真实 provider 必须显式启用。
- 不声称 AGI、L5 或生产就绪，只展示可以复现的行为。

<p align="center">
  <a href="https://happy520ai.github.io/unified-ai-system/#enhance">
    <img
      src="docs/assets/prompt-enhancement-demo.png"
      alt="Unified AI System 本地提示词增强演示"
      width="100%"
    />
  </a>
  <br />
  <sub>v0.4.2：确定性增强、无需 API Key、不会触发真实 provider 调用。</sub>
</p>

## 60 秒体验

无需登录，直接验证发布镜像：

```bash
docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.2 pnpm gateway demo
```

你将看到：

- 本地 fake provider 执行
- 明确的 `execution: fake`
- 可重复的输出
- 不需要 API Key 或账号
- 容器自动退出并清理

用一条命令体验自然语言增强：

```bash
docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.2 \
  pnpm gateway demo "帮我为团队设计一个小型 API" --enhance --profile coding
```

网关会在本地增强请求、输出结构化提示词，然后自动清理隔离进程，全程不调用真实 provider。
如果需要指定输出语言，可以使用 `--language zh-CN` 或 `--language en`；省略时默认自动检测。

## 常用工作流

### 终端

从源码安装后：

```bash
pnpm gateway serve
pnpm gateway status
pnpm gateway doctor
pnpm gateway enhance "帮我为团队设计一个小型 API" --profile coding
pnpm gateway chat "帮我为团队设计一个小型 API" --enhance --profile coding
```

完整的 HTTP 示例见[自然语言增强指南](docs/prompt-enhancement.md)，其中包含跨平台 curl、Python 和 SDK 用法。

### MCP、Codex、Cursor、Cline

直接添加已发布的 MCP 镜像：

```bash
codex mcp add unified-ai-system -- docker run --rm -i ghcr.io/happy520ai/unified-ai-system/mcp-server:0.4.2
```

重启 Codex 后运行 `/mcp` 检查连接，再参考 [Codex MCP 60 秒快速开始](docs/codex-mcp-quickstart.md)。
项目提供九个工具，包括健康检查、自然语言增强、聊天、知识、工作流和 workforce 能力。

### 可安装的 Agent Skill

```bash
codex plugin marketplace add happy520ai/unified-ai-system --ref master
npx skills add happy520ai/unified-ai-system --skill unified-ai-gateway --agent codex --copy --yes
```

Skill 主页：<https://skills.sh/happy520ai/unified-ai-system/unified-ai-gateway>

### 从源码运行

```bash
git clone https://github.com/happy520ai/unified-ai-system.git
cd unified-ai-system
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm install --frozen-lockfile
pnpm verify:public-clone
pnpm gateway demo
```

Node.js 20 或更高版本受支持，Node.js 22 是依赖兼容性更广的推荐版本。

如果不想配置本地环境，可以直接使用 [GitHub Codespaces](https://codespaces.new/happy520ai/unified-ai-system?quickstart=1)。工作区准备完成后运行：

```bash
pnpm verify:public-clone
pnpm gateway demo "帮我为团队设计一个小型 API" --enhance --profile coding
```

仓库的 devcontainer 默认保持 provider-free。Codespaces 的可用性和使用额度由 GitHub 控制。

## 帮助项目成长

如果这个项目对你有帮助，请：

1. 运行一条可复现命令并保留输出。
2. 给仓库点 Star，并分享仓库链接。
3. 在 [Issue #20](https://github.com/happy520ai/unified-ai-system/issues/20) 留下操作系统和一行输出。
4. 将真实反馈转化为文档、测试或代码改进。

推广材料与验证入口：

- [文档总览](docs/README.md)
- [Launch Kit](docs/launch-kit.md)
- [社区推广包](docs/community-promotion-pack.md)
- [发布模板](docs/growth-post-templates.md)
- [增长仪表板](docs/star-growth-dashboard.md)
- [增长证据包](docs/star-growth-evidence-pack.md)
- [增长清单](docs/star-growth-checklist.md)
- [使用验证 Issue 模板](.github/ISSUE_TEMPLATE/usage-verification-report.yml)
- [适合新贡献者的 Issue #58](https://github.com/happy520ai/unified-ai-system/issues/58)
- [贡献指南](CONTRIBUTING.md)
- [Codex for Open Source 申请草稿](docs/codex-for-open-source-application.md)
- [Codex for Open Source 提交文案](docs/codex-for-open-source-submit.md)

## 诚实边界

- 干净克隆和 fake provider 路径：**已验证**
- 托管的公共 API：**没有**
- 默认真实 provider 执行：**没有**，必须显式启用
- 仓库内置浏览器聊天 UI：**没有**，CLI、API 和 MCP 是一等入口
- 生产就绪、AGI、L5：**不声称**

真实 provider 默认关闭。请参考 `.env.example` 和[provider 配置指南](docs/providers.md)进行显式配置。

## 验证项目

```bash
pnpm check
pnpm test
pnpm check:public
pnpm verify:public-clone
pnpm verify:mcp
```

`master` 上的 CI 会执行 Linux 检查、容器启动 smoke test、MCP 发现和进程清理验证。

## 项目链接

- [官方 MCP Registry 条目](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.happy520ai%2Funified-ai-system/versions/0.4.2)
- [Release v0.4.2](https://github.com/happy520ai/unified-ai-system/releases/tag/v0.4.2)
- [Codex MCP Server README](packages/mcp-server/README.md)
- [Roadmap](ROADMAP.md)
- [Vision](VISION.md)
- [Support](SUPPORT.md)
