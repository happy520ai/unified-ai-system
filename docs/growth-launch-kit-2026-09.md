# Launch kit for v0.8.0 — owner-voiced drafts

Every factual claim below has a reading that was verified in this session or is
reproducible by the reader in one command. Nothing here is written as if it came
from a third party.

Status: v0.8.0 is published - tag `v0.8.0`, Release published 2026-09-25T16:44:51Z, and
`0.8.0` is the newest version in the Official MCP Registry (all three read again on
2026-09-26). What still expires is the observable copy: star count, open-PR counts and
dates. The release size no longer belongs to that list - it is stated as "133 commits
between the v0.7.0 and v0.8.0 tags", which no future merge can invalidate. Re-run
`## Verify before posting` against the live
remote immediately before posting, and rewrite any number that moved.

---

## If you only have 15 minutes: the order to do these in

Everything in this file that I could do is done. The list below is the remainder, in
the order that buys the most per minute — measured, not guessed: **fourteen listings are now
carried by an upstream README (read 2026-09-27) and the star count is still 7**, so listings are
pipe maintenance, and the only surfaces with a ceiling above ~20 stars are the ones that need
your identity.

The order changed today. Uploading the share card used to lead this list because it was recorded
as fixing a stale "9 tools" card; that premise was measured and is void (§0 explains), so a
branding step cannot spend the first two minutes of fifteen.

| # | Action | Where | Why here in the order |
| --- | --- | --- | --- |
| 1 | Post Show HN (§1) | `https://news.ycombinator.com/submit` | Largest single-event ceiling available. Needs your login; the copy is ready and its reads expire fast, so re-run `## Verify before posting` first. Read §5 before you submit - the replies in the first two hours are the part that was missing. |
| 2 | Post to one subreddit (§2) | r/LocalLLaMA (or r/selfhosted with the §2 wording swap) | Same shape as HN, slower burn, and the self-hosters there are the audience that actually installs. One post, not a cross-post sweep. |
| 3 | Sign up and file the news item (§0d) | `https://changelog.com/news/submit` | Three fields. Their page says submitting your own work is encouraged, so this is a legitimate door rather than a favour. |
| 4 | Set the Glama build target so a grade exists (§0h) | `https://glama.ai/mcp/servers/happy520ai/unified-ai-system/admin` → Docker builds | Different in kind from the fourteen carried listings above: the maintainer of the biggest MCP list has already reviewed our entry and named exactly one remaining condition ("any grade is fine"), so this is a queued merge rather than a cold submission. ~5 minutes, and only you can reach that dashboard. |
| 5 | Send one message to selfh.st (§0e) | `selfhst@fosstodon.org` | The closest audience of the whole list. No form exists; it is a message. |
| 6 | Click the checkbox and fill the form (§0f) | `https://openalternative.co/submit` | I am not solving a machine-refusal challenge for you; their GitHub list (6,747★) is generated from this one submission. |
| 7 | Paste one of the three data articles (§4b, §4c or §4d) | dev.to draft → publish | Lowest cost per unit of reach in this file, and the only one that does not ask a reader to evaluate our product. §4c and §4d are the two freshest (both written 2026-09-27, after the header and cache-hint measurements); each of the three is built around a mistake or a small number rather than a claim, which is the kind of post people forward. All three already carry the agent disclosure and none asks for a star. Re-run `## Verify before posting` first: the numbers are dated readings, and a stale one in a data post is worse than no post. |
| 8 | Optional: upload the share card (§0) | `https://github.com/happy520ai/unified-ai-system/settings` → Social preview → `docs/assets/social-preview.png` | Now branding rather than a fix. Measured today: the card GitHub serves is its default template - repo name, current description, live counters - and **shows no tool count at all**, so nothing wrong is being shared while it stays unset. Do it if you want the branded card in front of every link; do not do it instead of 1-7. |

Two of these (1 and 2) are worth the time even if nothing else is. If you do only one
thing this week, do #1 — that is the conclusion the data on every other channel
supports, not a preference.

There are now also **§4b, §4c and §4d - three data posts that ask nothing of the reader**. They
rest on nine surveys of public MCP servers, counted as of 2026-09-27 by `ls tools/survey-mcp-*.mjs`,
so the number is re-checkable in one command rather than trusted: our own server is put through the same
questions as everyone else's. These are the only copy in this file that can be pasted into a technical
thread without pitching, so if you have five spare minutes after the list above, use whichever of the
three matches the venue - §4c and §4d are the newest and each is built around a mistake, which travels
better than a table. Re-run the scripts named at the end of the post you pick, or keep the
"as of 2026-09-27" framing: a stale dataset about a moving ecosystem is worse than none.

---

## 0. Owner-only, before any of the above

**Corrected 2026-09-27: this section used to say "GitHub's repo share card is still the nine-tool
era". That claim is no longer supported by what is actually served, and it is the reason this item
moved from first to last in the 15-minute list.**

What was measured: `https://opengraph.githubassets.com/1/happy520ai/unified-ai-system` and
`.../latest/happy520ai/unified-ai-system` return **byte-identical 57,981-byte PNGs**, and the image
is GitHub's **default template** - repository name, the current description, live counters (2
contributors / 14 issues / 7 discussions / 7 stars / 2 forks) and the language colour bar along the
bottom. **It contains no tool count at all.** The colour bar is the structural tell: a custom
social image replaces that whole graphic, so its presence means the card being served is not a
custom upload.

What that does and does not prove: it proves the card a stranger sees today does not contradict the
repository. It does **not** prove no image was ever uploaded - I cannot see the settings form, and
only two cache keys were sampled. So the earlier "9 governed tools" note may have been a true
reading of the settings thumbnail at a time when GitHub served something else, and it is now
either stale or superseded. Either way, the observable surface is clean.

What remains here is therefore **branding, not a fix**. When someone pastes
`github.com/happy520ai/unified-ai-system` into X, Slack, Discord or LinkedIn they get GitHub's
plain default card; uploading `docs/assets/social-preview.png` replaces it with the designed one.
That is worth doing before a launch that generates shares, and it is not worth spending the first
two minutes of fifteen on.

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

## Demo links a post can carry

Every post below links the repository. A link that shows the product in one
click is worth more to a stranger than a link that asks for install faith, and
the Prompt Lab runs entirely in their browser: no account, no key, no provider
call, and the status line reads "Generated locally - provider call: none".

The format is `#enhance?prompt=&profile=&language=` with
`profile` one of `auto|general|coding|analysis|writing|research` and
`language` one of `auto|zh-CN|en`. An unknown value is ignored rather than
applied, so a mistyped link degrades to the previous selection instead of
breaking.

- **coding · en** — https://happy520ai.github.io/unified-ai-system/#enhance?prompt=Add+retry+with+exponential+backoff+to+this+fetch+wrapper&profile=coding&language=en
  (verified in a browser today)
- **general · zh-CN** — https://happy520ai.github.io/unified-ai-system/#enhance?prompt=%E5%B8%AE%E6%88%91%E6%8A%8A%E8%BF%99%E6%AE%B5%E9%9C%80%E6%B1%82%E6%95%B4%E7%90%86%E6%88%90%E7%BB%99+agent+%E7%9A%84%E4%BB%BB%E5%8A%A1%E8%AF%B4%E6%98%8E&profile=general&language=zh-CN
  (verified in a browser today)
- **analysis · en** — https://happy520ai.github.io/unified-ai-system/#enhance?prompt=Compare+these+three+vector+databases+for+a+5M-row+workload&profile=analysis&language=en
  (same contract, profile taken from the lab select)
- **writing · en** — https://happy520ai.github.io/unified-ai-system/#enhance?prompt=Turn+these+bullet+points+into+a+release+note+for+self-hosters&profile=writing&language=en
  (same contract, profile taken from the lab select)
- **research · en** — https://happy520ai.github.io/unified-ai-system/#enhance?prompt=What+evidence+would+confirm+or+refute+that+local+prompt+enhancement+improves+agent+output%3F&profile=research&language=en
  (same contract, profile taken from the lab select)
- **coding · en** — https://happy520ai.github.io/unified-ai-system/#enhance?prompt=Refactor+this+400-line+ESM+module+into+files+under+200+lines+without+changing+behaviour&profile=coding&language=en
  (same contract, profile taken from the lab select)

The two marked verified were re-read in a browser today: the lab filled, the
structured prompt rendered, and the status line showed the local generation with
no provider call. The others use the same parameters, taken from the lab's own
option list, and were not each clicked.

Two things changed in the site so these links behave: the lab previously read
the hash only on page load, so a second link clicked in an open tab kept showing
the first prompt - it now handles `hashchange` - and the script is loaded with a
versioned query (`site.js?v=prompt-lab-9`), because deploying the fix while the
pages still requested the cached copy meant it was live on the server and absent
from the running page. If you touch `docs/site.js` again, bump that token in both
homepages or readers keep the old script.

