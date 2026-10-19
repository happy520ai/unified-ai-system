# ADR-014 Outbound doors: respond to the automation-signal label by reducing volume, not by disguising activity

- 日期: 2026-09-29
- 状态: 已接受

## 背景

The promotion campaign has 30 open outbound pull requests across awesome lists, registries and documentation repos, all waiting on human reviewers. On 2026-09-29T05:55Z a real maintainer (MikeMcC399) reviewed nodejs/docker-node#2636 by citing a third-party scanner, agentscan.tools, which reports three activity signals for happy520ai: active in 24 of 24 hours with a longest break of 0.7h; 8 of 9 fork branches followed by an upstream PR within 68 seconds; 6 repositories forked inside a single 24-hour window. All three accurately describe the agent's real behaviour. The maintainer said he would tend to decline and asked instead for a short note in the existing node-gyp section.

## 决定

Keep opening outbound doors only when a specific reviewer-shaped gap exists, and never try to evade or disguise the automation signals. Concretely: (1) disclosure remains the first line of every outbound text, with no attempt to look human-authored - engineering sleep schedules or delaying already-prepared PRs to change a detector's reading would be deception for persuasive effect; (2) reshape a door to the reviewer's requested shape rather than defend the original, which was done here (+20/-0 became +7/-0, moved under the multistage example in node-gyp alpine, validated with the repo's own prettier and doctoc chain); (3) every outbound claim must be re-checkable in place by the reviewer, and effort now goes to the 30 existing doors plus owner-gated channels rather than new ones.

## 后果

Accepted cost: the remaining door-opening rate drops, so any star growth from catalog exposure slows, and some of the 30 doors may still be declined on this basis - the campaign's ceiling now sits with owner-run channels (launch posts, v0.8.1, npm publish, topic placement, pinned discussion) rather than with agent-submitted listings. Rejected alternative: spacing actions out to look human, or removing the disclosure language - both would be detection evasion aimed at persuading maintainers under false pretences, and would also invalidate the reason three carriers merged us in the first place (disclosed, verifiable work). Another rejected option was arguing with the scanner's reading; it is accurate, so the only honest move was to change what is done, not what is said about it.
