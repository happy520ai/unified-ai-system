# Star Growth Evidence Pack

Use this file as the single source of truth for public growth evidence.

## Repository Snapshot

- Repository: https://github.com/happy520ai/unified-ai-system
- Snapshot date: 2026-08-09
- Source of truth: `gh api repos/happy520ai/unified-ai-system --jq ...`

## Current Public Signals

- Stars: 3
- Forks: 1
- Subscribers: 0
- Open issues (non-PR): 1
- Open pull requests: 0
- Latest release: v0.4.3
- MCP official registry entry: [v0.4.3](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.happy520ai%2Funified-ai-system/versions/0.4.3)

## How We Prove Growth

We only publish evidence we can reproduce:

- 60-second demo command output
- one week-over-week metric snapshot
- one usage verification report
- one fix or clarification based on feedback
- one outbound channel update
- one feedback table refresh: `docs/star-growth-feedback.md`

Update command:

```sh
pnpm growth:campaign
```

or:

```sh
pnpm growth:feedback
```

For evidence-pack maintenance:

```sh
pnpm growth:evidence-pack
```

## Weekly Evidence Checklist

1. Run:

   ```sh
   pnpm growth:campaign
   ```

2. Save one fresh command output or screenshot.
3. Run `pnpm growth:feedback` if there is new feedback to record.
4. Run `pnpm growth:evidence-pack` after you have a fresh update to append.
5. Save the updated values from `docs/star-growth-check.md` in this file.
6. Post one short status update with the current repo metrics and one next action.
7. Close the loop on any pending comments from community posts.

## Weekly Status Log

### 2026-08-03

- Issue #20 opened as the public verification thread.
- Campaign updates were published to keep the repo entry point visible.

### 2026-08-08

- Current public snapshot verified at 3 stars / 1 fork / 0 subscribers / 4 open issues / 4 open PRs.
- The public thread remains open for reproducible output and follow-up feedback.

### 2026-08-09