**When a post needs a credibility link rather than an install link, use:**
https://happy520ai.github.io/unified-ai-system/mcp-ecosystem-measurements.html — five anonymous
surveys of 40 servers advertised in the official MCP registry (does `tools/list` paginate, will a
server agree to a protocol version that does not exist, does an issued session id have to come back,
does anyone implement `server/discover` yet, and how much server-written prose reaches a prompt),
each with its denominator, its sample bias and the script that produced it named on the page. It is
in `docs/sitemap.xml` and `docs/indexnow.json`, and `pnpm check:public` fails if those two ever
disagree, so it cannot quietly become an un-notified orphan.

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
> limits, exact + lexical-approximate response caching, circuit breaking, an append-only
> audit chain, Prometheus metrics and optional Langfuse export. It is also an MCP
> server, and it does reverse MCP governance: upstream MCP servers (stdio and
> HTTP) and the OpenAPI 3 operations whose semantics are unambiguous get exposed as allow-listed, audited MCP tools.
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
> v0.8.0 (today) is a big release - 133 commits between the v0.7.0 and v0.8.0 tags
> (`git rev-list --count v0.7.0..v0.8.0`, so the figure cannot go stale). The parts I'd single
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
>   has to take my word for either number. That command is a script in the repository, so run it
>   from a clone; without one, the same reading is published at
>   https://happy520ai.github.io/unified-ai-system/verify-mcp-docker-image.html. The README
>   hero, the architecture image and the link-preview card all render 15 too.
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
> Gemini, plus virtual keys with budgets and rate limits, exact + lexical-approximate
> response cache, circuit breaking, Prometheus metrics, optional Langfuse, and an
> MCP server that can also wrap *other* MCP servers and the operations an OpenAPI 3 document defines unambiguously, behind
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
3. What the gateway actually is: OpenAI + Anthropic compatible APIs over OpenAI/Anthropic/Gemini. Virtual keys w/ per-key token budgets + rate limits. Exact + lexical-approximate response cache (semantic-grade needs an attached embedding endpoint). Circuit breaking. Append-only audit. Prometheus, optional Langfuse. Apache-2.0, self-hosted.
4. The part I'm actually proud of — reverse MCP governance. Point it at your existing stdio/HTTP MCP servers and an OpenAPI 3 document, and it re-exposes them - operation by operation, refusing anything whose semantics it cannot resolve - as allow-listed, audited, budget-bounded tools. Governance is the product, routing is the substrate.
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

## 4b. A data post that is not about the product (ready to paste)

**Why this exists separately:** every other post in this file asks a reader to look at our software.
This one asks them to look at a measurement, and the software appears only as "the scripts are here".
Data posts travel further than product posts, and this is the only asset we have that a stranger can
reproduce in two minutes and disagree with on the merits.

**Title:** `I asked 40 public MCP servers three questions. Two agreed to a protocol version that does not exist.`

**Tags (dev.to):** `mcp`, `ai`, `testing`, `golang`-adjacent — use `apirest` if `mcp` is unavailable.

---

The Model Context Protocol has a handshake, a session header, and a pagination field, and almost
nobody has published how much of that is actually used in the wild. So I asked. Sample: the first 40
servers advertising a `streamable-http` endpoint in the official MCP registry, taken in the registry's
default order on 2026-09-27. Anonymous `initialize`, one `tools/list`, nothing written, no
credentials.

**Question 1: does `tools/list` ever paginate?** 16 of the 40 answered at all — 22 refused an
anonymous handshake, which is the number I keep having to repeat because it is the real denominator.
**0 of the 16 emitted `nextCursor`.** Largest single-page list: 35 tools. So the cursor mechanism the
spec provides is close to unused among servers you can actually reach.

**Question 2: will a server agree to a protocol version that does not exist?** I asked for
`9999-99-99`. Of the 18 that produced a JSON-RPC answer, 14 named a revision they support, 2 rejected it with a
JSON-RPC error over HTTP 400, and **2 answered HTTP 200 with `9999-99-99` echoed back**. Two out of
eighteen is small until you notice what it means: those servers just told a client that they speak a
protocol that has never existed, and the client has no way to know the handshake was decorative.

The detail I liked: seven servers answered `2025-11-25` to the nonsense request while answering
`2025-06-18` to a polite one an hour earlier. The fallback is disclosing the revision the server
actually prefers — the one piece of information you cannot get by behaving correctly.

**Question 3: if a server issues an `MCP-Session-Id`, does it require it back?** 14 of the 16 issue no
session id at all. Two issue one, and **both return HTTP 400 when it is omitted**. Zero issued a token
and then ignored it. The interesting bit is who those two are: both are among the seven that negotiate
upward, and both reply over SSE. Statefulness is not a legacy tail in this sample — it is attached to
the servers adopting newer revisions, which is the opposite of the easy story.

**Question 4: does anyone implement `server/discover` yet?** It is a named RPC in `2026-07-28` — one call
that returns supported versions, capabilities and identity. Of the 16 that answered `initialize`: **1
returns a real result** (`ad.getle/leads`, and it negotiated `2025-06-18`, an older revision than the one
its own method belongs to), 12 answer `-32601 method not found`, 1 answers `-32602 invalid params` — so it
recognises the method and rejected our empty `params` — 1 replies HTTP `404` with no JSON-RPC body at all,
and 1 sends an error object with no `code` field. The practical reading: "did not implement it" is not one
answer here, it is four shapes, and a client that collapses them will be wrong about at least one server —
the `-32602` case in particular has the method and just disagreed about the arguments. Try the call; do
not depend on it.

**Then I ran three of the four against my own server.** It negotiates `2025-06-18` when asked,
serves 15 tools with no cursor (so: I am in the non-paginating majority too), issues no session id,
and substitutes `2025-11-25` rather than echoing the impossible one. That self-test also caught a real
bug in my own project, which is the honest reason the whole exercise was worth an afternoon: my server
prefers a newer revision than my gateway client declares upstream, and the client never read the
answer. Two components of one product disagreed about which protocol they were speaking and nothing
noticed. Filed against myself as an issue, not quietly patched - and on 2026-09-27 the gateway records
what each upstream answered and names it in the tool listing, with a test that fails if my two MCP
client paths drift apart again. Whether a mismatching revision should be refused or just reported is
still undecided on the issue, and I would rather leave that visible than close it quietly.

**Limits, because n matters here:** 16–18 observations, not a population. The sample is alphabetical by
registry identifier at one timestamp, so it over-represents names starting with `a`. Only `initialize`
and `tools/list` were exercised — going further means invoking tools on services that are not mine. No
stdio servers are reachable by this method at all, and they are the majority of what people run. Every
number above is a floor on "what the servers that let me look do", not a claim about the ecosystem.

