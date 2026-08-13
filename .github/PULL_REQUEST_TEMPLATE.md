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
- [ ] Production, L5, and AGI claims remain evidence-based.
- [ ] If trend guardrails are enabled, `.tmp/quality-trend-guardrail.json` was inspected and any `issues` are explained in the PR body.
- [ ] If trend gate is unstable, `.tmp/quality-trend-summary.md` and `.tmp/quality-ci-verification.json` were reviewed for root-cause evidence.