- Latest public snapshot verified at 3 stars / 1 fork / 0 subscribers / 2 open issues / 0 open PRs.
- Submitted the public MCP listing to [awesome-mcp.tools](https://awesome-mcp.tools/submit); review is tracked in [adw0rd/awesome-mcp-servers#36](https://github.com/adw0rd/awesome-mcp-servers/issues/36).
- Submitted the public MCP listing to [MCP Hub](https://www.aimcp.info/en/submit); the form confirmed successful submission and review pending. No contact email or subscription was provided.
- Submitted the public MCP listing to [mcpservers.org](https://mcpservers.org/submit) using the free plan; the form confirmed successful submission and stated that review is expected within 12 hours. No premium plan or payment was selected.
- Fresh local baseline: `pnpm gateway demo` returned `execution fake`, `real calls disabled`, and `[done] 29 ms | no API key | process cleaned up`; the output is also recorded in [issue #20](https://github.com/happy520ai/unified-ai-system/issues/20).
- Refreshed public onboarding Discussions [#1](https://github.com/happy520ai/unified-ai-system/discussions/1), [#5](https://github.com/happy520ai/unified-ai-system/discussions/5), [#6](https://github.com/happy520ai/unified-ai-system/discussions/6), and [#23](https://github.com/happy520ai/unified-ai-system/discussions/23) to `v0.4.1`; verification found no remaining `v0.4.0` references in those four bodies.
- Released `v0.4.2` with the one-command `--enhance` demo, aligned Docker tags, and matching MCP Registry metadata.
- Released `v0.4.3` with explicit CLI enhancement language control, the PowerShell JSON evidence path, aligned fixed images, and matching MCP Registry metadata.
- The latest growth campaign tracks 12 external collection PRs: 11 open and 1 closed. The open set is [awesome-codex-skills#206](https://github.com/composio-community/awesome-codex-skills/pull/206), [awesome-cli-apps#347](https://github.com/toolleeo/awesome-cli-apps-in-a-csv/pull/347), [Awesome-LLMOps#710](https://github.com/tensorchord/Awesome-LLMOps/pull/710), [awesome-mcp-devtools#257](https://github.com/punkpeye/awesome-mcp-devtools/pull/257), [awesome-mcp-servers-devops#65](https://github.com/WagnerAgent/awesome-mcp-servers-devops/pull/65), [Awesome-MCP-ZH#422](https://github.com/yzfly/Awesome-MCP-ZH/pull/422), [awesome-mcp-servers#11745](https://github.com/punkpeye/awesome-mcp-servers/pull/11745), [TensorBlock/awesome-mcp-servers#1616](https://github.com/TensorBlock/awesome-mcp-servers/pull/1616), [awesome-ai-tools#1941](https://github.com/mahseema/awesome-ai-tools/pull/1941), [docker/mcp-registry#4584](https://github.com/docker/mcp-registry/pull/4584), and [up-for-grabs#5995](https://github.com/up-for-grabs/up-for-grabs.net/pull/5995). The campaign snapshot classifies 8 as CLEAN and 3 as BLOCKED; [agentic-awesome-skills#1073](https://github.com/sickn33/agentic-awesome-skills/pull/1073) is closed. None is counted as a merge or Star result.
- Submitted [agentic-awesome-skills#1115](https://github.com/sickn33/agentic-awesome-skills/pull/1115) from the maintainer-owned fork to clarify that the current public release is `v0.4.3` while preserving the reviewed immutable `v0.4.0` image digest and security-review commit. All required upstream checks passed; the PR is open and mergeable, pending maintainer review. It is not counted as a merge or Star result.
- Submitted [awesome-llm-agents#296](https://github.com/kaushikb11/awesome-llm-agents/pull/296) with one current, self-disclosed entry for the MCP and governed-workflow gateway. The target list had 1,559 stars at submission time, and the PR is open and mergeable; it is not counted as a merge or Star result.
- Submitted [awesome-llm-skills#207](https://github.com/Prat011/awesome-llm-skills/pull/207) with one self-disclosed external link to the existing `unified-ai-gateway` Codex skill. The target list had 1,450 stars at submission time; the PR is open/mergeable and its GitGuardian check passed, but it is not counted as a merge or Star result.
- Refreshed the bodies of [awesome-codex-skills#206](https://github.com/composio-community/awesome-codex-skills/pull/206), [awesome-cli-apps#347](https://github.com/toolleeo/awesome-cli-apps-in-a-csv/pull/347), [Awesome-LLMOps#710](https://github.com/tensorchord/Awesome-LLMOps/pull/710), [awesome-mcp-devtools#257](https://github.com/punkpeye/awesome-mcp-devtools/pull/257), [awesome-mcp-servers-devops#65](https://github.com/WagnerAgent/awesome-mcp-servers-devops/pull/65), and [up-for-grabs#5995](https://github.com/up-for-grabs/up-for-grabs.net/pull/5995) from `v0.4.0` to `v0.4.3`; live checks found no remaining `0.4.0` body references. [docker/mcp-registry#4584](https://github.com/docker/mcp-registry/pull/4584) was initially excluded from that automatic rewrite because its patch explicitly pinned an older source commit; it was then refreshed separately below.
- Refreshed [docker/mcp-registry#4584](https://github.com/docker/mcp-registry/pull/4584) in the maintainer-owned fork: its catalog file now pins current master commit `70eb951e`, its body links the `v0.4.3` release and current Registry workflow, and the YAML now ends with a newline. The PR remains open/mergeable and is not counted as a merge or Star result.
- Latest maintenance snapshot: 3 stars / 1 fork / 0 subscribers / 2 open issues / 0 open PRs. Dependabot PR #12 was superseded by merged PR #49; PR #13 remains closed because better-sqlite3 13 requires Node >=22 while the project supports Node 20.
- Rewrote `README.zh-CN.md` from mojibake into a UTF-8 quickstart aligned with the verified English entrypoint, and added a public-repository guard against invalid Chinese README encoding.
- Added a GitHub Codespaces one-click entry to both README languages, backed by the existing provider-free devcontainer and public-clone verification path.
- GitHub traffic snapshot for the available 14-day window: 150 repository views / 34 unique visitors and 879 clones / 218 unique cloners. Top referrers were `github.com` (48 views / 13 uniques) and `happy520ai.github.io` (18 views / 2 uniques). These are exposure signals, not verified Star growth.
- Refreshed the public `v0.4.2` release notes with the 60-second provider-free command, Codespaces and prompt-guide links, Issue #20 feedback, and a verified-use Star CTA; no runtime or version change was made.
- Repaired the public `v0.3.3` and `v0.4.1` release entrypoints so historical pages clearly direct new users to the current `v0.4.3` quickstart; no runtime or version change was made.
- Added [good first issue #58](https://github.com/happy520ai/unified-ai-system/issues/58) for a provider-free PowerShell JSON example and linked it from both README languages, creating a concrete newcomer contribution path.
- Opened [good first issue #91](https://github.com/happy520ai/unified-ai-system/issues/91) for a provider-free first-run troubleshooting matrix and linked it directly from `CONTRIBUTING.md`; this creates a current, scoped contribution path without changing runtime behavior.
- Added the same superseded-release notice to [v0.4.2](https://github.com/happy520ai/unified-ai-system/releases/tag/v0.4.2), while retaining its historical commands and verification links; this repairs a high-traffic discovery path without changing any tag or runtime behavior.
- Implemented the provider-free PowerShell JSON enhancement example requested by [issue #58](https://github.com/happy520ai/unified-ai-system/issues/58), including explicit `providerCalled`, `credentialRequired`, and `deterministic` evidence fields.
- Cleaned the public [Issue #20](https://github.com/happy520ai/unified-ai-system/issues/20) by removing 14 duplicate or outdated maintainer comments; verification left 11 current comments and zero `v0.4.0`, `v0.4.1`, or stale Issue #44 matches.
- Updated the high-reach [awesome-mcp-servers#11745](https://github.com/punkpeye/awesome-mcp-servers/pull/11745) entry from `mcp-server:0.4.1` to `mcp-server:0.4.2`; its upstream submission check passed, while the PR remains open and is not counted as a merge or Star result.
- Updated the high-reach [awesome-mcp-servers#11745](https://github.com/punkpeye/awesome-mcp-servers/pull/11745) entry from `mcp-server:0.4.2` to `mcp-server:0.4.3`; its upstream submission check passed, while the PR remains open and is not counted as a merge or Star result.
- Added explicit CLI `--language` control for `enhance`, `chat --enhance`, and `demo --enhance`, covering `auto`, `zh-CN`, and `en`; this is a user-facing capability improvement, not Star-growth evidence.
- Synchronized public Discussions [#1](https://github.com/happy520ai/unified-ai-system/discussions/1), [#5](https://github.com/happy520ai/unified-ai-system/discussions/5), [#6](https://github.com/happy520ai/unified-ai-system/discussions/6), and [#23](https://github.com/happy520ai/unified-ai-system/discussions/23) to v0.4.3; a live scan found zero stale v0.4.0/v0.4.1/v0.4.2 or old container-tag references.
- Published the dependency-free Node.js prompt-enhancement path in [Issue #20 comment](https://github.com/happy520ai/unified-ai-system/issues/20#issuecomment-5229116145) after PR #77 merged; this is a verified outreach action, not a community report or Star-growth result.
- Published a follow-up onboarding update in [Issue #20 comment](https://github.com/happy520ai/unified-ai-system/issues/20#issuecomment-5229222664) linking the live Go good-first issue and requesting reproducible user output; this is a verified outreach action, not a community report or Star-growth result.
- Published a consolidated bilingual `v0.4.3` onboarding update in [Discussion #23](https://github.com/happy520ai/unified-ai-system/discussions/23#discussioncomment-17948446) with the current Node.js and Chinese CLI paths; this is a verified outreach action, not a community report or Star-growth result.
- Normalized the public [v0.4.3 Release notes](https://github.com/happy520ai/unified-ai-system/releases/tag/v0.4.3) from literal `\\n` escapes to rendered Markdown line breaks and retained the current Node.js onboarding CTA; the immutable tag and runtime were unchanged.
- Submitted the public project to the [DeepYard directory](https://deepyard.dev/submit) under `MCP Servers`; the public Formspree endpoint returned `302 Found` to `/thanks`. This confirms form receipt only; listing approval and any Star change remain unverified.
- Submitted the public project to the [AgentNDX MCP directory](https://agentndx.ai/submit/) with the public GitHub URL, Pages homepage, and `MCP` protocol; the public form returned `302 Found` to `/submit?success=1`. No contact email or paid placement was used; indexing, review, and any Star change remain unverified.
- Fresh public discovery audit: the [AgentNDX registry API](https://agentndx.ai/api/servers.json) has no `happy520ai` match, and the public pages for [mcpservers.org](https://mcpservers.org/), [MCP Hub](https://www.aimcp.info/en/), and [awesome-mcp.tools](https://awesome-mcp.tools/) do not currently expose this repository. These remain submission/review states, not verified listings or Star growth.
- Replaced the closed README contribution link to Issue #75 with [good first issue #81](https://github.com/happy520ai/unified-ai-system/issues/81) for a dependency-free Go prompt-enhancement example, then implemented it in merged [PR #89](https://github.com/happy520ai/unified-ai-system/pull/89) and closed the issue; this is a user-facing capability improvement, not a Star-growth result.
- Added a direct no-install [browser Prompt Lab](https://happy520ai.github.io/unified-ai-system/#enhance) CTA to both README languages; the live Pages site returned `200` and exposed the enhancement section and generated browser engine. This improves first-run conversion but is not a Star-growth result.
- Added bilingual `Choose Your First Path` / `选择入口` blocks near the README entrypoints, routing visitors to the browser Prompt Lab, Docker demo, Codex/MCP quickstart, or good first issue #91; this targets the highest-traffic homepage path and is not counted as Star growth.
- Added a public-repository regression guard for Chinese browser-enhancer markers (`任务` and `代码`) so generated encoding drift fails `pnpm check:public` instead of reaching the public site.
- Added standard `CITATION.cff` metadata and bilingual README links so researchers and technical writers can cite the v0.4.3 project accurately; this improves long-term discoverability but is not a Star-growth result.
- 2026-08-09 public snapshot: 3 stars / 1 fork / 0 subscribers / 2 open issues; no verified Star increase since the prior snapshot. The browser Prompt Lab, Codespaces path, official MCP Registry entry, and external collection PRs remain discoverability routes, not Star results until independently observed.
- Added `docs/first-run-troubleshooting.md` and linked it from both README entrypoint lists and `CONTRIBUTING.md`; it covers Docker, port, PowerShell, provider-free, MCP reload, and network fallback paths without changing runtime behavior.
- Closed [good first issue #91](https://github.com/happy520ai/unified-ai-system/issues/91) after publishing the baseline matrix, then opened [good first issue #92](https://github.com/happy520ai/unified-ai-system/issues/92) for shell-specific troubleshooting transcripts; the newcomer path remains open and scoped.
- Added the Chinese counterpart `docs/first-run-troubleshooting.zh-CN.md` and linked it from the Chinese README and documentation index, keeping the provider-free safety boundaries and current commands aligned with the English page.
- Updated the non-JSON terminal demo to show the next prompt-enhancement command and a conditional project Star link after a successful provider-free run; JSON output and gateway behavior remain unchanged, and both normal and enhanced demos were verified locally.
- Repaired the live contributor entrypoints in both README languages and `CONTRIBUTING.md` to point to open [good first issue #92](https://github.com/happy520ai/unified-ai-system/issues/92) instead of the completed #91; historical evidence entries remain unchanged.
- Moved a provider-free, one-command verification and its conditional Star/feedback CTA into the first-screen section of both README languages; the detailed 60-second walkthrough remains below, and this is a conversion improvement rather than evidence of Star growth.
- Refreshed the repository growth campaign snapshot and corrected the dashboard's stale open-issue count from 1 to the live value of 2; Stars remain 3 and no Star increase is claimed.
- Added sanitized PowerShell, Bash/Zsh, and Codespaces first-run transcripts in both troubleshooting pages; Issue #92 remains open for independent environment reports and follow-up improvements.
- Posted one maintainer follow-up on each new external catalog PR, linking current provider-free verification evidence and inviting list-specific wording or category corrections; these are review nudges, not merges or Star results.

## Monthly Update Template

```text
## YYYY-MM-DD

## Repo
- Stars: <count>
- Forks: <count>
- Subscribers: <count>

## Evidence
- External mentions: <links / channels>
- Reproducible outputs received: <count>
- User stories collected: <count>
- Code/docs changes shipped from feedback: <count>

## Actions
- Next priority:
- Blockers:
```

## Where to publish updates

- GitHub Discussion, if available
- Project Issues / discussion in this repo
- One technical community thread in English or Chinese
