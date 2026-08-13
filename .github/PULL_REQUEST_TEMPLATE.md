## Why

Describe the user or operator problem.

## What Changed

Summarize the focused implementation.

## Verification

List the commands and observable results used to verify the change.

```text
pnpm check
pnpm test
pnpm check:public
pnpm verify:public-clone
```

## Safety And Compatibility

Describe any impact on provider calls, credentials, permissions, cost,
deployment, public contracts, or migration behavior.

## Screenshots

Include terminal transcripts or before and after screenshots when visible
behavior changes.

## Checklist

- [ ] The default fake provider still works without credentials.
- [ ] No secret, token, private endpoint, or authorization record is included.
- [ ] Public behavior and documentation agree.
- [ ] Changes follow the module ownership policy (TypeScript-first for new work in
  apps/packages, Node.js ESM for tools, JSON/Markdown for schemas/docs).
- [ ] Language was selected via [Language Selection Playbook](docs/language-selection-playbook.md):
  workload profile, alternatives, compatibility impact, and migration/rollback scope are documented.
- [ ] Production, L5, and AGI claims remain evidence-based.
- [ ] If trend guardrails are enabled, `.tmp/quality-trend-guardrail.json` was inspected and any `issues` are explained in the PR body.
- [ ] If trend gate is unstable, `.tmp/quality-trend-summary.md` and `.tmp/quality-ci-verification.json` were reviewed for root-cause evidence.
- [ ] If `quality:trend-check` is enabled in CI, `.tmp/quality-trend-check.json` was reviewed and warnings/blocking are justified.
- [ ] If trend checks are blocked or warning, attach mitigation evidence in PR body (or link to `docs/quality-trend-runbook.md`) including `quality-trend-check.json` and summary artifacts.
