# Star Growth Dashboard

This repository keeps a weekly evidence loop for sustainable visibility:

- publish a reproducible 60-second demo,
- collect one real user result per cycle,
- record what changed in the repo,
- then post a short technical summary.

## Current Focus

- Project: `happy520ai/unified-ai-system`
- Repository: https://github.com/happy520ai/unified-ai-system
- Verified snapshot as of 2026-08-09: 3 stars / 1 fork / 0 watchers / 1 open issue / 4 open PRs
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

docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.1 pnpm gateway demo

No API key is required for the baseline check.
Repo: https://github.com/happy520ai/unified-ai-system
```

Chinese version:

```text
我在 60 秒内验证了 Unified AI System：

docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.1 pnpm gateway demo

默认使用本地 fake-provider，无需 API Key。
仓库：https://github.com/happy520ai/unified-ai-system
```

## Automation

- GitHub Action: [Star Growth Snapshot workflow](../.github/workflows/star-growth-snapshot.yml)
  - runs weekly on Monday UTC 02:00
  - emits `docs/star-growth-latest.md` / `docs/star-growth-daily.md` / `docs/star-growth-check.md` / `docs/star-growth-feedback.md`
- GitHub Action: [Star Growth Thread Sync workflow](../.github/workflows/star-growth-sync-thread.yml)
  - runs weekly on Monday UTC 04:00
  - refreshes launch-thread state on issue `#20`

This dashboard keeps outreach honest: every post maps to a generated artifact.