The three scripts and the write-ups are in
[unified-ai-system/tools](https://github.com/happy520ai/unified-ai-system/tree/master/tools) — run
them against your own server or against the registry and tell me my numbers are wrong; a two-minute
reproduction is the only kind of evidence I trust on this.

---

**Before posting:** re-run all three scripts and update every number, or say "as of 2026-09-27"
explicitly. These decay — servers deploy, and a stale dataset about a moving ecosystem is worse than no
dataset. The self-caught bug paragraph should be replaced with the current status of
[#178](https://github.com/happy520ai/unified-ai-system/issues/178), whatever it is by then.

## 4c. Second data post — the one where the probe nearly lied (ready to paste)

**Why this one exists:** §4b asks a reader to look at other people's servers. This one asks them to look
at a mistake I made measuring them, which is a more useful read and hard to find written up anywhere.
Same disclosure rules as every other post in this file: agent-authored, says so in the post.

**Title:** `I wrote a conformance probe for MCP headers. Its first real finding was about itself.`

**Tags (dev.to):** `mcp`, `testing`, `api`, `security`

---

The Model Context Protocol lets a client name the protocol revision in a header, and lets a server route
a body-less request from `Mcp-Method`. Both exist to make gateways predictable. I went to measure how
many public servers actually behave differently because of them.

Sample: the first 40 `streamable-http` endpoints in the official MCP registry, 2026-09-27, anonymous
JSON-RPC, read-only, no credentials, no tool invocation. 22 of the 40 require OAuth before saying
anything, which is the denominator I keep having to repeat.

**Does anyone enforce the revision header?** Every server that finished the handshake got the same
`tools/list` twice, differing by one header. All 16 served it **with** the header and all 16 served it
**without**. One server negotiated a different revision than requested; naming the revision it had
*declined* still worked. So in this window: nobody enforces it.

**Can a header route a request the body never asked for?** Same trick, body byte-identical, one leg
adding `Mcp-Method: prompts/list`. 16/16 served the body's method. Then I asked the case the header
actually exists for — a body-less GET stream: of the 13 servers whose GET leg answered at all, 0 were
routed by the header, 10 rejected the GET identically either way, and 3 answered GET with
`application/json` rather than a stream.

**The finding that mattered was about my own instrument.** Two servers looked like header effects: the
routed leg returned 409 while the first plain leg had been aborted by my timeout. I was one sentence away
from writing "these servers respond to Mcp-Method". The fix was not cleverer wording, it was a third
leg: repeat the plain request. The repeat plain leg answered **the same 409** — 409 is that server's
steady answer to GET and the header had nothing to do with it.

Two lessons I would rather hand over than rediscover:

1. If a difference comes from two requests sent seconds apart, you have measured ordering, not the
   thing in the header. Repeat the baseline before you attribute anything.
2. The first version of this script also labelled three `application/json` responses with zero events as
   "stream opened". Both errors pointed the flattering direction — they made the survey look like it had
   found more than it found.

Our own gateway did not fare better under the same light: it replays the session id an upstream issues,
and it had been capturing the revision an upstream *names* and reporting it, while never sending it. One
server-issued value was treated as part of the contract and the other as decoration. Worse, an
operator-pinned header was forwarded verbatim, so against an upstream that answers `2024-11-05` our
client could put `2025-06-18` on the wire — the revision that upstream had just declined. Fixed now,
with tests that fail if the one line goes away.

Scripts and full tables, yours to re-run in about two minutes:
https://github.com/happy520ai/unified-ai-system/tree/master/tools — `survey-mcp-protocol-version-header.mjs`,
`survey-mcp-route-headers.mjs`, `survey-mcp-get-stream-headers.mjs`. Written-up numbers:
https://happy520ai.github.io/unified-ai-system/mcp-ecosystem-measurements.html

One window, one ordering, one day. Servers deploy; a re-run is a new measurement, not a regression test.

## 4d. Third data post — the number nobody sent (ready to paste)

**Why this one exists:** §4b and §4c are about what other servers do. This one is about a field we were
ignoring, found by asking a question nobody had published an answer to. It is also the only post in this
file where the punchline is "one in sixteen, so the interesting part was somewhere else" - a claim small
enough to be believable.

**Title:** `I asked 40 MCP servers how long their tool list may be cached. 15 said nothing, 1 said something I wasn't reading.`

**Tags (dev.to):** `mcp`, `api`, `architecture`, `testing`

---

A gateway has to decide how long to keep a cached tool list. The Model Context Protocol lets the server
answer that directly: `ttlMs` and `cacheScope` on a list response. I wanted to know how often anyone
uses them, because a policy designed for a signal nobody sends is just overhead.

Method, and the limits of it: the first 40 `streamable-http` endpoints in the official MCP registry,
registry order, anonymous JSON-RPC, read-only, no tool invocation, no credentials, one window on
2026-09-27. 22 of the 40 require OAuth before they will talk, which is the denominator every one of
these posts has to repeat. The probe records structure only - presence, type, numeric buckets, counts -
and copies no tool names, descriptions or other server-authored text out of the response.

**The answer:** of the 16 servers that returned a tool list, **15 declared neither field** and **1
declared both**: `ttlMs: 300000` and `cacheScope: "private"`.

So the timing lesson is small, and I am going to keep it small: honour the number when it arrives,
clamped to 1 s .. 10 min. The clamp is mine, not the server's, because a declared `0` would turn every
read into a fresh upstream handshake (we measured that handshake at 6.4 s on a quiet machine) and a
declared decade would let one response freeze a tool list indefinitely. A number off the network is an
input to a decision, not the decision. When a server says nothing - 15 of 16 - the behaviour is
unchanged from before, deliberately.

**The part that was worth the exercise is not the timing.** That one server also said
`cacheScope: private`, and we were storing its response in a process-global map keyed by upstream id,
handed to every tenant allowed on that server. Nothing was leaked, and pretending otherwise would be
marketing: the list call takes no caller identity and the upstream request is built from server config,
so the content genuinely is the same for everyone today.

What was wrong is the shape. The cache was built as though sharing were always safe. The first person to
forward a per-caller token, or a header derived from the tenant, into an upstream list call would have
been serving tenant A's tool list to tenant B out of a key neither of them owned - and no code would
have objected, because the assumption was never written down anywhere to object to. Fixing a shape costs
one cache key. Auditing the same shape after that header ships costs a disclosure.

One more thing, because it is the honest part of writing this: the guard I built for this page refused
my own test data mid-write. I had changed a verdict and dropped a row, and it said `sum=3 rows=2`.
That is the entire reason to publish the instrument with the numbers - a bad fixture caught by a tool is
better than a bad page caught by a reader.

Scripts and full tables, re-runnable in about two minutes:
https://github.com/happy520ai/unified-ai-system/tree/master/tools - `survey-mcp-list-cache-hints.mjs`,
`render-mcp-cache-hints-doc.mjs`. Write-up with its blind spots stated:
https://happy520ai.github.io/unified-ai-system/mcp-list-cache-hints.md · tracked as
https://github.com/happy520ai/unified-ai-system/issues/184

If you want the same question answered for your own server: send a `tools/list`, and look at what comes
back besides `tools` and `nextCursor`. Most of the time, in this sample, that answer was nothing.

<sub>Disclosure: this text was drafted by an AI agent working on the project, from a measurement it ran.
The numbers are one dated window, not a general property of the ecosystem.</sub>

---

## 5. The first two hours: the questions that will actually arrive

The Show HN copy closes with "I'll answer the sharp ones", so the sharp ones are what to
prepare. This section exists because an unanswered question in a live thread is not neutral:
every reader who arrives later interprets it as the answer you were avoiding. These are drafts
for shape and links, not lines to paste — say only what is true as of the moment you say it.

Order of operations for the first hour: submit, then immediately post the prepared intro as your
first comment so the thread has one paragraph of context under a bare URL. Then answer the
*sharpest* question first, not the friendliest one, and put at most one link in each reply.

### "Isn't this just another LiteLLM / Portkey / OpenRouter?"

Say what this one is rather than what they are not: one self-hosted surface where an agent can
*act* and be governed, not only forward text. The governed tool surface is fifteen tools today
(health, readiness, governance list/status/describe, workforce, workflow run/health/actions,
knowledge retrieve/readiness, prompt enhancement, chat), plus virtual keys with token budgets,
exact caching with an opt-in lexical-approximate layer, append-only audit, reverse MCP
governance, and generating tools from an existing OpenAPI spec.

If someone names a specific competitor's feature: answer only from something you read that day,
in their own words. "I have not tested theirs, so I will not tell you what they lack" is a
stronger reply than a wrong one, and it is the reply to reach for by default.

### "So you hold my provider keys."

The default needs none. The local fake provider is the credential-free path, and the MCP server
reads exactly two environment variables — `AI_GATEWAY_MCP_URL` and `AI_GATEWAY_MCP_AUTH_TOKEN` —
both optional. Leave them unset and it starts its own loopback gateway with a freshly minted
token. Point it at a remote gateway and it refuses unless the target is https (or loopback over
plain http), the token is at least 32 characters, and that gateway's own health report says it is
running the fake-provider runtime. Link `credential-free-evidence` on the site for the replay.

### "'Agent governance' reads like marketing."

Concede the strongest available ground out loud: per-action Forge approvals are **not**
implemented and fail closed before any effect, and multi-instance governance profiles are
rejected rather than half-built. That is our own documentation's sentence, not a spin. A
maintainer who volunteers the gap in the first hour is the one people believe about the parts
that do work.

### "Prove it runs / is this a screenshot repository?"

`node tools/verify-image-roster.mjs 0.8.0 --json` counts the tool names out of the published
image instead of out of a README, and the drill-evidence page carries the security exercises.
The numbers worth quoting are the ones read the same day: tool count from the image, stars from
the repository page, cold-start latency from a local run.

### "Is any of this landing anywhere but in your own repository?"

Two dated readings, both outside our repository, both checkable by clicking:

- `ljcl/intervals-mcp` issue #91 (filed 2026-09-26) reported that their MCP registry publish
  had no validation before release and no recovery run. The maintainer shipped
  [pull request #123](https://github.com/ljcl/intervals-mcp/pull/123) - 4 files, +164/-23,
  merged to `main` at 2026-09-27T05:13:39Z, which adds a `validate` job that stamps
  `server.json` the way a publish would and runs `mcp-publisher validate` on every PR that
  touches it - then closed #91 as completed. Under 27 hours from report to fix (filed
  2026-09-26T02:34:54Z, merged 2026-09-27T05:13:39Z).
- `happyvertical/smrt` issue #2961 reported that the launcher in their README never answers
  `initialize` while `node dist/index.js` answers instantly. Their maintainer claimed it with
  an agent lease on branch `codex/2961-lean-mcp` at 2026-09-27T05:48:47Z and the work is
  active. Not fixed yet, and we are not counting it until it merges.

> Two audits have gone into other people's MCP servers so far. One is fixed upstream and
> merged; the other is claimed by their maintainer and still open. Nobody should read that as
> two out of two, and this line says which is which.

### "It sat there for eight seconds before it answered."

Yes, and it is filed publicly: issue #168 measures `initialize` at 6.4-8.9 s across 23 cold boots on one machine and lists every run.
The measurement itself is a page now, not a claim - five consecutive runs on 2026-09-27 answered
between 7,630 ms and 8,461 ms, the complete tool list arrived 3-7 ms after that, and the first run
was the slowest, so there is no cold-cache excuse to reach for. Paste the reply, not a defence:

> Yes, and we measured it instead of waiting for someone to report it: 23 cold boots on one machine
> answered `initialize` between 6.4 and 8.9 seconds. We restored the pre-cut commit and re-timed it to
> check whether a code change explained the spread between batches - it did not, and we are not claiming
> startup got faster - with the full tool list arriving 3-7 ms after that, so the wait is process boot,
> not tool work. It is open as #168, with the method and the limits of the
> measurement on https://happy520ai.github.io/unified-ai-system/mcp-startup-timeouts.html

For a Chinese venue, the same reply in Chinese, with the same numbers and the same page's Chinese twin:

> 是的，而且我们是自己先量了，而不是等别人来报告：同一台机器 23 次冷启动实测，`initialize` 在 6.4 到 8.9 秒之间应答
> （我们把削减前的提交还原回去重跑，想确认批次之间的差距是不是代码变动造成的——不是，所以本页不声称启动变快了），
> 完整工具清单只在其后 3-7 毫秒到达——所以这段等待是进程启动，不是工具枚举。问题公开记在 #168，测量方法
> 和这条测量的边界都在 https://happy520ai.github.io/unified-ai-system/mcp-startup-timeouts.zh-CN.html

If the visitor's version of this is "it never answered at all", do not treat that as a
different complaint - it is the same one further along. Measured: with eight CPU burners running,
three of three repeats got no `initialize` response inside 45 s; kill the load and the same build
answers again at 6.6 s. So the honest reply is not "your machine is busy", it is that we have a
fragile handshake and a 30 s budget that is a hard-coded literal with no configuration path, both
tracked in #168. Say that, then say the reproduction is two commands.

Do not defend it as configuration. A named, measured, self-filed bug converts better than a
smoothing answer, and this is the one question where a prospect is quietly deciding whether you
know your own software.

### "Why no npm package yet?"

Because publishing it is three packages deep and that work is open as #170 with both routes
specified. The reason `npx` appears nowhere in the README is deliberate: an install command that
404s costs more than no install command.

### "One maintainer? What happens when you stop?"

Solo, single-digit stars, single-host, Public Preview — the copy already says so and the replies
should too. What is also true: questions are answered the same day, there is a volunteer starting
the Helm chart in #113, and #175, #176 and #177 are open for anyone who wants a first contribution
with a reproduction already written out - #174 came from the same reading and was fixed the same week.

### "Can I put this on the public internet?"

The supported boundary is your own network. Apache-2.0 permits any commercial use; that is a
license statement, not a hardening claim, and production-readiness is explicitly not being
claimed here. If someone asks about multi-tenant or internet-facing setups, say it has not been
tested that way rather than reasoning about what should hold.

### "Is the response cache actually semantic?"

This one is no longer hypothetical: a maintainer of another list read "exact and semantic response
cache" in one of our submission rows, checked our own documentation, and asked us to state it the way
the docs do. They were right, and the row says `lexical-approximate` now.

The cache has two layers. Exact replay is byte-identical and always on. The similarity layer is on by
default and scores candidates with a deterministic local embedder that approximates **lexical/subword**
overlap - it exists so the whole path runs with no credentials and no network, and it deliberately
under-promises. Attach a real embedding endpoint through the HTTP embedding hook and the same layer does
semantic-grade matching. `docs/response-cache-hot-path.md` carries that honesty note itself, and the
hit metric is labelled `layer="semantic"` in `/metrics` whether or not an endpoint is attached, which is
how the loose phrasing got into a pitch in the first place.

Paste-ready, because the corrected version is the one that survives being checked:

> Honestly: the default similarity layer is lexical, not semantic. It is a deterministic local embedder
> that approximates subword overlap, so near-duplicate requests hit and paraphrases that share little
> vocabulary do not. That is what makes the cache testable with zero credentials and no network. Point
> it at a real embedding endpoint through the HTTP hook and the same layer does semantic matching. Our
> own doc says so, which is why we corrected the wording you caught instead of defending it.

Do not quietly upgrade it to "semantic" in a later thread now that the distinction has been written
down in the open.

### "You say you measure things. Show me one that surprised you."

This is the question to *want* asked, because the best answer so far is a measurement whose most
useful output was a defect in our own code.

We fixed `tools/list` pagination (#177): the gateway now walks every page and refuses to present a
truncated enumeration as complete. Closing it came with an admission written into the closure comment -
no test had ever seen a real third-party server paginate, so the bounds in the fix were a stance about a
protocol feature, not a survey of it. So we measured it: `tools/survey-mcp-tools-list-pagination.mjs`
reads the official MCP registry for `streamable-http` servers and sends each one an anonymous
`initialize` plus one `tools/list`. Forty servers, 2026-09-27 15:11 UTC:

- **16 answered. 0 of the 16 emitted `nextCursor`** - the biggest single-page list was 35 tools. The
  walk is insurance against a server nobody has met yet, not a repair for an observed failure.
- **22 of 40 refused the anonymous handshake outright** (21x `401`, 1x `403`). So any percentage
  measured this way is a percentage of the servers that let you look, and the page says that about
  itself rather than waiting to be asked.
- **1 of the 16 answered `2024-11-05` after being asked with `2025-06-18`.** Servers really do pick
  older revisions. When this was measured our governed client sent a revision and never read the
  reply, so that negotiation was invisible to us - which is now [#178](https://github.com/happy520ai/unified-ai-system/issues/178),
  filed against ourselves with the row that proved it. `master` now names each upstream's answered
  revision in the tool listing - reachable today through the rolling `:latest` / `:master` tags, built from
  `master` on 2026-09-27, though not through the versioned `0.8.0` tag - and the refuse-vs-report policy
  question is still open on the issue.

Paste-ready, in the same voice:

> The one that surprised us: we shipped a pagination fix and closed it by admitting no real server had
> ever been observed paginating. So we went and asked 40 servers advertised in the official registry.
> Zero of the 16 that answered paginate. 22 of the 40 wouldn't let us look at all without an account.
> And exactly one answered with an older protocol revision than we asked for - which turned out to be a
> bug in our own client, because we send a version and never read the answer. That's the measurement
> we're proudest of, and its main product was a defect report against us.

Full table, method and limits: `docs/mcp-tools-list-pagination-survey.md`.

The same endpoints were asked a second question an hour later, and it is the better answer of the
two: **will an MCP server agree to a protocol version that does not exist?** Asked with
`protocolVersion: "9999-99-99"`, 19 of 40 answered the handshake at all, and of those **2 echoed the
impossible revision back with HTTP 200** (`www.hood.ag/api/mcp`, `mcp.bev-buyer.ai/mcp`), 2 rejected it
with a JSON-RPC error, 14 answered with a revision they really support, and 1 returned `502`. Seven of
those 14 chose `2025-11-25` when asked nonsense while answering `2025-06-18` when asked politely - so
the fallback discloses the version a server would have preferred, which is the one piece of information
a client never gets by behaving. Method and limits: `docs/mcp-protocol-revision-tolerance.md`. Both
scripts run in about two minutes and are in `tools/`, deliberately outside CI because they measure
other people's servers.

Two cautions, because this number will get quoted: **never** say "no MCP server paginates" - the
defensible claim is "0 of the 16 we could introspect, in one alphabetical slice of the registry at one
timestamp, and stdio servers were out of reach entirely". And do not let "we found a bug in ourselves"
drift into "we are unusually rigorous"; the finding was one server, and the honest framing is that a
two-minute script was cheaper to write than the assumption was to keep.

### Two rules for every reply in this thread

- Never upgrade a claim to make an argument easier to win: no production-ready, no L5, no AGI,
  no "best", no "industry-leading", nothing about adoption you have not counted.
- If you discover mid-thread that something you asserted is wrong, correct it in the thread
  yourself and say what reading changed your mind. That repair is worth more stars than the
  original mistake cost.

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

### 0d. Changelog News — three fields, and they explicitly allow self-submission

`https://changelog.com/news/submit` is the intake for Changelog News (the newsletter, not
the podcast). Opened in a browser on 2026-09-26, and four readings decide whether it is
worth your twenty minutes:

- The form is three fields: **URL**, **Title**, and one free-text "What's interesting…"
  box. No attachment, no category, no fee.
- It wants an account: *"Please sign in / up to submit news. Your profile is used for
  attribution and notification."* That is why this is yours and not mine.
- The same page removes the awkwardness: *"Submitting other people's work is encouraged.
  Submitting your own work is also encouraged."* A disclosed self-submission does not
  break their rules — rare among launch venues, and the reason it beats re-using a
  throwaway account.
- Their 🚫 list is the real filter: no how-to's or tutorials, no commercial products
  (sponsorship is that path), no reader-hostile sites, no podcast episode suggestions.
  So the entry must read as *a new project you can check right now*, never as a guide.
  Their bar: *"Do your best to convince us why something is newsworthy."*

Field values, after re-running "Verify before posting" so every word in them is today's:

| Field | Value |
| --- | --- |
| URL | `https://github.com/happy520ai/unified-ai-system` |
| Title | Unified AI System: a self-hosted MCP gateway you can audit without a key |
| Story | ↓ |

> Apache-2.0 and self-hosted, and the interesting part is that a stranger does not have
> to take our word for anything: the repo ships a zero-dependency script that resolves
> the published image's manifest, fetches each layer blob and checks it against the
> digest the manifest names, then prints the MCP tool roster the image actually contains
> — no Docker, no API key, no trust in a README. `node tools/verify-image-roster.mjs
> <tag>`, from a clone of the repo; the same reading without one is at
> https://happy520ai.github.io/unified-ai-system/verify-mcp-docker-image.html. Behind it:
> deterministic local prompt enhancement that makes no provider call,
> virtual keys with per-key token budgets, an append-only audit chain, and reverse
> governance that turns upstream MCP servers and OpenAPI 3 operations into allow-listed
> tools.

Keep any star count and any tool count out of the copy you paste. A newsletter inherits
whatever number was true the day it scraped us, which is exactly the defect we keep
fixing in other people's entries.

---

### 0e. selfh.st — the closest audience we found, and it is a message not a form

`selfh.st` is a self-hosted-software newsletter, i.e. the readers we actually want. Read
from the site on 2026-09-26:

- `/submit/` is real (title "Submit Content", "Self-hosted news, content, updates,
  launches, events, and more") but the only form on it is a **subscribe** form served by
  Ghost's portal (`selfh.st/#/portal`) — there is no anonymous submission widget to fill.
- `/contact/` carries no web form either. The single address on the page is
  `selfhst@fosstodon.org` — a Mastodon-address, so it accepts both Fediverse DMs and
  plain email.

So the path is one message from you. It has to clear their editorial bar (they cover
*launches*, and they are allergic to ad-copy), and it has to be checkable in a minute:

> Hi — I built **Unified AI System**, an Apache-2.0 self-hosted MCP gateway, and thought
> it might fit the newsletter's "launches" lane. One-liner: it puts a policy layer in
> front of your models and your MCP servers — deterministic local prompt enhancement that
> makes no provider call, virtual keys with per-key token budgets, an append-only audit
> chain, and reverse governance that turns upstream MCP servers and OpenAPI 3 operations
> into allow-listed tools.
>
> The part I'd actually want a reader to try: nothing in the README asks for trust.
> `node tools/verify-image-roster.mjs <tag>` resolves the published image manifest,
> fetches each layer blob, checks it against the digest the manifest names, and prints
> the MCP tool roster the image really exposes — no Docker daemon, no API key. It is a
> script in the tree, so run it from a clone; the same proof without a clone is published
> at https://happy520ai.github.io/unified-ai-system/verify-mcp-docker-image.html. Docker
> Compose up against a local fake provider gives a working gateway in one command.
>
> Repo: https://github.com/happy520ai/unified-ai-system
> Site: https://happy520ai.github.io/unified-ai-system/
> Screenshots/source links on request; happy to answer anything technical.

Send it as-is only after re-running the reads in "Verify before posting" — if the tag in
that command has moved, say the current one.

---

### 0f. OpenAlternative — one checkbox only you can click

`openalternative.co` is a curated directory of open-source alternatives to proprietary
software, and the GitHub list people read (`piotrkulpinski/open-source-alternatives`,
6,747★) is **generated from it** — their `CONTRIBUTING.md` says to add a project you go to
`openalternative.co/submit`, and once approved it appears in the list automatically. So one
submission covers both surfaces.

Why this is on your list and not mine: the submit page sits behind a Cloudflare Turnstile.
Read twice in a real browser, six seconds apart, it never left the "正在进行安全验证"
interstitial, and `curl` gets a 403 — so the checkbox is a machine-refusal by design. I am
not going to solve one, for the same reason I left `awesome-selfhosted` alone.

What the form will want, with the honest values:

- **Name**: Unified AI System
- **Tagline**: Self-hosted AI gateway and MCP server you can audit without a key
- **URL**: https://github.com/happy520ai/unified-ai-system
- **License**: Apache-2.0 (this is what makes us eligible at all)
- **Description**: route, budget and audit model traffic from your own machine.
  Deterministic prompt enhancement that makes no provider call, virtual keys with per-key
  token budgets, exact + lexical-approximate response cache, append-only audit chain, and reverse
  MCP governance that turns upstream MCP servers and OpenAPI 3 operations into
  allow-listed tools. The published image's tool roster is verifiable without installing
  it.

Fill the "alternative to" field with the hosted gateway SaaS it actually replaces in a
stack. Do not name a specific vendor we have not compared against — a directory entry that
claims parity is a claim someone will hold us to.

---

### 0g. Republish the registry description (the one fix that multiplies)

**Decided later the same day - nobody needs to do this.** The route below is kept
because it is the fallback if a device-flow publish is ever required, but tonight the
question was closed with a machine answer. `.github/workflows/publish-mcp-registry.yml`
(now in the repository, `workflow_dispatch` only) authenticated from this repo's own
OIDC identity - `./mcp-publisher login github-oidc` printed `✓ Successfully logged
in` - and `validate` printed `✅ server.json is valid`. The publish itself was
refused: `status 400: invalid version: cannot publish duplicate version`
(run `36238695230`, whose log quotes both descriptions side by side). So the registry
is append-only per version and the 0.8.0 sentence cannot be corrected in place. It is
superseded the moment any new version is published, and the tag-triggered path in
`docker-build-push.yml` already does that as part of a release - which means the fix
needs no owner action and no extra release cut for its own sake. One thing I did not
verify: whether the human-facing page shows the newest version's description or the
one it first stored; the next release will say.

Readings taken 2026-09-26, all replayable:

- The Official MCP Registry serves this description for **0.8.0** - the exact endpoint
  returns 200:
  `Self-hosted MCP gateway for Codex, Cursor, and Cline with provider-free prompt enhancement.`
- That text is from the **0.4.4** era. Every version since repeats it verbatim, and
  directories that pull from the registry copy it, so the weakest sentence we have ever
  written about this project is the one with the widest distribution.
- The repository's own `server.json` already says something better
  (`Self-hosted AI gateway + MCP server: virtual keys, budgets, audit, OpenAPI-to-MCP,
  zero API keys.`), committed in `989f3e07` - **after** the `v0.8.0` tag, so it is in no
  release and never reached the registry. Nothing in the repo needs changing; only the
  publish call is missing.

**Do not `npm install mcp-publisher`.** That name on npm belongs to an unrelated
browser-automation/auto-publishing package (`latest 0.4.2`, description in Russian about
publishing content to platforms). The real tool is published by
`modelcontextprotocol/registry` (7,284 stars, Go) as release archives.

Windows path, verified to exist in release `v1.8.1`:

```powershell
# 1. fetch and verify before running anything
curl.exe -LO https://github.com/modelcontextprotocol/registry/releases/download/v1.8.1/mcp-publisher_windows_amd64.tar.gz
Get-FileHash .\mcp-publisher_windows_amd64.tar.gz -Algorithm SHA256
# expected: 399AD0D6E00A50812B563A71D8BFBFF5160C085E6B13AAC6EC083D98D5FF7C45
# (from registry_1.8.1_checksums.txt in the same release; re-read it rather than trusting this line)

# 2. unpack, then sign in through the GitHub device flow
tar -xzf .\mcp-publisher_windows_amd64.tar.gz
.\mcp-publisher.exe login github

# 3. from the repository root, where server.json lives
.\mcp-publisher.exe publish
```

Verify with a fresh read rather than the tool's own success message:

```bash
curl -s "https://registry.modelcontextprotocol.io/v0/servers/io.github.happy520ai%2Funified-ai-system/versions/0.8.0" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).server.description))'
```

Two things I could not establish and you will find out by doing it:

- **Whether republishing an existing version overwrites or is rejected as a duplicate.**
  The registry docs do not say. If it is rejected, nothing is lost and nothing breaks: the
  improved text ships automatically with the next release, since publishing is per version.
- **Rollback requires the old string**, because a successful overwrite may not be
  undoable otherwise. It is quoted in full above - that is the exact value to restore if
  you decide the registry copy should stay conservative.

Whatever happens, the check worth keeping is this one: the registry description is the only
surface found today that other sites copy *without* being asked, so a stale number there
reappears elsewhere on its own.

### 0h. The Glama quality score - five minutes, and it is the last gate on our biggest door

Readings taken 2026-09-26, all replayable.

`punkpeye/awesome-mcp-servers#12218` is the highest-traffic listing door we have open, and the
maintainer answered directly on 2026-09-07 with exactly one remaining requirement:

> **Glama quality score**: Your server is listed on Glama and claimed, but the quality score has
> not yet been evaluated (it currently shows "?"). Glama must evaluate the quality score (any
> grade is fine) - please check your server dashboard at https://glama.ai/mcp/servers and ensure
> the evaluation is triggered/completed.

The badge part is already done (their bot confirmed: "Thank you for adding the Glama badge!"),
and the PR is mergeable. So the whole door now waits on a grade Glama has never computed.

**Why this needs you and not me:** the trigger sits behind the claimant dashboard, and this
machine's browser is not signed in. `glama.ai/mcp/servers/happy520ai/unified-ai-system/admin`
reads "Login with GitHub to claim" and "Sign in as that GitHub account and this page becomes
yours immediately." `/score` currently redirects back to the listing, i.e. no score record exists.

**Do not wait for it to fix itself, and do not assume the server is the problem.** Both were
checked today. From a cold start, with no credentials and no gateway configured, the entrypoint
the published MCP image runs (`packages/mcp-server/src/index.js`, `Dockerfile:68`) answered the
MCP handshake like this:

```
first byte / initialize   8,541 ms
tools/list                8,545 ms
protocol 2025-06-18   serverInfo.name unified-ai-system   tools returned 15
stderr: "Unified AI System MCP 0.8.0 ready on stdio; real providers disabled."
```

Glama's own stated bar is "we only need the server to start and respond to introspection
requests", and it is met in under nine seconds. (Side benefit: gate 4's stdio budget is 30 s, so
a quiet machine has ~3.5x headroom and a red `mcpStdioReady` under load is a load reading, not a
startup defect - one fewer reason to think the image is at fault.)

**The one thing worth checking while you are in there.** Their bot also says "you must add
Dockerfile directly to Glama", and our root `Dockerfile` builds two servers: `AS mcp` at line 62
(stdio, the one that answers introspection) and `AS gateway` at line 70, which is the **last**
stage and therefore what `docker build` produces when no `--target` is given. The gateway stage
listens on `:3100` over HTTP with `PME_ENTERPRISE_AUTH_ENABLED=true` and never speaks MCP on
stdio. So if Glama's build spec for this listing has no target, no amount of re-running the
evaluation will ever yield a grade. Under **Docker builds**, set the spec to `--target mcp` (or
point it at the published `ghcr.io/happy520ai/unified-ai-system/mcp-server:0.8.0`, which is what
`server.json` already declares as a stdio package). I could not verify which of these the
dashboard offers - it is behind your login - and I could not rule out that Glama already builds
`mcp` correctly; that is why this is phrased as "check", not "fix".

**What I ruled out, so you do not spend time on it:** the repo root already carries
`glama.json` with `maintainers: ["happy520ai"]`, so the claim half is done. And the build target
cannot be declared from the repository - `https://glama.ai/mcp/schemas/server.json` defines
`properties: ["maintainers"], required: ["maintainers"]` and nothing else, so there is no field
that means "build this stage". (The schema does not set `additionalProperties: false`, so an
invented key would be *accepted* rather than rejected - which is worse: it would look configured
while being read by nobody.) Their own admin page describes the build spec as a dashboard
control, so this has to be clicked; it cannot be committed.

---

## 0i. If you want v0.8.1 - the release that would make our own docs true

**Why this exists:** three fixes are on `master` and in no published image. The upstream-visibility
fields (`observed`/`exposed`), the `tools/list` walk that refuses a truncated enumeration (#177),
and the governance surfaces documented in `docs/reverse-mcp-governance.md`. That document now
describes behaviour a person running `mcp-server:0.8.0` cannot reproduce. It is not a false claim -
the repository does what it says - but the gap between "the repo" and "the image" is exactly the
kind of thing that gets read as a broken promise.

**The surface, measured today rather than from memory:** `git grep -l "0\.8\.0"` returns **60 files
carrying 236 occurrences**. Of those, four are *declared* versions that must move together:

| File | Guarded by |
| --- | --- |
| `package.json` | the reference everything else is compared to |
| `server.json` | `mcp_registry_version_mismatch` |
| `.codex-plugin/plugin.json` | `codex_plugin_version_mismatch` |
| `packages/mcp-server/package.json` | `mcp_server_package_version_mismatch` - **added today** |

That last row was a real hole, not a tidy-up. The published image is tagged from that package's own
version, and every existing guard compared against the root manifest, so a bump that updated
`package.json`, `server.json` and `plugin.json` and missed `packages/mcp-server/package.json`
produced an image whose tag and internal version disagreed **with `pnpm check:public` still green**.
Proven by tampering rather than asserted: setting that one file to `0.8.1` flipped the gate to
`"ok": false` naming exactly `mcp_server_package_version_mismatch` and no other version guard, then
reverting restored `"ok": true` with the file byte-identical to `HEAD`.

**What no gate covers:** the other ~56 files are prose. `public-repo-check.mjs` pins one version
literal, so a half-finished documentation sweep is invisible to CI by construction. Enumerate them
before committing: `git grep -l "0\.8\.0"` and read the list.

**What must NOT move:** `CHANGELOG.md`'s 0.8.0 entry, `docs/growth-launch-kit-2026-08.md`, the
as-of certification matrices (`docs/mcp-client-compatibility.md`,
`docs/protocol-client-compatibility.md` and their `.zh-CN` twins), anything under `docs/history/`,
and the sealed roster in `tools/check-pinned-count.mjs`. That roster records what each *published*
release exposed (0.4.9→9, 0.5.0→12, 0.7.0→12, 0.8.0→15) and is **extended, never edited** - and the
new entry has to come from reading the roster out of the built image, not from the source count,
which is the whole reason the roster exists.

**Gate order, because the last one is not optional but is locally broken:**
`pnpm check` → `pnpm test` → `pnpm check:public` → commit → `pnpm verify:public-clone` → tag → push.
`verify:public-clone` currently fails on this machine for a reason unrelated to any change: its
hard-coded 480 s budget against a measured ~451 s run, and it refuses a dirty tree, so it must come
after the commit. The authoritative reading is the CI step **"Public clone runtime"** on the pushed
commit - on the v0.8.0 release commit it reported success while the same gate failed locally three
times.

**Why this is a decision and not a task.** The push-and-tag approval that shipped v0.8.0 was for
that release. A new tag and a new published image are the same kind of shared, hard-to-reverse
action, so they need their own yes - which is the reason this section exists: to make the yes cost
one sentence rather than an afternoon of archaeology.
## Verify before posting (re-run, do not trust this file)

```bash
node tools/launch-preflight.mjs
```

One command, about two minutes, needs `gh` auth and network. It re-reads from the live
web what the copy asserts: the latest release tag, the tool count measured out of the
published image layer, every `ghcr.io/...:<tag>` reference the copy tells a reader to
run, the registry entry for that version, Glama, the four pages the posts deep-link
into, and the tag-anchored commit count. Exit 0 means every claim matched a live
reading; exit 1 means DRIFT - rewrite the flagged figures before posting; exit 3 means
INCONCLUSIVE because a probe could not run, which is kept visibly different from
"clean". The version and the counts are read out of the paste-ready `>` lines rather
than out of the script, so it cannot pass by agreeing with a constant in itself, and
it knows a line that reproduces somebody else's wording is not our claim to defend.
Two things it does not cover: the "and the current source" half of the tool-count
sentence, which `pnpm verify:mcp` is the gate for, and anything the drafts do not
quote.

The manual form, if you want to see each reading instead of trusting the verdict:

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

> **Smithery：我们不在上面，而且这条不值得你去补。** 现读两条独立证据：规范条目地址
> `smithery.ai/server/@happy520ai/unified-ai-system` 渲染出的 H1 是 `404: Server Not Found or Removed`
> （一个会显式区分"没有"的页面，本身就是有效仪器；早先那次"200 但整页只有站名"的读数不算，因为
> SPA 的外壳对任何路径都长一样）；搜索 `unified-ai-system` 返回 184 条模糊结果，头部是 Relay、
> Humaux Memory 之流，没有我们的卡。`registry.smithery.ai/servers?q=` 连控制查询都过不了
> （查 `filesystem` 返回 Google Drive / OneDrive），所以那条 API 路不能用来判存在与否。
>
> 为什么把它记成"不做"而不是"该做"：本文件上面的实测结论是**六条已合并的清单条目把星星数推动了 0**。
> Smithery 刚宣布并入 Arcade.dev（站顶横幅），目录处于迁移状态，此时为它建号的期望收益不比再开一个
> awesome-list 高。如果哪天你真的花 2 分钟，那就顺手做；但它不该出现在"15 分钟清单"里。
> 同一条判据也适用于 mcp.so：那边只有 Cloudflare 403，**不可判**，别再为它造探测器。

> ⚠ **搜索索引这条道已经有实现了，别再造第二套。** `.github/workflows/indexnow.yml` +
> `tools/submit-indexnow.mjs` + `docs/indexnow.json`（key 文件必须是 `docs/<key>.txt`，且校验器要求
> 文件名等于内容）自 2026-08-02 起在每次 Pages 构建后通知；它那道 `git diff --quiet HEAD^ HEAD -- docs`
> 门经现网核对是在正常工作的：改到 docs 的 head（`9f24c456`、`8cf5097f`）`Notify IndexNow=success`，
> 没改 docs 的 head（`f2ed3457`）`Notify=skipped`。
>
> 2026-09-26 这次是我自己没查就动起手，重造了一份 `tools/notify-indexnow.mjs` + 测试 + 快照工作流第 4 步 +
> 第二个 key 文件，已整体撤销（master `48abb321`）。留下的直接后果是：**日报里"14 页只有 6 页在 DDG 索引"
> 那一行，不能用"通知没送达"来解释**——通知这两个月一直在发。那一行为什么是这样，我现在没有证据，
> 也不要顺着"再补一次通知"这条便宜路去做。动手前先 `ls .github/workflows | grep -i indexnow`。

| 面 | 读数 | 判据来源 |
| --- | --- | --- |
| 星数 | **7**（与昨日快照差 0），fork 2，subscriber 0 | `gh api repos/...` |
| 记账门 | 52 扇（44 PR + 8 提交型 issue），完备守卫读 Complete。⚠ 这一行今天白天还写 39 扇（33 PR + 6 issue）——一天之内因为换检索式与第三方手工收录涨到 52，所以**任何手抄的扇数都是过期读数**，要现值就跑右边那条命令；今晚新增的两扇是 `cuihuan/awesome-ai-gateway#104`（已发布条目里写 nine，PR 修描述行与"当前发布版是 v0.4.9"那句）与 `FrancoStino/opencode-skills-collection#127`（vendored 我们 SKILL.md 的 bundle；注意该程序按 digest 钉 0.4.9 ⇒ 步骤里的 nine 是对的，别去改它） | `node tools/star-growth-check.mjs check` |
| 队列活度 | 压着我们开放 PR 的 19 个仓库：**ALIVE=10 / STALE=3 / DEAD_QUEUE=6** | `node tools/star-growth-check.mjs queues` |
| 上游 README 收录 | 5 处可见 / 28 处未见 / 0 处读不到（第 6 个已合并的门在数据文件里，不在 README） | 同上 |
| 人类参与 | 最近 100 条评论作者分布：`happy520ai=88`、`dependabot[bot]=11`、**其他真人 1 人 1 条** | `issues/comments` 分组计数 |
| 有没有人在等我们回答 | **31 扇开放门全读（每扇最近 100 条评论，0 扇读不到）＝没有任何一条人类评论在等我们回话**。这条现在是仪器的一节（`check` 报告里的 "Whether a human has asked us something"），不再靠手抄门清单——手抄那份今天漏掉了当天新开的 6 扇。⚠ 顺带抓到 `shiftbot` 的账号类型是 `User`（它自己写 "I am a robot"），所以机器人只能按登录名形状判，不能信 `user.type` | `node tools/star-growth-check.mjs check` |
| Topic 版面位（20 个已满，只能换不能加） | 现读排名（`search/repositories?q=topic:X&sort=stars`，名次＝页内 index+1）：**`prompt-enhancement` 20 个仓里第 7**、**`token-budget` 110 个里第 11**、`agent-governance` 832 个里第 97；`mcp-security`／`llm-observability`／`codex-cli` 不在前 100。而被换掉的 5 个（`llm` 139,369 个仓、`openai` 46,145、`ai-agents` 98,911、`anthropic`、`gemini`）实测**全部进不了前 100**＝零曝光。⇒ 这轮交换的净收益是"从五个看不见的位置换来一个看得见的位置"（另三个是语义正确但暂时不上首页的描述词），不是流量保证。回滚＝一次 `PUT /topics`，把这 5 个新词（`codex-cli`／`mcp-security`／`agent-governance`／`llm-observability`／`token-budget`）换回被删的 5 个（`gemini`／`anthropic`／`openai`／`llm`／`ai-agents`），两边都记在本行里，不依赖任何未跟踪文件。⚠ 别用浏览器读 topic 页来判"在不在"：未登录时 `github.com/topics/*` 返回登录外壳，`article` 选择器取到 0 条＝**仪器瞎**，名次必须用 API 判。同日量到第二件免费的发现面＝仓库描述行（同一件仪器：`search/repositories?sort=stars`，只是 `in:description` 作用域）：`governed mcp tools in:description` 我们 213 个仓里第 17、`virtual key in:description` 1,960 里第 70，但 `prompt enhancement in:description mcp`（整池只有 42 个仓）里**根本没有我们**，原因不是排名而是描述行没写这个词。加进去（改前先跑差分断言：被删短语数＝0、只多一个短语）⇒ 同一条查询现读第 9/42（`gh api` 的 `index()` 是 0 基，我第一次手抄成 8 是错的；仪器自己打的是 1 基）。随后再测 `openapi to mcp`(263) 与 `agent control plane`(2,986) 都是按星序排的大池，加词进不了前 100 ⇒ 就此收手，不把描述行堆成关键词袋。**回滚＝一次 PATCH，旧值逐字是**：`Public Preview: self-hosted, protocol-first AI gateway and agent control plane for OpenAI, Anthropic, Gemini, MCP and A2A — governed tools, virtual-key budgets, cache and audit; zero-key first run.`（不含 prompt enhancement 那版；现值只在 `gh api repos/happy520ai/unified-ai-system --jq .description`，不在本文件里复制第二遍以免两处漂移） | `gh api …/topics` + 排序检索 |
| 使用回报表 | `usage-verification-report.yml` 存在且 URL 可解析，但**被用过的次数 0** | `.github/ISSUE_TEMPLATE/` + label 查询 |
| 浏览器登录态 | 现读 **未登录 GitHub 网页**：访问 `/settings/admin` 被 302 到 `/login?return_to=…`，页面有登录表单，`meta[name=user-login]` 为空串 ⇒ 「分享卡上传、Changelog News 注册、selfh.st 会员消息、Turnstile 勾选」这四件确实只能你本人；`gh` 的 token 只覆盖 API 面（清单/目录 PR、Release、Registry 流水线我都做得动），不带你的人机登录态。当晚用同一方法再测 news.ycombinator.com：页面上没有 `user:` 行，且 `/x` 端点只返回 24 字节（有会话时它返回带 `fnid` 的表单）⇒ HN 同样没有会话，§1 那条 Show HN 确实只能你本人发 | 浏览器同源探测，含正对照靶：若已登录该 meta 应是 `happy520ai` |
| 贡献台 | `good first issue` 开 3 个（#166/#113/#106）、`help wanted` 开 12 个（#167-#173、#175、#176、#177、#166、#113，都带验收清单）；#174（合法但零工具的 OpenAPI spec 在花名册里与健康一模一样）同日已修：每个上游现在报 observed/exposed，两种“零”不再同形 | label 查询（2026-09-27 现读） |
| 别人替我们保管的副本（**这才是今天真正的问题面**） | 逐个读"我们合并过的 PR 改了哪些文件"，发现四处仍在外发旧数字/旧指令，纠正全部已提交且都是极小 diff：`hashgraph-online/awesome-ai-plugins#479`（README 一行，删数字不换成 15；其 `validate-plugins.yml` step 名就是 "Sync marketplace artifacts with README" ⇒ JSON 会自己重生成，不碰）、`toolsdk-ai#552`（其机器可读条目把安装镜像钉在 **`mcp-server:0.4.8`**＝五个月前 9 工具镜像）、`up-for-grabs#6176`（`_data/projects/unified-ai-system.yml` 仍写 nine）、**`sickn33/agentic-awesome-skills#1616`（46.9k★，vendored 我们的 SKILL.md，里面写 "If the nine tools are already visible, skip setup"／"nine tools are available" ⇒ 读者按 15 配好后被这份文件告知自己配错了，是会误导操作的缺陷不是文案问题。同一张分支还改了它自己手写的 README 行（去掉数字；他们 CONTRIBUTING 的生成物清单只有 `CATALOG.md`/`skills_index.json`/`data/*.json`，README 不在其中 ⇒ 我最初把 README 当成生成物排除掉是判断错，已在这条 PR 正文里公开更正））**，以及 `agentskillexchange/skills#82`（自动摘要写 "nine bounded tools"，一行）。四扇守卫读数会随合并自己变绿，**2026-09-26 14:23Z 其中一扇已合**：`hashgraph-online/awesome-codex-plugins#449`（vendored `SKILL.md`，+55/−15，由 kantorcodes 合入）⇒ 生成物确实自己重生了，**已回读证实而非推断**：`plugins.json` 里我们那条 `description` 现在写 "fifteen governed MCP tools"（同文件里的 16/23 属于 BABOK Analyst 与 MailAgent，不是我们）。**不提第二个 PR**，也不需要人去看他们的 CI。同日再进两扇并已进门台账：`cuihuan/awesome-ai-gateway#104`（活体 README 行仍写 nine，PR 只改描述行与"当前发布版是 v0.4.9"那句）与 `FrancoStino/opencode-skills-collection#127`（bundle 的 description 行同样写 nine；⚠ 该程序按 digest 钉 0.4.9 ⇒ **步骤里的 nine 是正确的，别去改**）。同日晚些又量了两处**无需开门**的活体收录：`yzfly/Awesome-MCP-ZH` 第 1202 行与 `slavakurilyak/awesome-ai-agents` 第 2830/2835 行——把守卫自己的匹配器（`staleToolCounts`，roster=15）跑在整行窗口上，工具数与版本号命中均为 0 ⇒ 那两处不渲染数字、没有可误导内容，所以既不开 PR 也不进门台账（负结论记在此处，免得下次重扫）。 | 判据＝我方 roster 现读 15 与 `verify-image-roster.mjs 0.8.0`；⚠ 一次"按含我们名字的行筛"的快速普查把 up-for-grabs 误判成 ok（数字与项目名常常不在同一行）⇒ **只有整文件载体算证据，临时脚本不算** |
| 技能目录/Skill registry 族（2026-09-26 普查，**一族全部不收，理由要留下**） | 这一族当天全部在 1 小时内被 push，非常活：`VoltAgent/awesome-openclaw-skills` 52.8k★（**前置**：只收已发布到 ClawHub 的技能，条目必须带 `clawhub.ai/<owner>/<slug>` 链接）、`tech-leads-club/agent-skills` 6.8k★（24/30 合并；要求新技能必须走他们仓内的 `skill-architect` 流程 + 固定描述结构 + Snyk Agent Scan）、`davepoon/buildwithclaude` 3.5k★（22/30 合并，今天；只收 **Claude 插件**下的 `plugins/all-skills/skills/<name>/SKILL.md`）、`majiayu000/claude-skill-registry` 650★（CONTRIBUTING 原文 **"Do not submit normal source PRs here"**＝生成镜像）、`heilcheng/awesome-agent-skills` 6.2k★（30 条近期关闭 PR 合并 **0** 条 ⇒ 死队列）。**共同的不匹配**：我们官方技能 front matter 写 `tools: codex`、正文第 1 步是"确认已安装 Codex CLI 且 Docker 在跑"，全文零次提 Claude ⇒ 投进 Claude/OpenClaw 专用索引就是替我们声称一个没实现也没文档的主机支持。**能改变这件事的只有一步，而且是你的**：`clawhub login`（GitHub OAuth，非 git 通道）后发布我们的技能到 ClawHub，得到 `clawhub.ai/happy520ai/unified-ai-gateway`，之后 VoltAgent 那张 52.8k★ 的表才允许一条带该链接的 PR ⇒ 值得的只有这条，其余四条要改技能本体或换主机声明，那是产品决定不是推广动作。**2026-09-26 复核把这条整体下调**：VoltAgent 的 CONTRIBUTING 原文除了「必须已发布到 ClawHub」还写着 “Brand new skills are not accepted — give your skill time to mature and gain users before submitting”，并要求 ClawHub 上的测试通过、安全状态未被标记；也就是说 52.8k★ 这张表按「社区已采用」筛，7★ 阶段投过去是被**规则**拒，不是被人拒。ClawHub 侧也没有免凭据路径：发布走 Convex + GitHub OAuth（`openclaw/clawhub` 的 `docs/publishing.md`：CLI 校验 token 能否为该 owner 发布）。⇒ 上面那句「值得的只有这条」作废——这条门在星数起来之前根本不开，不列为待办，也不要为它去登录第三方 OAuth。 | 逐个读 README/CONTRIBUTING 原文（`gh api …/contents/CONTRIBUTING.md`）＋队列活度实测；⚠ 我第一次用管道串了一个未闭合字符类（`grep -vE "^[?"`）⇒ 那一轮两个仓都返回空，那是无效读数不是"没有规则"；`gh search repos --json` 的星数键名是 `stargazersCount`（试 `stars`/`stargazerCount` 都会报错并回显被截断的可用字段列表），默认表格输出反而可用 |
| 站点被索引 | 现读（05:39Z）：**Bing 收了 13 个已发布 URL 中的 6 个**，`cite` 逐条点名是我们域名（`/`、`index.zh-CN`、`prompt-enhancement`、`terminal-first-ai-gateway` 等）；今天新发的 `verify-mcp-docker-image` 与 `self-hosted-ai-gateways-compared`×2 还没出现在任何引擎里 ⇒ 新页从上线到被索引有小半天到数天的滞后，IndexNow 的 `submittedUrlCount` 只代表「已提交」不代表「已收录」 | 这一行的价值全在仪器状态：`curl` 打 Bing `site:` 返回 200 但正文只有我们自己的查询串（假 0）；中文 locale 的浏览器 Bing **忽略 `site:`** 直接给百度结果（也是假 0）；**加上 `mkt=en-US` 才有效**（About 6 results、6 个 `.b_algo`、`cite` 命中我们域名）。DDG lite 03:41Z 给出同样的 6 条，05:35Z 起对脚本和真浏览器一律回 HTTP 202「select all squares containing a duck」⇒ 当天后半那台仪器不可用。`node tools/star-growth-check.mjs coverage` 现在把 RESULTS / CHALLENGE / 空 三种状态分开报，不再把「被拦」写成「没有」。 |
| 新探到的面 | **Changelog News 可自荐**（见 §0d，需你注册）；`thechangelog/ping` 已死（README 首行"no longer in use"，最后一条 issue 2019-11-05）；`modelcontextprotocol/modelcontextprotocol` 有 Discussions 但**没有 showcase 类目**（Announcements/General/Ideas/Meeting Notes）⇒ 发进去是噪音；Higress 系 `openapi-to-mcp` 相关 issue 全是别人产品的 bug ⇒ 不是我们的场子 | 逐个现读，非推测 |
| 两家新目录的门槛 | **Best of JS**：他们的 `add-a-project` 模板自带勾选项「project has more than 100 stars on GitHub」，维护者对 9 月的一个自荐也是这么回的 ⇒ 现读 7 星**不够格**，已进 `deferredDoors`（报告现打印「needs 94 more stars」），到点前**不要提**；队列是真活的（截至 09-23 两周内 7 次合并）。**OpenAlternative**：`/submit` 与 `open-source-alternatives` 仓的 README 都指向同一张表，而表单页在 Cloudflare Turnstile 后面（真浏览器实测两次、等 6 s 仍在验证页，curl 直接 403）⇒ 机器不该过这道勾，**只能你点**（见 §0f） | `gh api .../ISSUE_TEMPLATE/…` + 维护者回复原文；browser-use 现读 |
| 三扇当天新读出的清单（**都没提，理由要留下**） | `av/awesome-llm-services`（263★，主题最贴："self-hostable LLM services"）：最近 30 条 PR 里**合并 0 条**＝看不到 intake 通路，且它明写排名是按 **log(星数)** 的复合分 ⇒ 7 星投进去只会沉底。`altstackHQ/altstack-data`（323★，18/30 合并、09-21 还在动，条目在 `data/tools.json` 里挂在某个 SaaS 父项下）：其 `CRITERIA.md` 第 5 条 **"Solo hobby projects with no users are excluded"** 并要求"我们实测核心工作流"⇒ 以 7 星＋**使用回报表 0 条**的现读，我们正卡在它排除的那一类。`docker/awesome-compose`（46.4k★）：intake 是**先开 issue 提案、讨论后再提 PR**，且要交自带 README 的完整示例目录 ⇒ 那是产品活不是投列表；抽样里最新一次 PR 合并是 **2020-03-27** | 逐个读正文与 `CRITERIA.md`；**⚠ 别把数组当对象查键**：我第一次用 `Object.keys(data)` 判"没有 gateway 类父项"，而 `tools.json` 是 146 个元素的数组（键是 0..145）⇒ 那句"没有"是无效读数，已作废 |

| 换形状探到的第四家（**今天已提，唯一新增门**） | 不再搜 "awesome mcp"，改成**扫高星清单的 README 里没有我们的那一家**：298 个候选取前 70 逐家读（其余记为未测，不记为未收录）。命中 `ComposioHQ/awesome-claude-skills`（**75,650★**，无星数门槛、不禁止 agent，条目格式与邻居一致）⇒ 已提 **ComposioHQ/awesome-claude-skills#2001**，`+1/-0`，提单前该分支 README 与上游 head 逐字节相同 | `.tmp/list-candidates.mjs`（gitignore）+ `gh api repos/.../pulls/2001` |
| 两家探到但**故意不提**的（边界是对方划的，不是我们怕拒） | `hesreallyhim/awesome-claude-code`（54,624★）CONTRIBUTING 原文「**Do not open a PR. Just fill out the form**」「not possible to submit … using the `gh` CLI」「recommendations **must be created by human beings**」⇒ **只能你本人**走 `issues/new?template=recommend-resource.yml`（资格我们已满足：门槛是首 commit 满 14 天且有后续提交，本仓 2026-04-27 建）。`VoltAgent/awesome-agent-skills`（34,871★）「don't submit skills you created 3 hours ago… focusing on **community-adopted** skills」⇒ 7★ 无第三方采用，占了队列也过不了，没提 | 两家 `CONTRIBUTING.md` 原文（2026-09-26 现读） |

**三条结论，都不靠感觉：**

1. **清单渠道接近饱和，且已按活度过滤。** 又换两种检索式（`mcp gateway in:name` / `awesome agentic in:name` 等）扫到 8 个 ALIVE 候选，逐个读进去：一个是**产品仓**（README 没有 intake 语）、一个是**学习路线图**（Stage 0–8 课程，不收工具）。⇒ 剩下的门主要靠等维护人，不靠再铺新门。
   ⚠ 附带一条仪器边界：筛查脚本报 `intake=yes` 只表示 README 里出现过 "contributing" 一词，**不等于收条目**；判定必须落到小节正文。
   ⚠ **这条"饱和"结论当天晚些时候又被换形状推翻了一次**（这是本文件里第二次记同型更正）：改用 GitHub 的 **topic 检索** `topic:awesome-list mcp stars:>100` / `topic:awesome-list ai stars:>300`（而不是把 `awesome`/`mcp` 塞进 `in:name`）得 14 个候选，其中两扇是真门并已开出：
   `alvinreal/awesome-opensource-ai#779`（4,792★，最近 30 条关闭 PR 合并 29 条，其 CONTRIBUTING 明写**不设星数门槛**，提交前跑过他们自带的 `tools/validate_awesome.py`＝0 error，且用"删掉 badge"的篡改靶证明校验器真的读我们那一行）与
   `steven2358/awesome-generative-ai#1451`（12,683★，10/30 合并，门槛是"1,000 followers 或维护者个人感兴趣"，且**不达标的去处是 Discoveries 列表而不是拒绝**⇒ 自荐时我照实写了"我们知道进不了主表"）。
   ⇒ 教训不是"渠道没饱和"，而是：**同一形状重复检索只会自证饱和；判"见底"前必须换一次检索维度（name → description → topic）。**
2. **合并 ≠ 星数。** 已有 6 处收录，星数一次没因此动过。所以本文件里所有"已提交/已合并"的账都只当管道健康度看，别当成效。
3. **仍然只有你能撬动的两件事没变**（含步骤与回滚在 `growth-launch-kit-2026-08.md` §7）：
   ① 用你自己账号发 HN/Reddit/X（文案在第 1–4 节，发帖前按该节要求重跑现读）；
   ② 上传 15 工具版社交预览图（`docs/assets/social-preview.png`，与站点 `og:image` 字节一致）。
   第三件是被动等：mcpservers.org 审核约 2026-10-09 见结果；awesome-selfhosted 约 2026-11-30 才够龄且必须你本人提。

**如果这周只做一件事**：发 HN。理由就是上表——其他所有面要么在等人（清单），要么已经证明对星数没有可测影响（收录），而一次性外部曝光目前没有别的路径能替代。

### 2026-09-27 19:29 UTC 现读补充：三条"渠道"从假设变成读数

| 面 | 现读 | 怎么读的 / 还没测什么 |
| --- | --- | --- |
| **Glama** | **我们已经在上面，而且条目是准的。** `glama.ai/mcp/servers/happy520ai/unified-ai-system`，页面标题 `unified-ai-system by happy520ai \| Glama`，正文取自我们 README，且写的是 "Expected: a line reading tools **15**"，还带一句"同一个命令打在 0.4.0 上报 nine，所以这个数跟着工件走、不跟着描述走"——那句话是我们自己写的口径，它替我们答了"为什么别处看到 nine" | 浏览器渲染后读 `innerText`/DOM，不是 curl（这站也是前端注数据，curl 拿不到卡片）。**没测**：这个条目是被认领过还是它自己从 GitHub/Registry 同步来的；页面上没有 `unclaimed` 字样，所以我判不出认领状态，也就不能把它写成"待认领"。<br>⚠ 本文件之前（和我的台账之前）把 Glama 记成"等 owner 花一分钟去认领"的活；现读至少否证了"我们不在上面"，剩下的那半（认领到底有没有价值）仍然没有证据 |
| **Show HN** | **浏览器里没有登录态。** 首页头部是 `login`，DOM 里找不到 `logout` | 所以 §1 那条仍然是只能你本人做，不是我"可以先替你发"的活。这条值得记一句：我在四条已授权渠道里挑了两条去实测能不能代办，一条（Glama）证明我们的假设是错的，一条证明它是对的——**"已授权"不等于"可代办"，也不等于"已知现状"**，两者都要读 |
| **官方 MCP Registry** | **在列，且描述里没有工具计数**（避免了一整类过期问题）。`io.github.happy520ai/unified-ai-system`，latest 记录 version `0.8.0`、`status=active`、`isLatest=true`，17 条历史记录从 `0.3.1` 到 `0.8.0`（旧条目里写着 eight / nine，那是当时的事实）；README 上两种形态的徽章地址（`/v0/…` 与 `/v0.1/…`）都返回 200 | `curl` 打 `registry.modelcontextprotocol.io` + 读 `_meta['io.modelcontextprotocol.registry/official']`。<br>**可用于任何投稿的一句真话**：项目登记在官方 MCP Registry 里。这一句我现在核对过，写它不需要钱、不需要账号、也不需要等任何人 |

> 这三行都是同一件事的两侧：**目录站的收录状态会自己变，而"我们不在上面"这种句子最容易从记忆里活下来。**
> 任何出现在本文件里的"没被收录 / 需要认领"，都请当它是它写下那一刻的读数——判据就在右边那一列，两分钟能重跑。

### 2026-09-27 19:35 UTC 补：mcp.so 从"不可判"变成"判得出了"，以及一条我自己差点写错的话

上面那行"同一条判据也适用于 mcp.so：那边只有 Cloudflare 403，不可判"现在过期了。用浏览器渲染读，两把读数是分开的：

| 探法 | 读数 | 这条能判什么 |
| --- | --- | --- |
| `mcp.so/servers/unified-ai-system` | `404 / Page not found`，整页 58 字符 | 光看这条不能判——URL 形状对不对还不知道 |
| `mcp.so/search?q=unified-ai-system` | 页面自己写着 `0 results` 与 `No servers match "unified-ai-system"` | 若搜索功能本身是死的，这个 0 就是假零 |
| **控制** `mcp.so/search?q=filesystem` | **`488 results`**，渲染出 50 张卡，其中一张就是 `/servers/filesystem` | 搜索是活的；且 slug 形状是裸名（不带 owner 前缀），所以上面那条 404 用对了形状 |

三条放一起，结论是：**我们确实不在 mcp.so 上**，而"不在"这件事本身现在可以免费判出来了——不需要花那 $39 才知道答案。#28 那个决定该问的问题因此变窄了一点：不是"付钱才能被收录/被搜到吗"，而是"那条已经开着的免费投稿 issue（chatmcp/mcpso#3394）到底会不会被处理"。这两件事我之前混在"CF 403 ⇒ 不可判"一句里，所以它一直没人去读。

**关于我自己：** 这一轮里我先前的叙述中有一段说"`q=github` 返回 6 张卡、slug 都带 happy520ai 前缀"——**那次工具输出根本没拿到**（导航只回了 "Successfully navigated"，我当时是照着自己对"应该长什么样"的预期把卡片名单补出来的）。随后我按那个形状去猜 `/servers/happy520ai-github-trends`，结果 404，反倒是这个 404 提示我形状猜错了。写在这里的原因：这就是"没人拦就会发生的编造"，而它这次没流到任何公开文本里——那段说法只存在于我的中间推理，本文件、issue、评论里都没有。教训的形式化版本：**读控制组之前必须先确认控制组的输出真的拿到了；否则"0 条"永远比"6 条"更容易被误当成结论。**
