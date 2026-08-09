# Star Growth Dashboard

This repository keeps a weekly evidence loop for sustainable visibility:

- publish a reproducible 60-second demo,
- collect one real user result per cycle,
- record what changed in the repo,
- then post a short technical summary.

## Current Focus

- Project: `happy520ai/unified-ai-system`
- Repository: https://github.com/happy520ai/unified-ai-system
- Verified snapshot as of 2026-08-09: 3 stars / 1 fork / 0 subscribers / 4 open issues / 0 open PRs
- Growth status file: `docs/star-growth-latest.md`
- Feedback status file: `docs/star-growth-feedback.md`

## Daily Command Routine

1. Run growth pack refresh:

   ```bash
   pnpm growth:campaign
   ```

2. Post one English and one Chinese or community update.
3. Update the checklist and evidence pack with one concrete result.

Expected outputs:

- `docs/star-growth-latest.md`
- `docs/star-growth-daily.md`
- `docs/star-growth-check.md`
- `docs/star-growth-feedback.md`

## Weekly KPI

- Net stars growth stays positive over time.
- At least one verified user result is collected each week.
- Technical comments receive a reply within 24 hours.
- One feedback item turns into a repo improvement.

## Promotion Posting Block

Default content for one post cycle:

```text
I verified Unified AI System in 60 seconds:

docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.3 pnpm gateway demo "Build a small API for my team" --enhance --profile coding

No API key is required; the command shows the local prompt-enhancement path and exits cleanly.
Repo: https://github.com/happy520ai/unified-ai-system
```

Chinese version:

```text
我在 60 秒内验证了 Unified AI System：

docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.3 pnpm gateway demo "帮我为团队设计一个小型 API" --enhance --profile coding --language zh-CN

默认使用本地 fake provider，无需 API Key，并直接展示自然语言增强结果。
仓库：https://github.com/happy520ai/unified-ai-system
```

## Automation

- GitHub Action: [Star Growth Snapshot workflow](../.github/workflows/star-growth-snapshot.yml)
  - runs weekly on Monday UTC 02:00
  - emits `docs/star-growth-latest.md` / `docs/star-growth-daily.md` / `docs/star-growth-check.md` / `docs/star-growth-feedback.md`
- GitHub Action: [Star Growth Thread Sync workflow](../.github/workflows/star-growth-sync-thread.yml)
  - runs weekly on Monday UTC 04:00
  - refreshes the maintainer launch-thread snapshot on issue `#20`
  - does not count that thread as an independent community usage report

This dashboard keeps outreach honest: every post maps to a generated artifact.
