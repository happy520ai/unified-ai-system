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

## If you only have 15 minutes: the order to do these in

Everything in this file that I could do is done. The list below is the remainder, in
the order that buys the most per minute — measured, not guessed: six merged listings
moved the star count by zero, so listings are pipe maintenance, and the only surfaces
with a ceiling above ~20 stars are the ones that need your identity.

| # | Action | Where | Why here in the order |
| --- | --- | --- | --- |
| 1 | Upload the 15-tool share card (§0) | `https://github.com/happy520ai/unified-ai-system/settings` → Social preview → `docs/assets/social-preview.png` | ~2 minutes, and it multiplies every other link you or anyone else posts. Do it before anything that generates shares. |
| 2 | Post Show HN (§1) | `https://news.ycombinator.com/submit` | Largest single-event ceiling available. Needs your login; the copy is ready and its reads expire fast, so re-run `## Verify before posting` first. |
| 3 | Post to one subreddit (§2) | r/LocalLLaMA (or r/selfhosted with the §2 wording swap) | Same shape as HN, slower burn, and the self-hosters there are the audience that actually installs. One post, not a cross-post sweep. |
| 4 | Sign up and file the news item (§0d) | `https://changelog.com/news/submit` | Three fields. Their page says submitting your own work is encouraged, so this is a legitimate door rather than a favour. |
| 5 | Click the checkbox and fill the form (§0f) | `https://openalternative.co/submit` | I am not solving a machine-refusal challenge for you; their GitHub list (6,747★) is generated from this one submission. |
| 6 | Send one message to selfh.st (§0e) | `selfhst@fosstodon.org` | The closest audience of the whole list. No form exists; it is a message. |

