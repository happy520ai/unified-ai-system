# Phase3967A Owner Approval Gate For Real Provider Smoke

## Goal

Prepare an owner approval gate for a future one-shot real Provider smoke. This phase does not execute any real Provider call and does not read raw secrets.

## Approval Input

`docs/provider-smoke/owner-real-provider-smoke-approval.input.json`

The owner must explicitly set a future approval packet before any real smoke can run. The default template keeps `providerCallAllowed=false`.

## Current Decision

- providerSmokeApprovalGatePrepared=true
- providerSmokeExecutionAllowed=false
- blocker=owner_real_provider_smoke_approval_missing
- credentialRefOnly=true
- providerCallsMade=false
- secretRead=false
- deployExecuted=false

## Rollback

- Delete `tools/phase3967a/`.
- Delete `docs/phase3967a-owner-approval-gate-for-real-provider-smoke.md`.
- Delete `docs/provider-smoke/owner-real-provider-smoke-approval.input.json`.
- Delete `apps/ai-gateway-service/evidence/phase3967a-owner-approval-gate-for-real-provider-smoke/`.
- Restore package.json scripts and README/AGENTS managed block entries.
