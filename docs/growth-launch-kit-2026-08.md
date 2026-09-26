# Growth Launch Kit — 2026-08 (v0.5 "Gateway" positioning)

定位升级：从"prompt 增强器"到**可验证、受治理、协议优先的自托管 AI
网关与智能体控制面**。所有文案围绕一个钩子："零凭证首跑 + 明确 Provider
边界 + MCP/A2A 治理"，并明确当前仍是 Public Preview。

一句话（EN）: *Self-hosted AI gateway with virtual keys & token budgets, exact
+ semantic response cache, and reverse MCP governance (any OpenAPI spec →
governed MCP tools) — verify the first path with zero credentials.*

一句话（中）：*自托管 AI 网关：虚拟 key + token 预算、精确/语义双层响应缓存、
反向 MCP 治理（经验证的 OpenAPI operation 变成受治理 MCP 工具）——首次
验证零凭证，真实 Provider 显式启用。*

## 1) Show HN

标题：`Show HN: Self-hosted AI gateway with virtual keys, semantic cache, and reverse MCP governance`

正文（直接粘贴）：

```text
Hi HN, I've been building an open-source, self-hosted AI gateway (Node/TS, Apache-2.0).

The project takes a different angle from model-aggregation-first gateways:

1. Fake-provider-first: the default runtime is a deterministic local provider.
   The first prompt-enhancement and fake-chat path is reproducible with zero
   credentials; virtual keys, caching, and metrics can be evaluated locally,
   while real provider calls stay behind an explicit
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

  docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.8.0 pnpm gateway demo "Build a small API for my team" --enhance --profile coding

Or point your existing OpenAI SDK at it and keep only the baseURL change.

There's a repeatable live security regression (cross-tenant cache reads,
tenant forgery, budget bypass...) that must stay green; use current CI rather
than a copied count as the evidence source:
tools/security-attack-regression.mjs.

Repo: https://github.com/happy520ai/unified-ai-system
Docs: https://happy520ai.github.io/unified-ai-system/

Happy to answer anything about the architecture or the honest-boundaries
approach (we document what is NOT production-ready).
```

发帖时机：美东周二–周四 8:00–10:00（HN 高峰）。发后前 2 小时守评论。

## 2) Reddit

**r/LocalLLaMA**（标题）：
`Self-hosted LLM gateway with virtual keys, semantic cache, and reverse MCP governance — credential-free first run (Apache-2.0)`

正文：复用 HN 正文，开头改为 "Sharing my open-source gateway — local-first by
default (deterministic fake provider), so you can try budgets/caching/MCP
governance before wiring any provider key."

**r/selfhosted**（换角度，标题）：
`Self-hostable AI gateway (Docker, single container) — API keys with budgets, response caching, MCP tool governance`

正文要点：docker-compose 一条命令、127.0.0.1 默认绑定、SQLite/文件存储、
无外部依赖；附 docker run demo。

**r/LLMDevs**（换角度，标题）：
`We open-sourced our LLM gateway's guardrails: budget-exhausted 429s, per-key spend attribution, and a repeatable security regression`

正文要点：虚拟 key 预算语义、/metrics TTFT、审计哈希链、安全演练脚本。

Reddit 规则提醒：三个 sub 分开发、间隔 ≥1 天、正文带 demo 命令而非纯链接。

## 3) X / Twitter 线程（8 条）

```text
1/ We just open-sourced the gateway layer we wanted for AI products:
   virtual keys with token budgets, exact+semantic response cache, and
   reverse MCP governance. The first verified path is credential-free. 🧵

2/ Fake-provider-first: the default runtime is deterministic and local, so
   the prompt-enhancement and fake-chat path is testable without an API key.
   Budgets, caching, and metrics can be evaluated locally; real providers sit
   behind an explicit three-gate whitelist.

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

7/ Security is a repeatable drill, not a certification: cross-tenant reads,
   tenant forgery, budget bypass, revoked-key replay, and other bounded cases
   must stay green in current CI.

8/ Try it in 60 seconds, no clone, no key:
   docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.8.0 pnpm gateway demo
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
随笔（诚实边界 + 可复现安全回归当卖点），文末附仓库。

## 5) 目录与 awesome 清单提交清单

| 目标 | 动作 | 入口 |
| --- | --- | --- |
| MCP Registry | 已收录（最新 0.8.0，2026-09-26 现读）✅ | registry.modelcontextprotocol.io |
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

## 6) v0.5.0 已发布说明快照

以下数字属于 v0.5.0 发布时快照，不应替代当前源码或最新 CI 证据。

```markdown
## v0.5.0 — The Gateway Release

Self-hosted AI gateway capabilities with a credential-free first path; real
provider execution remains explicitly opt-in:

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

## 7) 只有仓库所有者能做的四件事（2026-09-26 现读证据）

v0.8.0 的对外文案（Show HN / r/LocalLLaMA / X / dev.to）已收在
[`growth-launch-kit-2026-09.md`](growth-launch-kit-2026-09.md)，本节只留「只有你能做」的四条。
同一份文案只保留那一个载体，不要在此文件里再抄一遍。


自动化能读到的部分已全部读完并记账；下面四条卡在"身份/账号"上，不是卡在信息上。每条都给了
判据和回滚，照抄即可。

1. **GitHub 社交预览图**：仓库当前上传的那张仍写着 9 个工具。替换文件已经在版本库里：
   `docs/assets/social-preview.png`（1280×640，15 个工具，与
   `raw.githubusercontent.com` / Pages 上的字节一致，sha256 前缀 `cfae7a47dd37`）。
   路径：仓库 → Settings → 右侧 Social preview → Upload image。GitHub 没有开放这个上传的
   API，所以只能手点。回滚：把弹窗里显示的当前图另存后再替换。
2. **e2b-dev/awesome-ai-agents#1401 只卡在 CLA**：cla-bot 在 2026-08-15 与 2026-09-25 两次
   提示 `@happy520ai` 未签署。两步：在 https://e2b.dev/docs/cla 签署，然后在该 PR 下评论
   `@cla-bot check`。清单合并后条目由他们维护，我方不需再动。
3. **awesome-selfhosted 要到 2026-11-30 之后手工提交**：资格按"首个非 draft release
   （v0.1.0，2026-07-30）+ 4 个月"算，约 2026-11-30 起可提。该仓库 CONTRIBUTING 明确禁止由
   agent 创建或代写提交（含勾选人工确认框），所以这一步必须你本人做。
4. **mcpmarket.com 的条目把工具数写成"八个"**（现读原文两处：`providing eight dedicated tools for
   managing gateway health`、`Codex MCP server with eight integrated tools`），同时它的 registry
   链接停在 `versions/0.3.2`（现读最新 0.8.0）。发布面是 15 个工具。自助入口实测没有：`/submit`
   会回复"该 server 已收录"，列表页只有页脚 contact 与 `support@mcpmarket.com`。所以走邮件，
   正文请对方做两件事——把生成摘要里的 eight 改成 fifteen、把 registry 链接指到 0.8.0。

   （订正记录：本节第一版写的是"列表文本不含工具数"，那是我的检索式漏了 `eight` 这个词造成的假阴性，
   不是页面真的干净。查数字时必须覆盖 one..twenty 全词表，否则"没找到"只反映模式窄。）

两条已经用反证试死、不必再投入的方向：**GitHub 仓库搜索**和**官方 MCP Registry 搜索**都只按
name/星数排序与匹配（Registry 的搜索命中集 124/124、161/161 全部只在 `name` 字段命中，条目
keywords 为空），所以改描述、改 keywords 都不会改变它们的可发现性。星数本身才是那两处的入口。