Two of these (2 and 3) are worth the time even if nothing else is. If you do only one
thing this week, do #2 — that is the conclusion the data on every other channel
supports, not a preference.

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
> <tag>`. Behind it: deterministic local prompt enhancement that makes no provider call,
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
> the MCP tool roster the image really exposes — no Docker daemon, no API key. Docker
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
  token budgets, exact and semantic response cache, append-only audit chain, and reverse
  MCP governance that turns upstream MCP servers and OpenAPI 3 operations into
  allow-listed tools. The published image's tool roster is verifiable without installing
  it.

Fill the "alternative to" field with the hosted gateway SaaS it actually replaces in a
stack. Do not name a specific vendor we have not compared against — a directory entry that
claims parity is a claim someone will hold us to.

---

### 0g. Republish the registry description (the one fix that multiplies)

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
| 有没有人在等我们回答 | **31 扇开放门全读（每扇最近 100 条评论，0 扇读不到）＝没有任何一条人类评论在等我们回话**。这条现在是仪器的一节（`check` 报告里的 "Whether a human has asked us something"），不再靠手抄门清单——手抄那份今天漏掉了当天新开的 6 扇。⚠ 顺带抓到 `shiftbot` 的账号类型是 `User`（它自己写 "I am a robot"），所以机器人只能按登录名形状判，不能信 `user.type` | `node tools/star-growth-check.mjs check` |
| Topic 版面位（20 个已满，只能换不能加） | 现读排名（`search/repositories?q=topic:X&sort=stars`，名次＝页内 index+1）：**`prompt-enhancement` 20 个仓里第 7**、**`token-budget` 110 个里第 11**、`agent-governance` 832 个里第 97；`mcp-security`／`llm-observability`／`codex-cli` 不在前 100。而被换掉的 5 个（`llm` 139,369 个仓、`openai` 46,145、`ai-agents` 98,911、`anthropic`、`gemini`）实测**全部进不了前 100**＝零曝光。⇒ 这轮交换的净收益是"从五个看不见的位置换来一个看得见的位置"（另三个是语义正确但暂时不上首页的描述词），不是流量保证。回滚＝一次 `PUT /topics`，把这 5 个新词（`codex-cli`／`mcp-security`／`agent-governance`／`llm-observability`／`token-budget`）换回被删的 5 个（`gemini`／`anthropic`／`openai`／`llm`／`ai-agents`），两边都记在本行里，不依赖任何未跟踪文件。⚠ 别用浏览器读 topic 页来判"在不在"：未登录时 `github.com/topics/*` 返回登录外壳，`article` 选择器取到 0 条＝**仪器瞎**，名次必须用 API 判 | `gh api …/topics` + 排序检索 |
| 使用回报表 | `usage-verification-report.yml` 存在且 URL 可解析，但**被用过的次数 0** | `.github/ISSUE_TEMPLATE/` + label 查询 |
| 浏览器登录态 | 现读 **未登录 GitHub 网页**：访问 `/settings/admin` 被 302 到 `/login?return_to=…`，页面有登录表单，`meta[name=user-login]` 为空串 ⇒ 「分享卡上传、Changelog News 注册、selfh.st 会员消息、Turnstile 勾选」这四件确实只能你本人；`gh` 的 token 只覆盖 API 面（清单/目录 PR、Release、Registry 流水线我都做得动），不带你的人机登录态 | 浏览器同源探测，含正对照靶：若已登录该 meta 应是 `happy520ai` |
| 贡献台 | `good first issue` 开 2 个、`help wanted` 开 3 个（新加 #166 站点安全页、#167 soak 分母修复，都带验收清单） | label 查询 |
| 别人替我们保管的副本（**这才是今天真正的问题面**） | 逐个读"我们合并过的 PR 改了哪些文件"，发现四处仍在外发旧数字/旧指令，纠正全部已提交且都是极小 diff：`hashgraph-online/awesome-ai-plugins#479`（README 一行，删数字不换成 15；其 `validate-plugins.yml` step 名就是 "Sync marketplace artifacts with README" ⇒ JSON 会自己重生成，不碰）、`toolsdk-ai#552`（其机器可读条目把安装镜像钉在 **`mcp-server:0.4.8`**＝五个月前 9 工具镜像）、`up-for-grabs#6176`（`_data/projects/unified-ai-system.yml` 仍写 nine）、**`sickn33/agentic-awesome-skills#1616`（46.9k★，vendored 我们的 SKILL.md，里面写 "If the nine tools are already visible, skip setup"／"nine tools are available" ⇒ 读者按 15 配好后被这份文件告知自己配错了，是会误导操作的缺陷不是文案问题。同一张分支还改了它自己手写的 README 行（去掉数字；他们 CONTRIBUTING 的生成物清单只有 `CATALOG.md`/`skills_index.json`/`data/*.json`，README 不在其中 ⇒ 我最初把 README 当成生成物排除掉是判断错，已在这条 PR 正文里公开更正））**，以及 `agentskillexchange/skills#82`（自动摘要写 "nine bounded tools"，一行）。四扇守卫读数会随合并自己变绿，不需要任何人去问 | 判据＝我方 roster 现读 15 与 `verify-image-roster.mjs 0.8.0`；⚠ 一次"按含我们名字的行筛"的快速普查把 up-for-grabs 误判成 ok（数字与项目名常常不在同一行）⇒ **只有整文件载体算证据，临时脚本不算** |
| 技能目录/Skill registry 族（2026-09-26 普查，**一族全部不收，理由要留下**） | 这一族当天全部在 1 小时内被 push，非常活：`VoltAgent/awesome-openclaw-skills` 52.8k★（**前置**：只收已发布到 ClawHub 的技能，条目必须带 `clawhub.ai/<owner>/<slug>` 链接）、`tech-leads-club/agent-skills` 6.8k★（24/30 合并；要求新技能必须走他们仓内的 `skill-architect` 流程 + 固定描述结构 + Snyk Agent Scan）、`davepoon/buildwithclaude` 3.5k★（22/30 合并，今天；只收 **Claude 插件**下的 `plugins/all-skills/skills/<name>/SKILL.md`）、`majiayu000/claude-skill-registry` 650★（CONTRIBUTING 原文 **"Do not submit normal source PRs here"**＝生成镜像）、`heilcheng/awesome-agent-skills` 6.2k★（30 条近期关闭 PR 合并 **0** 条 ⇒ 死队列）。**共同的不匹配**：我们官方技能 front matter 写 `tools: codex`、正文第 1 步是"确认已安装 Codex CLI 且 Docker 在跑"，全文零次提 Claude ⇒ 投进 Claude/OpenClaw 专用索引就是替我们声称一个没实现也没文档的主机支持。**能改变这件事的只有一步，而且是你的**：`clawhub login`（GitHub OAuth，非 git 通道）后发布我们的技能到 ClawHub，得到 `clawhub.ai/happy520ai/unified-ai-gateway`，之后 VoltAgent 那张 52.8k★ 的表才允许一条带该链接的 PR ⇒ 值得的只有这条，其余四条要改技能本体或换主机声明，那是产品决定不是推广动作。 | 逐个读 README/CONTRIBUTING 原文（`gh api …/contents/CONTRIBUTING.md`）＋队列活度实测；⚠ 我第一次用管道串了一个未闭合字符类（`grep -vE "^[?"`）⇒ 那一轮两个仓都返回空，那是无效读数不是"没有规则"；`gh search repos --json` 的星数键名是 `stargazersCount`（试 `stars`/`stargazerCount` 都会报错并回显被截断的可用字段列表），默认表格输出反而可用 |
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
