# Launch Kit

Use these materials when sharing Unified AI System. Keep the repository URL
unchanged so readers can verify the project directly:

https://github.com/happy520ai/unified-ai-system

## One Sentence

Unified AI System is an open, terminal-first AI gateway that turns rough
natural language into structured work before models, agents, and tools run.

## English Launch Post

Most people do not write perfect prompts, and they should not have to learn a
prompting dialect before an AI system can understand useful work.

Unified AI System v0.4.0 adds deterministic, provider-free prompt enhancement
to its local-first AI gateway. A rough English or Chinese request can be turned
into explicit requirements, output constraints, completion criteria, and
clarifying questions while the original request remains visible.

The same capability is available through the terminal CLI, HTTP API, shared
SDK, opt-in chat path, and a ninth MCP tool for Codex, Cursor, and Cline. The
preview itself calls no model, needs no API key, and cannot enable a provider.

Connect the published MCP server to Codex with one command:

`codex mcp add unified-ai-system -- docker run --rm -i ghcr.io/happy520ai/unified-ai-system/mcp-server:0.4.0`

Or run the CLI from source and compare the original request with its structured
preview using `pnpm gateway enhance "Build a small API for my team" --profile coding`.
Plain chat remains unchanged unless enhancement is explicitly enabled.

This is an engineering preview, not a claim that prompt transformation
guarantees model quality, production readiness, L5 autonomy, or AGI. I would
value feedback on the enhancement format, MCP ergonomics, and safety boundary.

Repository: https://github.com/happy520ai/unified-ai-system

Agent Skill: `npx skills add happy520ai/unified-ai-system --skill unified-ai-gateway --agent codex --copy --yes`

## 中文发布文案

多数用户不会写所谓“完美提示词”，也不应该先学习一套提示词方言，AI 系统才能
理解他们真正想完成的工作。

Unified AI System v0.4.0 为本地优先的 AI 能力网关加入了确定性、无需 Provider
的自然语言增强。用户输入粗略中文或英文需求后，网关会补全执行要求、输出约束、
验收标准和澄清问题，同时完整保留原始输入。

这项能力已经进入终端 CLI、HTTP API、共享 SDK、显式启用的 Chat，以及面向
Codex、Cursor 和 Cline 的第 9 个 MCP 工具。增强预览本身不调用模型、不需要
API Key，也不能启用任何 Provider。

一条命令即可把已发布的 MCP Server 接入 Codex：

`codex mcp add unified-ai-system -- docker run --rm -i ghcr.io/happy520ai/unified-ai-system/mcp-server:0.4.0`

也可以从源码运行 CLI，通过
`pnpm gateway enhance "帮团队做一个小型 API" --profile coding` 对照原始需求与
结构化结果。普通 Chat 默认保持不变，只有显式启用时才会增强。

这是公开工程预览，不代表提示转换可以保证模型效果，也不是生产、L5 或 AGI
宣称。欢迎针对增强格式、MCP 使用体验和安全边界提出技术反馈。

项目地址：https://github.com/happy520ai/unified-ai-system

Codex MCP Docker 中文教程：https://happy520ai.github.io/unified-ai-system/codex-mcp-docker-quickstart.zh-CN.html

Agent Skill：`npx skills add happy520ai/unified-ai-system --skill unified-ai-gateway --agent codex --copy --yes`

## Show HN

Title:

```text
Show HN: A local AI gateway that improves rough prompts before calling a model
```

Opening:

```text
I built a deterministic prompt-enhancement path into Unified AI System because
many users know what they want but not how to express it as a precise model
instruction. It structures rough English or Chinese requests locally, preserves
the original input, and calls no provider.

The capability is available through CLI, HTTP, SDK, opt-in chat, and a ninth
MCP tool for Codex, Cursor, and Cline. The gateway is self-hosted, fake-provider
by default, and real calls remain explicit opt-in. I would value feedback on
whether the generated structure is useful and where the safety boundary should
sit.
```

## Short Social Post

```text
Unified AI System v0.4.0 turns rough natural language into structured work
before a model is called.

English + Chinese profiles. Original request preserved. No provider call for
the preview. Available through CLI, HTTP, SDK, opt-in chat, and a ninth MCP tool
for Codex, Cursor, and Cline.

Self-hosted, Apache-2.0, and fake-provider by default.

https://github.com/happy520ai/unified-ai-system
```

## Sharing Principles

- Lead with a concrete problem and a runnable capability.
- Link directly to the repository.
- Ask for technical feedback instead of asking only for Stars.
- Never describe local checks as production, L5, or AGI evidence.
- Respond to every substantive issue, discussion, and pull request.
