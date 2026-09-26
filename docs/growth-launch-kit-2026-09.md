# Launch kit for v0.8.0 — owner-voiced drafts

Every factual claim below has a reading that was verified in this session or is
reproducible by the reader in one command. Nothing here is written as if it came
from a third party.

Status: v0.8.0 is published - tag `v0.8.0`, Release published 2026-09-25T16:44:51Z, and
`0.8.0` is the newest version in the Official MCP Registry (all three read again on
2026-09-26). What still expires is the observable copy: star count, the "132 commits since
0.7.0" figure, open-PR counts and dates. Re-run `## Verify before posting` against the live
remote immediately before posting, and rewrite any number that moved.

---

## 0. Owner-only, before any of the above

**GitHub's repo share card is still the nine-tool era.** When someone pastes
`github.com/happy520ai/unified-ai-system` into X, Slack, Discord or LinkedIn, the
preview image is the one uploaded under repository settings, not
`docs/assets/social-preview.png`. The uploaded copy reads "OPEN-SOURCE MCP GATEWAY",
"Natural language in. Structured, reviewable prompts out." and **9 governed tools**.
Every page and the published image now say 15, so this is the last surface where the
first impression a stranger gets contradicts the repository.

There is no REST endpoint for it — the upload only exists behind the settings form,
so this one cannot be done from here.

1. Open <https://github.com/happy520ai/unified-ai-system/settings> (General tab).
2. Under **Social preview**, click *Edit* → *Upload cover image*.
3. Pick `docs/assets/social-preview.png` from the repository (1280×640, sha256 prefix
   `cfae7a47dd37`, re-verified 2026-09-26 as byte-identical to what
   `raw.githubusercontent.com` serves and to the site's own `og:image`, so the share card
   and the page agree).
4. Click **Save**.
5. Rollback: the settings form shows the currently-uploaded card before you replace it -
   save that image first, and uploading it again restores the previous state exactly. The
   copy in place on 2026-09-26 was 1280×640, 46,664 bytes, sha256 prefix `4338967b8bc3`;
   keep that as the fingerprint of what you replaced.

Verify after saving, with a fresh read rather than the settings page:

```bash
curl -s https://github.com/happy520ai/unified-ai-system \
  | grep -oE '<meta property="og:image" content="[^"]*"'
# then fetch that URL and confirm the bytes match the NEW file
```

**Also owner-only:** signing the e2b CLA on `e2b-dev/awesome-ai-agents#1401` and then
commenting `@cla-bot check` (that door is blocked on nothing else), and the accounts
for sections 1-4.

### 0b. Ask MCP Market to refresh its summary (email, ~20 seconds)

`https://mcpmarket.com/server/unified-ai-system` is live and free to keep — the site
claims 1M+ monthly visitors — but its description was generated when the server had
**eight** tools and says so twice: "providing eight dedicated tools for managing
gateway health" and "Codex MCP server with eight integrated tools". The published
surface is fifteen. There is no self-serve edit: `/submit` replies that the server is
already listed, and the only control on the page is `support@mcpmarket.com`.

Send to **support@mcpmarket.com**:

> Subject: Refresh the generated summary for /server/unified-ai-system (8 → 15 tools)
>
> Hello,
>
> I'm the author of the MCP server listed at
> https://mcpmarket.com/server/unified-ai-system . Your summary for it still describes
> **eight** tools in two places ("providing eight dedicated tools…", "Codex MCP server
> with eight integrated tools"). The current release ships **fifteen**, and the count
> is machine-checkable: `https://github.com/happy520ai/unified-ai-system` freezes the
> roster as `MCP_TOOL_NAMES` in `packages/mcp-server/src/server.js`, and the entry is
> also in the Official MCP Registry as `io.github.happy520ai/unified-ai-system`
> (version 0.8.0).
>
> Could you regenerate or correct that listing? Happy to supply anything you need.
> The "2 GitHub stars" figure on the page is also stale (currently 7), but that one I
> expect your crawler to refresh on its own.
>
> Thanks — happy520ai

Verification after they act: open the page and confirm the word "eight" is gone —
`document.body.innerText.includes('eight')` should be false.

---

## 1. Show HN (news.ycombinator.com)

**Title (73 chars):**
`Show HN: A self-hosted AI gateway you can evaluate with zero API keys`

**URL:** `https://github.com/happy520ai/unified-ai-system`

**First comment (post it yourself immediately; HN threads without author context
get read as drive-by marketing):**

> Author here. The design bet in one sentence: the thing that makes an AI gateway
> worth self-hosting is not routing, it is the accountability layer around routing.
>
> What it does: OpenAI- and Anthropic-compatible chat APIs in front of
> OpenAI/Anthropic/Gemini, plus virtual keys with per-key token budgets and rate
> limits, exact + semantic response caching, circuit breaking, an append-only
> audit chain, Prometheus metrics and optional Langfuse export. It is also an MCP
> server, and it does reverse MCP governance: upstream MCP servers (stdio and
> HTTP) and any OpenAPI 3 spec get exposed as allow-listed, audited MCP tools.
>
> The reason I built it the way I did, and the part I'd most want skeptical
> readers to poke at: **the default provider is a deterministic local fake
> provider.** You can exercise the entire surface — tool discovery, every tool
> call, streaming, budget enforcement — without supplying a key and without
> anything leaving your machine. Concretely:
>
> ```
> docker run --rm -i ghcr.io/happy520ai/unified-ai-system/mcp-server:0.8.0
> ```
>
> v0.8.0 (today) is a big release, 132 commits since 0.7.0. The parts I'd single
> out: an Agent Governance control plane (deterministic permission lifecycle,
> per-call tool-proxy enforcement, cascade revocation; off unless
> `AI_GATEWAY_AGENT_GOVERNANCE_ENABLED=true`); governed Workforce code delivery
> that runs in an owned worktree and verifies in a read-only, network-disabled
> container and never commits/merges/deploys; and a Windows-native proof-of-
> possession replay guard bound to a protected authority service.
>
> Honest limitations, because I'd rather you get these from me:
> - This is a small solo-maintained public preview - single-digit stars, no paid
>   promotion. It is not battle-tested
>   at any scale, and I have not run it in production.
> - Single-host only. Multi-instance/PostgreSQL governance profiles are
>   deliberately refused rather than half-supported.
> - The published 0.8.0 container and the current source both expose 15 MCP tools;
>   the v0.7.0 image exposed 12. Both readings are checkable without installing anything:
>   `node tools/verify-image-roster.mjs 0.8.0` pulls `MCP_TOOL_NAMES` straight out of the
>   published layer and verifies every blob against the digest its manifest names, so nobody
>   has to take my word for either number. The README hero, the architecture image and the
>   link-preview card all render 15 too.
> - Native Codex-backed role execution is Windows x64 only.
>
> I will not claim this is better than LiteLLM/Portkey/OpenRouter — they are
> further along on provider breadth and maturity. The difference in posture is
> that governance and audit are the product here, and that you can verify it
> before giving it a credential. Ask me anything; I'll answer the sharp ones
> first.

**Deliberately absent, and why:** no "AGI", no "production-ready", no
"best/first/fastest-growing", no request to upvote, no link to star history. The
repo's own safety rule forbids claiming production readiness or L5 autonomy
without independent evidence, and on HN the ask reads as desperation anyway.

---

## 2. r/LocalLLaMA

**Title:** `I open-sourced a self-hosted AI gateway + MCP server that you can fully evaluate with zero API keys (Apache-2.0)`

**Body:**

> Subreddit rules first: this is my own project, Apache-2.0, self-hosted, local
> first. No hosted service, no signup, nothing phones home. If it isn't allowed,
> mods please remove rather than downvote.
>
> **The bit I think this community will care about:** the default provider is a
> deterministic *fake* provider. That means you can verify every feature — tool
> discovery, streaming, per-key token budgets, cache behaviour, the audit chain —
> before you spend a token or paste a key.
>
> ```
> docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.8.0 \
>   pnpm gateway demo "Build a small API for my team" --enhance --profile coding
> ```
>
> What you get: OpenAI/Anthropic-compatible endpoints over OpenAI, Anthropic,
> Gemini, plus virtual keys with budgets and rate limits, exact + semantic
> response cache, circuit breaking, Prometheus metrics, optional Langfuse, and an
> MCP server that can also wrap *other* MCP servers and any OpenAPI 3 spec behind
> allow-lists and audit.
>
> v0.8.0 today adds an agent governance control plane (permission lifecycle,
> per-call tool proxy, cascade revocation, off by default) and governed code
> delivery that verifies inside a network-disabled read-only container.
>
> Limitations, plainly: solo maintainer, single-host only, small community, no
> track record in production. Local model users: it fronts any
> OpenAI-compatible endpoint, so llama.cpp/Ollama/vLLM work as providers — the
> zero-key mode is separate from that, it's for evaluating the gateway itself.
>
> Repo: https://github.com/happy520ai/unified-ai-system

**Note:** r/LocalLLaMA has a self-promotion norm that wants the *local-model
angle* stated, hence the explicit Ollama/llama.cpp/vLLM sentence. Do not post a
second Reddit self-promotion the same day.

---

## 3. X / Twitter thread (5 posts, author voice)

1. I keep meeting people who can't evaluate an AI gateway without first handing it an API key and trusting it. So the first design rule in ours was: the default provider is a deterministic fake one. Zero keys, nothing leaves the box, every feature still exercisable. Thread on how it works 🧵
2. `docker run --rm -i ghcr.io/happy520ai/unified-ai-system/mcp-server:0.8.0` — that's the whole install. It's an MCP server. Tool discovery + all tool calls run against the fake provider.
3. What the gateway actually is: OpenAI + Anthropic compatible APIs over OpenAI/Anthropic/Gemini. Virtual keys w/ per-key token budgets + rate limits. Exact + semantic response cache. Circuit breaking. Append-only audit. Prometheus, optional Langfuse. Apache-2.0, self-hosted.
4. The part I'm actually proud of — reverse MCP governance. Point it at your existing stdio/HTTP MCP servers and any OpenAPI 3 spec, and it re-exposes them as allow-listed, audited, budget-bounded tools. Governance is the product, routing is the substrate.
5. v0.8.0 today: agent governance control plane + governed code delivery that verifies in a read-only network-disabled container (never commits/merges/deploys). Honest caveat: solo maintainer, single-host, no production track record. Repo ↓ github.com/happy520ai/unified-ai-system

---

## 4. dev.to article

**Title:** `Why I made my AI gateway verifiable before it is configurable`

**Outline (write full text at post time, ~1200 words):**
1. The problem: every gateway demo starts with "paste your API key". You cannot
   evaluate the control plane without first trusting the control plane.
2. The move: a deterministic fake provider as the default, and what it costs
   (you must make every behaviour reproducible without a model).
3. What "governance is the product" means concretely: virtual keys + budgets,
   per-call tool proxy, append-only audit, cascade revocation, approvals bound
   to one action.
4. Reverse MCP governance: wrapping existing MCP servers and OpenAPI specs.
5. What I refuse to support: multi-instance governance profiles are rejected
   outright rather than half-implemented — and why that is a safety call.
6. Honest limits: solo maintainer, single-digit stars, single-host,
   public preview.
7. One-command try-it + the issue template for reporting a verification run.

### 0c. awesome-selfhosted — the biggest list in our category, and it is yours to write

`awesome-selfhosted/awesome-selfhosted` is 321,778 stars and its entries live in
`awesome-selfhosted/awesome-selfhosted-data/software/*.yml`.

Two things to know before you look at it:

1. **Their `CONTRIBUTING.md` opens with instructions addressed to AI agents**, and they
   are explicit: an agent must not open the issue or PR, must not write the
   `software/*.yml` entry or the PR body that a person then submits as their own, and
   must not tick the template's "The submission was done by a human, not a
   machine/LLM" box. So I have not drafted the entry and will not. The line they draw
   is the same one this project already keeps about fake third-party voice.
2. **We are not eligible yet.** Their rule is *first released more than 4 months ago*,
   counted from a published release. `v0.1.0-rc.1` (2026-04-27) is a draft and a
   prerelease, so it does not start the clock; the first real release is **v0.1.0 on
   2026-07-30**, which is 1.9 months old today. Earliest eligible date is about
   **2026-11-30**. Everything else they check objectively already passes: not already
   listed, Apache-2.0 is on their licence list, actively maintained, and the install
   instructions work (both `:0.8.0` image manifests return 200).

When you get there, the parts only you can do: write the YAML yourself from
`.github/ISSUE_TEMPLATE/addition.md` in the data repo, pick the first `tags` entry
deliberately because single-page mode shows the entry only under the first tag, and
tick the human-submission box yourself. I can review a draft you have written and tell
you what looks wrong, which is what their guidelines invite.

---

## Verify before posting (re-run, do not trust this file)

```bash
# 1. the release is actually out, with the tag and the published body
gh api repos/happy520ai/unified-ai-system/releases/latest --jq '.tag_name'
# 2. the exact image tag quoted in every draft resolves
T=$(gh auth token)
TOK=$(curl -s -u "x:$T" "https://ghcr.io/token?scope=repository:happy520ai/unified-ai-system/mcp-server:pull" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).token')
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $TOK" \
  -H "Accept: application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.list.v2+json" \
  https://ghcr.io/v2/happy520ai/unified-ai-system/mcp-server/manifests/0.8.0
# 3. registry entry for the published version (use the exact version endpoint;
#    the global `search` list is oldest-first, so reading its first row shows 0.3.1)
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://registry.modelcontextprotocol.io/v0.1/servers/io.github.happy520ai%2Funified-ai-system/versions/0.8.0"
# 4. the tool count the drafts quote, taken from the running server rather than
#    from the source array - this is what a reader's host will actually see.
#    Drive MCP over stdio: initialize -> notifications/initialized -> tools/list
AI_GATEWAY_PROVIDER_MODE=fake AI_GATEWAY_REAL_PROVIDER_ENABLED=false \
  node packages/mcp-server/src/index.js
```

Readings taken 2026-09-25 on this tree, for comparison - re-run them, they age:

- live `tools/list` on `packages/mcp-server` v0.8.0: **15 tools**, the same set as
  `MCP_TOOL_NAMES`, nothing declared-but-unserved and nothing served-but-undeclared.
- `pnpm gateway demo "Build a small API for my team" --enhance --profile coding`:
  exit 0 in **13.3 s**; with `--evidence` it exits 0 in **14.0 s** and prints
  `mode=fake`, `providerCalled=false`, `credentialRequired=false`, `deterministic=true`.
- Caveat for any wording that asks a reader to count: the live server returns the
  tools in registration order, which is **not** the declaration order, so say
  "confirm these fifteen names", never "the first fifteen in this order".


If any of those is not 200 / `v0.8.0`, do not post the drafts: the copy quotes
the 0.8.0 tag and a reader's first action is to run it.

## Posting discipline

- One submission per community. Never re-post the same link to chase a wave of
  traffic; that is spam and it gets the account, not the post, removed.
- Reply to criticism in-thread, including "this is bloated / unnecessary".
- Do not use `tools/star-growth-publish-kit.mjs` output. It is written in a fake
  first-person-third-party voice ("I verified Unified AI System's...") and
  posting it from the owner's account is astroturfing.
- Do not ask anyone to star. Stars are the lagging indicator here; the posts are
  the leading one.

---

## 渠道实测状态（2026-09-26 现读，用于决定你下一步该花哪 20 分钟）

| 面 | 读数 | 判据来源 |
| --- | --- | --- |
| 星数 | **7**（与昨日快照差 0），fork 2，subscriber 0 | `gh api repos/...` |
| 记账门 | 39 扇（33 PR + 6 提交型 issue），完备守卫读 Complete | `node tools/star-growth-check.mjs check` |
| 队列活度 | 压着我们开放 PR 的 19 个仓库：**ALIVE=10 / STALE=3 / DEAD_QUEUE=6** | `node tools/star-growth-check.mjs queues` |
| 上游 README 收录 | 5 处可见 / 28 处未见 / 0 处读不到（第 6 个已合并的门在数据文件里，不在 README） | 同上 |
| 人类参与 | 最近 100 条评论作者分布：`happy520ai=88`、`dependabot[bot]=11`、**其他真人 1 人 1 条** | `issues/comments` 分组计数 |
| 使用回报表 | `usage-verification-report.yml` 存在且 URL 可解析，但**被用过的次数 0** | `.github/ISSUE_TEMPLATE/` + label 查询 |
| 贡献台 | `good first issue` 开 2 个、`help wanted` 开 3 个（新加 #166 站点安全页、#167 soak 分母修复，都带验收清单） | label 查询 |

**三条结论，都不靠感觉：**

1. **清单渠道接近饱和，且已按活度过滤。** 又换两种检索式（`mcp gateway in:name` / `awesome agentic in:name` 等）扫到 8 个 ALIVE 候选，逐个读进去：一个是**产品仓**（README 没有 intake 语）、一个是**学习路线图**（Stage 0–8 课程，不收工具）。⇒ 剩下的门主要靠等维护人，不靠再铺新门。
   ⚠ 附带一条仪器边界：筛查脚本报 `intake=yes` 只表示 README 里出现过 "contributing" 一词，**不等于收条目**；判定必须落到小节正文。
2. **合并 ≠ 星数。** 已有 6 处收录，星数一次没因此动过。所以本文件里所有"已提交/已合并"的账都只当管道健康度看，别当成效。
3. **仍然只有你能撬动的两件事没变**（含步骤与回滚在 `growth-launch-kit-2026-08.md` §7）：
   ① 用你自己账号发 HN/Reddit/X（文案在第 1–4 节，发帖前按该节要求重跑现读）；
   ② 上传 15 工具版社交预览图（`docs/assets/social-preview.png`，与站点 `og:image` 字节一致）。
   第三件是被动等：mcpservers.org 审核约 2026-10-09 见结果；awesome-selfhosted 约 2026-11-30 才够龄且必须你本人提。

**如果这周只做一件事**：发 HN。理由就是上表——其他所有面要么在等人（清单），要么已经证明对星数没有可测影响（收录），而一次性外部曝光目前没有别的路径能替代。
