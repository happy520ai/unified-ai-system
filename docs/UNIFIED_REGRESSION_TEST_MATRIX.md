# Phase 291A Unified Regression Test Matrix

## Executive Summary

Phase 291A creates a unified regression test matrix for the current local
workspace. It classifies checks by safety boundary, records which checks are
safe by default, which are local-preview only, which are external-risk, which
are manual-only, which are release-preflight, and which are not_available.

This phase does not call paid APIs, MiMo, embedding, or any real external
provider. It does not release, deploy, commit, or push. It does not claim the
workspace is clean and it does not claim production readiness.

## Regression Matrix Purpose

The matrix makes verifier usage explicit. It prevents accidental execution of
provider smokes, paid routes, release commands, deployment commands, or
manual-only runtime commands when the user only wants a safe local regression.

The default regression command is:

```powershell
cmd /c pnpm run verify:safe-regression-matrix
```

The command validates the matrix and checks safe/local-preview availability.
It does not execute external-risk or manual-only checks.

## Safe Default Checks

Safe default checks are suitable for normal local regression. They must not
call providers, paid APIs, MiMo, embedding, or require API keys.

Current safe-default examples:

- `cmd /c pnpm run verify:phase107a-secret-safety`
- `cmd /c pnpm run health:phase12a`
- `cmd /c pnpm run doctor:phase13a`
- `cmd /c pnpm -r --if-present check`

## Local Preview Checks

Local preview checks read local evidence, docs, scripts, or UI source. They
must not call providers or perform irreversible actions.

Current local-preview examples:

- `verify:phase278a-free-model-daily-knowledge-enrichment`
- `verify:phase281a-operational-readiness-decision-gate`
- `verify:phase282a-commit-readiness-preflight`
- `verify:phase283a-ui-release-readiness-preflight`
- `verify:phase284a-final-commit-package-clean-baseline-gate`
- `verify:phase285a-product-console-ux-hardening`
- `verify:phase286a-product-deep-optimization-roadmap`
- `verify:phase287a-modular-architecture-refactor-first-cut`
- `verify:phase288a-architecture-refactor-followup-cleanup`
- `verify:phase289a-deployment-runtime-stability`
- `verify:phase290a-provider-cost-free-model-governance`
- `verify:phase291a-unified-regression-test-matrix`

## External Risk Checks

External-risk checks may call real providers, paid APIs, MiMo, embedding, or
require secret-bearing environment variables. They are not part of default
regression and require explicit manual approval before any future execution.

Examples:

- `smoke:openai-route`
- `smoke:nvidia-route`
- `smoke:mimo-route`
- `smoke:mimo-paid-route`
- `discover:mimo-model-id`
- `calibrate:token-estimator`

For Phase 291A, external-risk / manual-only checks are not executed by
default.

Explicit marker: external-risk / manual-only checks are not executed by default.

## Manual Only Checks

Manual-only checks can affect the local runtime, start or stop long-running
processes, send GUI actions, or require explicit human approval.

Examples:

- `dev:phase7b`
- `stop:phase9c`
- `restart:phase11a`
- `codex:loop:once`
- `codex:desktop:send:once`

These commands are not run by the safe regression matrix.

## Release Preflight Checks

Release-preflight checks may be useful before a real release, but this phase
does not perform any real release, remote deploy, push, publish, artifact
upload, or workflow trigger.

Examples:

- `verify:phase117a-cicd-release-gate`
- `verify:phase118a-remote-cicd-gate-preflight`
- `verify:phase131a-release-artifact-preflight`
- `verify:phase132a-release-decision-pack`

Release-preflight commands require a separate human decision.

## Not Available Checks

The matrix records missing scripts as `not_available`. A missing script is not
a failure by itself in this phase, but it is also not a pass.

Important rule: skipped is not passed, and not_available is not passed.

## Environment Variable Requirements

Safe-default and local-preview checks must not require provider credentials.

External-risk checks may require environment variables such as
`OPENAI_API_KEY`, `NVIDIA_API_KEY`, `MIMO_API_KEY`, or `XIAOMI_API_KEY`.
Those checks are excluded from default regression and must not print or write
secret values to evidence, logs, docs, or UI.

## No Provider Call Boundary

Phase 291A does not call real providers. It does not call paid APIs, MiMo, or
embedding. It does not send project context to an external provider. It only
builds and verifies a local regression matrix.

## Daily Check Recommendation

The daily safe path is:

```powershell
cmd /c pnpm run verify:safe-regression-matrix
cmd /c pnpm run verify:phase107a-secret-safety
cmd /c pnpm run health:phase12a
cmd /c pnpm run doctor:phase13a
cmd /c pnpm -r --if-present check
```

The safe matrix records external-risk and manual-only commands as skipped.

## Release Preflight Recommendation

Before a real release, first run the safe daily path. Then manually decide
whether release-preflight commands are appropriate. Do not run provider smokes,
paid routes, release, deploy, push, or workflow commands without explicit
approval and matching phase boundaries.

## Failure Handling

If a safe-default or local-preview check fails, fix the failing local issue
with the smallest possible change and rerun the failed item. If a command is
not_available, record it honestly and do not mark it as passed. If a command
is skipped, keep it skipped until a human explicitly approves a matching
manual or external-risk run.

## Final Phase 291A Conclusion

Phase 291A provides a unified regression matrix and a safe matrix verifier.
It improves regression discipline without changing provider routing, calling
providers, invoking paid APIs, starting real release/deploy activity, or
claiming production readiness.
