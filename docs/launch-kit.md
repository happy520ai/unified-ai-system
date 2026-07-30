# Launch Kit

Use these materials when sharing Unified AI System. Keep the repository URL
unchanged so readers can verify the project directly:

https://github.com/happy520ai/unified-ai-system

## One Sentence

Unified AI System is an open, terminal-first AI gateway for multi-model
routing, governed agents, knowledge, tools, and human-controlled automation.

## English Launch Post

AI is becoming more capable, but the infrastructure needed to own, route, and
govern it is still fragmented.

Today I am opening Unified AI System: a local-first gateway that brings models,
agents, knowledge, tools, approvals, and evidence into one control plane. A
fresh clone runs without an API key through a deterministic fake provider, and
real providers remain explicit opt-in.

The terminal is the primary interface. One Docker command proves the isolated
path without a clone or API key:

`docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:latest pnpm gateway demo`

The `serve`, `status`, `chat`, and `doctor` commands provide a practical local
workflow. Chat fails closed if a real provider may be active unless that one
command is explicitly authorized.

This is an early public engineering preview, not a production or AGI claim. I
am looking for builders who care about model freedom, agent interoperability,
local sovereignty, and evidence-based AI governance.

Repository: https://github.com/happy520ai/unified-ai-system

## 中文发布文案

AI 能力正在快速增长，但真正稀缺的，是让人能够拥有、连接、调度和治理这些
智能的开放基础设施。

今天正式公开 Unified AI System：一个本地优先的 AI 能力网关，把多模型路由、
智能体协作、知识、工具、审批和执行证据放进同一个控制平面。全新克隆无需
API Key 即可通过本地假模型完成启动与验证，真实 Provider 始终需要用户主动
配置和授权。

终端是当前主入口。一条 Docker 命令即可在无需克隆仓库或配置 API Key 的
情况下验证隔离链路：

`docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:latest pnpm gateway demo`

`serve`、`status`、`chat` 和 `doctor` 组成可持续使用的本地工作流。当网关可能
使用真实 Provider 时，Chat 会默认拒绝发送，只有为本次命令显式授权后才会
继续。

这还是一个早期公开工程预览，不是生产、L5 或 AGI 宣称。欢迎关注模型自由、
Agent 协议、本地数据主权和可信 AI 治理的开发者一起参与。

项目地址：https://github.com/happy520ai/unified-ai-system

## Show HN

Title:

```text
Show HN: Unified AI System - a local-first gateway for models, agents, and governed automation
```

Opening:

```text
I built Unified AI System to explore what an open control plane for AI could
look like: provider-neutral model routing, agent collaboration, knowledge,
tools, approvals, and evidence in one local-first gateway.

One Docker command runs an isolated, credential-free request using a
deterministic fake provider, then cleans itself up. The terminal CLI also
supports startup, status, chat, and diagnostics. Real provider calls are
explicit opt-in. The project is an early public engineering preview, and I
would value feedback on the architecture, developer experience, and
governance model.
```

## Short Social Post

```text
Open-sourcing Unified AI System: a local-first gateway for multi-model routing,
governed agents, knowledge, tools, and human-controlled automation.

No API key is required for the first run. Real providers are explicit opt-in.
One-command Docker demo plus a terminal CLI for demo, serve, status, chat, and
doctor.
Early public preview, built in the open.

https://github.com/happy520ai/unified-ai-system
```

## Sharing Principles

- Lead with a concrete problem and a runnable capability.
- Link directly to the repository.
- Ask for technical feedback instead of asking only for Stars.
- Never describe local checks as production, L5, or AGI evidence.
- Respond to every substantive issue, discussion, and pull request.
