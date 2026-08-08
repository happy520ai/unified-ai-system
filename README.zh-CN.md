# Unified AI System

<p align="center">
  <strong>面向确定性提示词增强、受治理执行和可复现验证的开源 AI 网关。</strong>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh-CN.md">简体中文</a> |
  <a href="https://happy520ai.github.io/unified-ai-system/">项目主页</a>
</p>

<p align="center">
  <a href="https://github.com/happy520ai/unified-ai-system/stargazers">
    <img alt="GitHub stars" src="https://img.shields.io/github/stars/happy520ai/unified-ai-system?style=flat-square&label=Stars" />
  </a>
  <a href="https://github.com/happy520ai/unified-ai-system/actions/workflows/ci.yml">
    <img alt="CI" src="https://img.shields.io/github/actions/workflow/status/happy520ai/unified-ai-system/ci.yml?branch=master&style=flat-square&label=CI" />
  </a>
  <a href="https://github.com/happy520ai/unified-ai-system/releases/latest">
    <img alt="Release" src="https://img.shields.io/github/v/release/happy520ai/unified-ai-system?style=flat-square" />
  </a>
  <a href="https://registry.modelcontextprotocol.io/v0.1/servers/io.github.happy520ai%2Funified-ai-system/versions/0.4.2">
    <img alt="Official MCP Registry: active" src="https://img.shields.io/badge/Official_MCP_Registry-active-1f883d?style=flat-square" />
  </a>
  <a href="LICENSE">
    <img alt="License" src="https://img.shields.io/github/license/happy520ai/unified-ai-system?style=flat-square" />
  </a>
</p>

Unified AI System 是一个公开的模型、代理、知识和工具网关。
它会在模型调用前把自然语言整理成更可执行的意图，并保持 provider 边界清晰、可验证、可审计。

这不是一个聊天界面外壳，而是一个面向 AI 工作流执行的控制平面。

## 为什么它有用

- 给不太会写提示词的人一个更稳定的入口。
- 支持清洁克隆验证，无需登录或密钥。
- 提供 CLI、HTTP API、SDK、MCP、Codex、Cursor、Cline 入口。
- 明确边界：不宣称 AGI、不宣称 L5、不隐藏 provider 行为。

<p align="center">
  <a href="https://happy520ai.github.io/unified-ai-system/#enhance">
    <img
      src="docs/assets/prompt-enhancement-demo.png"
      alt="Unified AI System 本地提示词增强演示"
      width="100%"
    />
  </a>
  <br />
  <sub>v0.4.2 预览：确定性增强、无需 API Key、不会触发真实 provider 调用。</sub>
</p>

## 60 秒体验

无需登录，直接验证：

```bash
docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.2 pnpm gateway demo
```

一条命令体验自然语言增强：

```bash
docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.2 \
  pnpm gateway demo "给我做一个团队 API" --enhance --profile coding
```

它会启动隔离的 fake-provider 网关，在本地增强请求、输出结构化提示词，
随后自动清理进程，全程不需要 API Key。

你应该看到：

- 本地 fake-provider 执行
- 明确的 `execution: fake`
- 可复现输出
- 不需要 API Key 或账号
- 容器自动退出

提示词增强示例：

```bash
pnpm gateway enhance "给我做一个团队 API" --profile coding
pnpm gateway chat "给我做一个团队 API" --enhance --profile coding
```

## 如何使用

### 终端工作流

安装后：

```bash
pnpm gateway serve
pnpm gateway status
pnpm gateway doctor
pnpm gateway chat "Hello from Unified AI System"
```

### MCP / Codex / Cursor / Cline

发布好的 MCP 命令：

```bash
codex mcp add unified-ai-system -- docker run --rm -i ghcr.io/happy520ai/unified-ai-system/mcp-server:0.4.2
```

### 可安装的 Agent Skill

```bash
codex plugin marketplace add happy520ai/unified-ai-system --ref master
npx skills add happy520ai/unified-ai-system --skill unified-ai-gateway --agent codex --copy --yes
```

Skill 主页：https://skills.sh/happy520ai/unified-ai-system/unified-ai-gateway

本地源码运行：

```bash
git clone https://github.com/happy520ai/unified-ai-system.git
cd unified-ai-system
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm install --frozen-lockfile
pnpm verify:public-clone
pnpm gateway demo
```

## 如何参与

如果这个项目对你有帮助，欢迎 star 仓库，并尽量把反馈做成可验证的内容：

1. 跑一条可复现命令并保留输出。
2. 发一条带仓库链接的短帖。
3. 在 issue #20 留下 OS 和一行输出。
4. 把结果写进 `docs/star-growth-evidence-pack.md`。

推荐链接：

- [文档总览](docs/README.md)
- [Launch Kit](docs/launch-kit.md)
- [社区推广包](docs/community-promotion-pack.md)
- [发布模板](docs/growth-post-templates.md)
- [增长仪表板](docs/star-growth-dashboard.md)
- [增长证据包](docs/star-growth-evidence-pack.md)
- [增长清单](docs/star-growth-checklist.md)
- [使用验证 issue 模板](.github/ISSUE_TEMPLATE/usage-verification-report.yml)
- [Codex for Open Source 申请草稿](docs/codex-for-open-source-application.md)
- [Codex for Open Source 提交文案](docs/codex-for-open-source-submit.md)

## 诚实边界

我们把已验证内容和未声明内容分开：

- 清洁克隆 + fake-provider 路径：**是**
- 对外托管的公共 API：**否**
- 默认真实 provider 执行：**否**，必须显式开启
- 本仓库内置浏览器聊天 UI：**否**（CLI/API/MCP 优先）
- 生产就绪 / AGI / L5：**不宣称**

真实 provider 调用默认关闭。请通过 `.env.example` 和 `docs/providers.md` 安全配置。

## 校验项目

```bash
pnpm check
pnpm test
pnpm check:public
pnpm verify:public-clone
pnpm verify:mcp
```

`master` 上的 CI 会运行 Linux 检查、容器启动烟雾测试、MCP 发现和进程清理检查。

## 主要链接

- [官方 MCP Registry 条目](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.happy520ai%2Funified-ai-system/versions/0.4.2)
- [Release v0.4.2](https://github.com/happy520ai/unified-ai-system/releases/tag/v0.4.2)
- [Codex MCP server README](packages/mcp-server/README.md)
- [Roadmap](ROADMAP.md)
- [Vision](VISION.md)
- [Support](SUPPORT.md)
