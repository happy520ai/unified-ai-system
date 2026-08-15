# Growth Launch Kit — 2026-08 (v0.5 "Gateway" positioning)

定位升级：从"prompt 增强器"到**自托管 LLM 网关平台**。所有文案围绕一个钩子：
"LiteLLM/Portkey 级能力 + MCP 治理 + 零凭证试用"。

一句话（EN）: *Self-hosted AI gateway with virtual keys & token budgets, exact
+ semantic response cache, and reverse MCP governance (any OpenAPI spec →
governed MCP tools) — try every feature with zero credentials.*

一句话（中）：*自托管 AI 网关：虚拟 key + token 预算、精确/语义双层响应缓存、
反向 MCP 治理（任意 OpenAPI 一键变 MCP 工具）——全部能力零凭证可试。*

## 1) Show HN

标题：`Show HN: Self-hosted AI gateway with virtual keys, semantic cache, and reverse MCP governance`

正文（直接粘贴）：

```text
Hi HN, I've been building an open-source, self-hosted AI gateway (Node/TS, Apache-2.0).

What makes it different from LiteLLM/Portkey-style gateways:

1. Fake-provider-first: the default runtime is a deterministic local provider.
   Every feature — virtual keys, caching, metrics — is fully exercisable with
   zero credentials, and real provider calls stay behind an explicit
   three-gate whitelist (https://github.com/happy520ai/unified-ai-system/blob/master/docs/real-provider-enablement.md).
2. Virtual keys with periodic token budgets: issue uai- keys with daily/monthly
   windows, per-key RPM, soft-budget alerts, spend attribution, instant
   revocation. Consumers never hold provider keys.
3. Reverse MCP governance: aggregate upstream MCP servers (HTTP + stdio) behind
   one authenticated, audited, allow-listed surface. Any OpenAPI 3 spec becomes
   governed MCP tools (REST→MCP).
4. Exact + semantic response cache on the chat hot path with byte-identical
   SSE replay and per-tenant isolation.
5. Chat-native Prometheus metrics (TTFT histograms, tokens/model, cache hit
   rates) + optional Langfuse export.

Try in 60s, no clone, no key:

  docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.5.0 pnpm gateway demo "Build a small API for my team" --enhance --profile coding

Or point your existing OpenAI SDK at it and keep only the baseURL change.

There's a repeatable 16-attack live security regression (cross-tenant cache
reads, tenant forgery, budget bypass...) that must stay green:
tools/security-attack-regression.mjs.

Repo: https://github.com/happy520ai/unified-ai-system
Docs: https://happy520ai.github.io/unified-ai-system/

Happy to answer anything about the architecture or the honest-boundaries
approach (we document what is NOT production-ready).
```

发帖时机：美东周二–周四 8:00–10:00（HN 高峰）。发后前 2 小时守评论。

## 2) Reddit

**r/LocalLLaMA**（标题）：
`Self-hosted LLM gateway with virtual keys, semantic cache, and reverse MCP governance — everything works credential-free (Apache-2.0)`

正文：复用 HN 正文，开头改为 "Sharing my open-source gateway — local-first by
default (deterministic fake provider), so you can try budgets/caching/MCP
governance before wiring any provider key."

**r/selfhosted**（换角度，标题）：
`Self-hostable AI gateway (Docker, single container) — API keys with budgets, response caching, MCP tool governance`

正文要点：docker-compose 一条命令、127.0.0.1 默认绑定、SQLite/文件存储、
无外部依赖；附 docker run demo。

**r/LLMDevs**（换角度，标题）：
`We open-sourced our LLM gateway's guardrails: budget-exhausted 429s, per-key spend attribution, and a 16-attack security regression`

正文要点：虚拟 key 预算语义、/metrics TTFT、审计哈希链、安全演练脚本。

Reddit 规则提醒：三个 sub 分开发、间隔 ≥1 天、正文带 demo 命令而非纯链接。

## 3) X / Twitter 线程（8 条）

```text
1/ We just open-sourced the gateway layer we wanted for AI products:
   virtual keys with token budgets, exact+semantic response cache, and
   reverse MCP governance. Everything runs credential-free first. 🧵

2/ Fake-provider-first: the default runtime is deterministic and local, so
   budgets, caching, and metrics are fully testable without a single API
   key. Real providers sit behind an explicit three-gate whitelist.

3/ Virtual keys: issue uai- keys with daily/monthly token budgets, per-key
   RPM, soft-budget alerts, spend attribution, instant revocation. Your
   consumers never hold provider keys.

4/ Response cache: tenant-scoped, byte-identical JSON/SSE replay, plus an
   opt-in semantic layer that catches paraphrases. Cache hits still count
   against key budgets — like a real gateway should.

5/ Reverse MCP governance: aggregate upstream MCP servers (HTTP + stdio)
   behind one authenticated, audited, allow-listed surface. And REST→MCP:
   any OpenAPI 3 spec becomes governed MCP tools.

6/ Observability: chat-native Prometheus metrics — TTFT histograms, tokens
   per model, cache hit rates, key rejections — plus optional Langfuse
   export.

7/ Security is a repeatable drill, not a claim: a 16-attack live regression
   (cross-tenant cache reads, tenant forgery, budget bypass, revoked-key
   replay...) must stay green on every change.

8/ Try it in 60 seconds, no clone, no key:
   docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.5.0 pnpm gateway demo
   ⭐ https://github.com/happy520ai/unified-ai-system
```

