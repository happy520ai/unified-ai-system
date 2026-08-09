# Daily Star Growth Checklist

Use this runbook for one tight, reproducible promotion cycle.

## Morning

- [ ] Run `pnpm growth:campaign` to refresh metrics and keep the structured Usage Report funnel current.
- [ ] Capture one baseline output from `docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.3 pnpm gateway demo`.
- [ ] Pick one template from `docs/community-promotion-pack.md` or `docs/growth-post-templates.md`.
- [ ] Write one explicit ask for feedback, including OS and one output line.
- [ ] If you already have a new report, run `pnpm growth:feedback` or `pnpm growth:evidence-pack`.

## Publishing

- [ ] Publish one English post with the command and repo link.
- [ ] Publish one Chinese or community post with the same proof.
- [ ] Keep the ask technical and short.

## Response Loop

- [ ] Reply to technical comments within 24 hours.
- [ ] Ask one concrete follow-up question when the comment is valid.
- [ ] Save one output snippet or screenshot and create/update a `usage-verification-report` issue.
- [ ] If feedback reveals a pain point, create or update a repo issue or PR.

## Weekly Closeout

- [ ] Run `pnpm growth:feedback`.
- [ ] Run `pnpm growth:evidence-pack`.
- [ ] Run `pnpm growth:sync-thread`.
- [ ] Review `docs/star-growth-latest.md` and `docs/star-growth-feedback.md`.
- [ ] Update:
  - `docs/star-growth-evidence-pack.md`
  - `docs/star-growth-dashboard.md`
- [ ] Publish one short progress note with what changed, what users reported, and the next step.

## Health Metrics

- [ ] Weekly star delta stays visible in `docs/star-growth-latest.md`.
- [ ] At least one user result is collected each week.
- [ ] At least one fix or doc update comes from feedback each week.
- [ ] Response rate for technical comments stays above 80% within 24 hours.
