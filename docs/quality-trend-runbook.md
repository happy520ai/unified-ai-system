# Quality Trend Runbook

Use this runbook when trend signals indicate drift or instability in CI, scheduled trend jobs, or PR observability review.

## 0) Evidence index (first 2 minutes)

For immediate triage, the minimum evidence set is:

- From CI workflow `quality`:
  - `.tmp/quality-scorecard.json`
  - `.tmp/circuit-recovery-drill-dry-run.json`
  - `.tmp/quality-ci-verification.json`
  - `.tmp/quality-trend-verify-artifacts.json`
  - `.tmp/quality-trend-health-smoke.json`
  - `.tmp/quality-trend-summary.md`
  - `.tmp/quality-trend-digest.json`
  - `.tmp/quality-trend-check.json`
  - `.tmp/quality-trend-recommendations.md` (if smoke failed)
  - `.tmp/quality-trend-incident-bundle.md`
  - `.tmp/quality-trend-incident-bundle.json`
  - `.tmp/language-policy-check.json`
  - `.tmp/language-policy-expiry.json`

- From workflow `quality trend snapshot`:
  - `.tmp/quality-trend-health-smoke.json`
  - `.tmp/quality-trend-summary.md`
  - `.tmp/quality-trend-guardrail.json`
  - `.tmp/quality-trend-digest.md`
  - `.tmp/quality-trend-digest.json`
  - `.tmp/quality-trend-check.json`
  - `.tmp/quality-trend-incident-bundle.md`
  - `.tmp/quality-trend-incident-bundle.json`
  - `.tmp/quality-trend-verify-artifacts.json`
  - `.tmp/language-policy-check.json`
  - `.tmp/language-policy-expiry.json`

If any required file is missing after a failed run, treat evidence completeness as a blocker and rerun with artifacts enabled.

## 0.1) Quick severity map

- `status: stable`
  - Action: proceed, but keep trend context for ongoing monitoring.
- `status: unstable-warning` / `status` includes `unstable`
  - Action: treat as warning; do immediate regression triage before merge.
- `status: unstable-critical` or `severity: critical`
  - Action: hard stop for merge/release until evidence is captured and risk is remediated.
- `status: degraded` (trend consistency gap when trend health is not strictly required)
  - Action: keep running CI, attach remediation tasks, and monitor next run; treat as warning in incident bundle and smoke output.
- `trendConsistency.hasMissingRequired === true` or `trendConsistency.hasNotCollected === true`
  - Action: in compatibility mode this is warning-grade (`degraded`); in strict trend-health mode this is fail-grade (`fail`).

Quick rule:
`degraded` is expected in compatibility mode when consistency data is incomplete; `fail` is expected when trend-health is required.

When `blocked: true`, block the change and create a fix ticket for unstable root cause.

### Language policy issue-code mapping (trend-check inputs)

- `language_policy_exception_expired`: one or more exceptions are past `removalBy`.
- `language_policy_missing_evidence`: language-policy exception missing `pr` or `issueId`.
- `language_policy_missing_migration_plan`: language-policy exception missing `migrationPlan` or migration metadata.
- `language_policy_artifact_missing`: language-policy artifacts are unavailable in the trend run.
- `language_policy_violation_blocked`: JS files in `apps/*` or `packages/*` blocked by policy (non-allowed files/extensions).
- `language_policy_exception_near_expiry`: exception is inside the warning window and approaching `removalBy`.
- `language_policy_allowlist_warning`: legacy allowlist form or non-blocking warning conditions.

## 1) Immediate checks (first 15 minutes)

1. Open CI trend artifacts:
   - `.tmp/quality-trend-summary.md`
   - `.tmp/quality-trend-guardrail.json`
   - `.tmp/quality-trend-digest.json`
   - `.tmp/quality-trend-check.json`
   - `.tmp/quality-trend-recommendations.md` (if smoke failed)
   - `.tmp/quality-trend-incident-bundle.md` / `.tmp/quality-trend-incident-bundle.json` (if smoke failed)
  - `.tmp/language-policy-check.json`
  - `.tmp/language-policy-expiry.json`
2. Confirm which gate failed:
   - `guardrail state` and `checks` fields in guardrail JSON.
   - `trendState`, `unstableReasons`, and `recommendation` in digest/check JSON.
   - Follow the prioritized command list in `.tmp/quality-trend-recommendations.md` when present.
3. Check quality verification payload:
   - `.tmp/quality-ci-verification.json` for the first failing gate.
4. Compare latest two scorecards:
   - `pnpm quality:trend-summary -- --trend .tmp/quality-trend.json --output .tmp/quality-trend-summary.md --guard-output .tmp/quality-trend-guardrail.json`.

### 1.1) 3-minute operator triage with incident bundle