配图建议：第 1 条带 prompt-enhancement-demo.png；第 4 条建议录一段
asciinema（两次同请求、第二次秒回 + cache_hit 日志）。

## 4) 中文社区

**V2EX（分享创造节点）** 标题：
`开源了一个自托管 AI 网关：虚拟 key + token 预算、语义缓存、反向 MCP 治理`

正文：中文 README 的"网关能力全景"表 + 60 秒 docker 命令 + 诚实边界一节
（V2EX 用户吃"不吹牛"这套）。结尾：`欢迎拍砖，star 是更新的动力。`

**即刻/掘金**：以"为什么我把 AI 网关做成 fake provider 优先"为题写设计
随笔（诚实边界 + 安全回归 16 攻防当卖点），文末附仓库。

## 5) 目录与 awesome 清单提交清单

| 目标 | 动作 | 入口 |
| --- | --- | --- |
| MCP Registry | 已收录（v0.4.9）✅ | registry.modelcontextprotocol.io |
| Smithery | 提交 server（用 server.json + README） | smithery.ai/docs/quickstart |
| Glama MCP 目录 | 提交 | glama.ai/mcp/servers |
| PulseMCP | 提交 | pulsemcp.com |
| mcp.so | 提交 | mcp.so |
| awesome-mcp-servers (punkpeye) | PR 添加一行（README 徽章 + docker 命令即可过审） | github.com/punkpeye/awesome-mcp-servers |
| awesome-ai-gateway 类清单 | 搜 "awesome ai gateway" 逐一 PR | — |
| LibHunt | 等收录或提交 | libhunt.com |
| Codex for Open Source | 已有申请文档 | docs/codex-for-open-source-application.md ✅ |

提交 PR 话术模板：

```text
Added unified-ai-system — a self-hosted AI gateway and governed MCP server.
Notable: virtual keys with token budgets, exact+semantic response cache, and
reverse MCP governance (REST→MCP). Official MCP Registry listed; credential-
free Docker demo in the README.
```

## 6) v0.5.0 Release Notes 草稿（切版本时直接粘贴）

```markdown
## v0.5.0 — The Gateway Release

Self-hosted AI gateway capabilities, all opt-in and credential-free to try:

- **Virtual keys & budgets** — uai- keys with daily/monthly token budget
  windows, per-key RPM limits, soft-budget alerts, spend attribution, and
  instant revocation; enforcement on streaming and non-streaming chat.
- **Response cache (exact + semantic)** — tenant-scoped hot-path caching
  with byte-identical JSON/SSE replay and an opt-in semantic layer.
- **Reverse MCP governance** — aggregate upstream MCP servers (HTTP/stdio)
  with tool ACLs, audits, and size caps; REST→MCP turns any OpenAPI 3 spec
  into governed MCP tools.
- **Observability** — ai_gateway_* Prometheus metrics (TTFT histogram,
  tokens/model, cache hits, key rejections) + opt-in Langfuse export.
- **Native Anthropic streaming** — generateStream consumes upstream SSE
  directly (usage accounting, stop-reason mapping, inactivity timeout).
- **Vector retrieval** — credential-free deterministic embeddings +
  SQLite vector store activate mode:"vector" RAG with tenant isolation.
- **Real-provider enablement runbook** — three-gate whitelist matrix,
  credential-store hardening notes, and a credential-gated CI smoke.
- **Security** — 16-attack live regression added (all defended); enterprise
  auth, tenant isolation, and audit chains verified end-to-end.

Gateway suite: 904 tests passing. Full gates: check / test / check:public /
verify:public-clone all green.
```

## 7) 运营节奏（发帖后）

- 发帖当天：前 2 小时回复所有评论；HN 用主账号答架构问题。
- 每收 10 star：在 issue #106（usage report）下公开感谢里程碑。
- 每周跑 `pnpm growth:*` 既有脚本记录趋势；连续 2 周在 README Star History 可见增长叙事。
- 下一步内容弹药：录制 3 段 30 秒 asciinema（虚拟 key 预算 429、语义缓存命中、
  OpenAPI→MCP 三行配置），比截图转化率高。
