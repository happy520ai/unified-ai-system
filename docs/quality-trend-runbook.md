# Quality Trend Runbook

Use this runbook when trend signals indicate drift or instability in CI, scheduled trend jobs, or PR observability review.

## 0) Quick severity map

- `status: stable`
  - Action: proceed, but keep trend context for ongoing monitoring.
- `status: unstable-warning` / `status` includes `unstable`
  - Action: treat as warning; do immediate regression triage before merge.
- `status: unstable-critical` or `severity: critical`
  - Action: hard stop for merge/release until evidence is captured and risk is remediated.

When `blocked: true`, block the change and create a fix ticket for unstable root cause.

## 1) Immediate checks (first 15 minutes)

1. Open CI trend artifacts:
   - `.tmp/quality-trend-summary.md`
   - `.tmp/quality-trend-guardrail.json`
   - `.tmp/quality-trend-digest.json`
   - `.tmp/quality-trend-check.json`
2. Confirm which gate failed:
   - `guardrail state` and `checks` fields in guardrail JSON.
   - `trendState`, `unstableReasons`, and `recommendation` in digest/check JSON.
3. Check quality verification payload:
   - `.tmp/quality-ci-verification.json` for the first failing gate.
4. Compare latest two scorecards:
   - `pnpm quality:trend-summary -- --trend .tmp/quality-trend.json --output .tmp/quality-trend-summary.md --guard-output .tmp/quality-trend-guardrail.json`.

## 2) Remediation matrix

- Unstable with consecutive failures:
  - Investigate commit set covering latest runs.
  - Rerun `pnpm quality:ci -- --json --require-score <threshold> --require-trend-health`.
- Single-run sharp score drops:
  - Inspect check-by-check changes between latest scorecards.
  - Check dependent service/environment changes and revert if regression is external.
- Pass-rate drop:
  - Search first failing gate timeline in `quality-ci-verification.json` and identify recurring failure class.
  - Add focused fix and re-run `pnpm quality:trend-log`, `pnpm quality:trend-summary`, `pnpm quality:trend-digest`, `pnpm quality:trend-check`.

## 3) Roll-forward criteria

- `blocked` returns to `false`.
- Latest check result is `stable` or non-critical (`warning` allowed only if allowed by policy).
- Latest run passes `pnpm quality:ci -- --json --require-score <threshold> --require-trend-health`.
- Run trend-validated artifact verification:
  - `pnpm quality:verify-artifacts -- --json --quality .tmp/quality-scorecard.json --drill .tmp/circuit-recovery-drill-dry-run.json --require-score <threshold> --require-trend-health`.
- PR summary references `.tmp/quality-trend-check.json` rationale and remediation evidence.

## 4) Operational escalation

- If critical stability drift persists across 2+ runs:  
  - Pause merge queue admission and open incident note with trend artifacts attached.
- If warnings persist for 3+ runs without improving:
  - Add hardening tasks to next iteration and adjust thresholds only with engineering review.

## 5) Command cheatsheet

```bash
pnpm quality:trend-summary -- --trend .tmp/quality-trend.json --output .tmp/quality-trend-summary.md --guard-output .tmp/quality-trend-guardrail.json
pnpm quality:trend-digest -- --trend .tmp/quality-trend.json --output .tmp/quality-trend-digest.md --json-output .tmp/quality-trend-digest.json
pnpm quality:trend-check -- --digest .tmp/quality-trend-digest.json --guardrail .tmp/quality-trend-guardrail.json --summary .tmp/quality-trend-summary.md --json
pnpm quality:trend-check -- --digest .tmp/quality-trend-digest.json --guardrail .tmp/quality-trend-guardrail.json --summary .tmp/quality-trend-summary.md --max-summary-reasons 8 --hard-block
pnpm quality:ci -- --json --require-score 165 --require-trend-health
pnpm quality:verify-artifacts -- --json --quality .tmp/quality-scorecard.json --drill .tmp/circuit-recovery-drill-dry-run.json --require-score 165 --require-trend-health
```