- Open `.tmp/quality-trend-incident-bundle.md` and confirm:
  - `Failure phase`
  - `Final trend status` and `Final trend severity`
  - `Failed steps` section
  - `Trend reasons` section
  - `Artifacts` coverage includes bundle and verification files
- Open `.tmp/quality-trend-incident-bundle.json` and confirm:
  - `schemaVersion === 1`
  - `trendHealth.blocked === false` (or document why it is expected)
  - `trendConsistency.checksRequired` includes:
    - `trendDigestHealth`
    - `trendSummaryGuardrails`
    - `trendDigestCheckConsistency`
  - `trendConsistency.hasMissingRequired` and `trendConsistency.hasNotCollected` match the actual check list state and status.
  - `trendConsistency.requiresTrendHealth` reflects current smoke mode.
  - `artifacts` list has `quality-trend-digest.json`, `quality-trend-check.json`, and `quality-scorecard.json` records.
- Open `.tmp/quality-ci-verification.json` and confirm:
  - `trendConsistency.status` is expected to be:
    - `pass` in strict trend-health mode (`--require-trend-health` runs), or
    - `pass`/`degraded` in default compatibility mode when evidence is incomplete.
  - `trendConsistency.checks.trendDigestHealth`, `trendConsistency.checks.trendSummaryGuardrails`, and `trendConsistency.checks.trendDigestCheckConsistency` are present with object payload.
  - `trendConsistency.ok` must be true in strict trend-health mode. In compatibility mode, `trendConsistency.status === "degraded"` is acceptable as warning-only behavior, surfaced through `quality_trend_consistency_degraded` in issue codes.
  - Under `--require-trend-health`, none of those trend-consistency checks may be `status: "not_collected"`.
  - Correlate `.tmp/quality-ci-verification.json` `issueCodes` with incident bundle `Extracted issues` to ensure no high-severity trend-consistency regression is lost.
  - Re-check `.tmp/quality-trend-check.json` after any local fix to confirm `blocked` clears.

### 1.2) Trend-consistency field trace table

- `trendConsistency.checksRequired`
  - Primary source: `.tmp/quality-ci-verification.json`
  - Should include: `trendDigestHealth`, `trendSummaryGuardrails`, `trendDigestCheckConsistency`
- `trendConsistency.status`
  - Source: `.tmp/quality-ci-verification.json` (propagated from quality trend checks)
- `trendConsistency.ok`
  - Source: `.tmp/quality-ci-verification.json`
- `trendConsistency.issueCodes` / `trendConsistency.issueCodeSummary`
  - Source: `.tmp/quality-ci-verification.json` normalized from check outputs
- `trendConsistency.hasMissingRequired` / `trendConsistency.hasNotCollected`
  - Source: `.tmp/quality-ci-verification.json` strictness flags
- `trendConsistency.requiresTrendHealth`
  - Source: `.tmp/quality-ci-verification.json` run mode flag (`--require-trend-health`)

## 2) Remediation matrix

- Unstable with consecutive failures:
  - Investigate commit set covering latest runs.
- Rerun `pnpm quality:ci:trend-health -- --json --require-score <threshold>`.
- Single-run sharp score drops:
  - Inspect check-by-check changes between latest scorecards.
  - Check dependent service/environment changes and revert if regression is external.
- Pass-rate drop:
  - Search first failing gate timeline in `quality-ci-verification.json` and identify recurring failure class.
  - Add focused fix and re-run `pnpm quality:trend-log`, `pnpm quality:trend-summary`, `pnpm quality:trend-digest`, `pnpm quality:trend-check`.

## 3) Roll-forward criteria

- `blocked` returns to `false`.
- Latest check result is `stable` or non-critical (`warning` allowed only if allowed by policy).
  - In compatibility smoke (`--no-trend-health` path), a `degraded` trend-consistency status is acceptable as warning-only behavior.
- Latest run passes `pnpm quality:ci:trend-health -- --json --require-score <threshold>`.
- Run trend-validated artifact verification:
  - `pnpm quality:verify-artifacts:trend-health -- --json --quality .tmp/quality-scorecard.json --drill .tmp/circuit-recovery-drill-dry-run.json --require-score <threshold>`.
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
pnpm quality:ci:trend-health -- --json --require-score 165
pnpm quality:verify-artifacts:trend-health -- --json --quality .tmp/quality-scorecard.json --drill .tmp/circuit-recovery-drill-dry-run.json --require-score 165
```

### 6) One-shot trend health smoke

Run a single command to execute CI trend-health quality gate, write verification evidence,
append trend history, and regenerate summary/digest/check artifacts:

```bash
pnpm quality:trend-health-smoke -- --require-score 165
```

To skip trend history append for dry local checks: add `--no-trend-log`.
To include structured output for CI-like automation: add `--json`.


