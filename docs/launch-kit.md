# Launch Kit

This page is the shortest path from a clean clone to a public visibility loop.
It keeps the workflow factual: verify first, post once, collect one output line, then improve the repo from that feedback.

## Core Links

- Repo: `https://github.com/happy520ai/unified-ai-system`
- Project site: `https://happy520ai.github.io/unified-ai-system/`
- Documentation: [docs/README.md](README.md)
- Community promotion pack: [docs/community-promotion-pack.md](community-promotion-pack.md)
- Growth post templates: [docs/growth-post-templates.md](growth-post-templates.md)
- Usage verification issue template: [`.github/ISSUE_TEMPLATE/usage-verification-report.yml`](../.github/ISSUE_TEMPLATE/usage-verification-report.yml)

## 30-Minute Loop

1. Generate the current local campaign snapshot:

```bash
pnpm growth:campaign
```

The snapshot is written under the ignored `.tmp/growth/` directory. It records
current repository and promotion status without adding a metrics ledger to the
public product tree.

2. Publish one English post and one Chinese or community post using the copy packs.
3. Ask for OS + one output line, and keep the ask explicit.
4. Submit OS + one output line through the structured Usage Report. The
   maintainer launch thread (`#20`) is a snapshot channel, not a substitute
   for an independent community report.
5. Turn one repeated pain point into a repo improvement.

## Zero-Budget Human Test Loop

Use this loop before submitting to another directory or publishing another
announcement. It is designed to measure real use, not automated discovery
traffic.

1. Choose one audience and one concrete promise, such as “turn a rough request
   into a reviewable coding prompt in 60 seconds.”
2. Invite ten people who plausibly have that problem. Ask for one actual run,
   not a Star or a repost.
3. Count a tester only when they complete the browser Prompt Lab or the
   provider-free Docker demo and can report the operating system plus one
   observed result.
4. After a successful run, invite the tester to Star the repo and share the
   reproducible result. Never present a directory submission, clone, or bot
   visit as user adoption.
5. If ten invitations produce no runs, revise the audience or message before
   changing product code. If three people report the same friction, fix that
   friction and publish the verification command.

Suggested first message:

```text
Could you run this once and tell me whether the output is useful on your OS?
It needs no API key and exits after the local verification:

docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.7.0 pnpm gateway demo "Build a small API for my team" --enhance --profile coding --evidence

I am looking for one real result, not a promotional repost.
```

Track only four numbers for this loop: invitations, completed runs, useful
feedback reports, and external Stars. Keep the snapshot outside the public
product tree.

## What To Keep Visible

- The 60-second command
- `execution: fake`
- The repo URL
- One clear ask for output and OS

## Notes

- Keep claims factual.
- Do not claim AGI, L5, or production readiness.
- Prefer one small reproducible proof over a large marketing post.
- The scheduled growth sync updates the single managed comment marked
  `<!-- unified-ai-system-growth-thread -->` in Issue #20; it creates one only
  when the marker does not exist.
