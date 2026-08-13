# Issue-Code Contract for Quality Artifacts

This contract defines the structured issue fields that should be emitted by quality and public-verification scripts.

## Required output fields

Each script output should include:

- `issueCodes: Array<IssueCode>`
  - `code`: normalized machine-readable issue identifier
  - `severity`: one of `high`, `medium`, `low`, `info`, `unknown`
  - `message`: concise human-readable summary
  - `artifactPath`: optional path/URL related to the issue
  - `source`: origin script or component
- `issueCodeSummary`
  - `total`
  - `high`
  - `medium`
  - `low`
  - `info`
  - `unknown`
  - `blocking: totalHigh > 0`

Normalization guidance:

- `code` must be deterministic and slug-safe.
- `severity` should reflect gate impact; `high` must map to blocking behavior.
- Scripts should include empty arrays/objects when clean.

## Scripts currently required to emit issue output

- `tools/verify-ci-quality-artifacts.mjs`
  - `issueCodes`
  - `issueCodeSummary`
  - `incidentBundle.issueCodes`
  - `incidentBundle.issueCodeSummary`
  - `checks.trendConsistency`
  - `checks.trendConsistency.status`
  - `checks.trendConsistency.checksRequired`
  - `checks.trendConsistency.hasMissingRequired`
  - `checks.trendConsistency.hasNotCollected`
  - `checks.trendConsistency.requiresTrendHealth`
- `tools/run-quality-ci-gate.mjs`
  - `issueCodes`
  - `issueCodeSummary`
  - `trendIncidentBundle.issueCodes`
  - `trendIncidentBundle.issueCodeSummary`
  - `trendConsistency.checks`
  - `trendConsistency.issueCodes`
  - `trendConsistency.issueCodeSummary`
- `tools/quality-scorecard.mjs`
  - `issueCodes`
  - `issueCodeSummary`
  - re-emits key script-level `issueCodes` from child verifications when parseable output is available
- `tools/quality-trend-summary.mjs`
  - `issueCodes`
  - `issueCodeSummary`
- `tools/quality-trend-check.mjs`
  - `issueCodes`
  - `issueCodeSummary`
- `tools/public-repo-check.mjs`
  - `issueCodes`
  - `issueCodeSummary`
- `tools/mcp-smoke.mjs`
  - `issueCodes`
  - `issueCodeSummary`
- `tools/verify-public-clone.mjs` (newly standardized)
  - `issueCodes`
  - `issueCodeSummary`

## Blocking policy

- `issueCodeSummary.blocking === true` must fail CI-like checks.
- `high` issues indicate high-priority regression risk.
- Incident handling teams should first classify by `code` and then triage by `severity`.
