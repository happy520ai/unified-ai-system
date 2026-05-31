# Phase2031-2032-GVC-Low-Risk-Autonomous-Mutation

## Goal

Enable a bounded low-risk autonomous mutation path for GVC. This phase allows real writes only inside a narrow allowlist and proves that mutation plans, mutation evidence, verifier execution, rollback, and forbidden-path blocking work.

This is not a Provider bridge, deployment bridge, chat route bridge, or production readiness claim.

## Phase2031 Approval

Owner approval is recorded in:

```text
docs/approvals/gvc-low-risk-autonomous-mutation-approval.json
```

The approval scope is `low_risk_only`. It allows docs, evidence, verifier, non-core UI, and package script changes while keeping Provider, secret, deploy, chat route, legacy, and `PROJECT_CONTEXT.md` changes blocked.

## Phase2032 Executor

The executor is:

```text
tools/gvc/low-risk-autonomous-executor.mjs
```

It accepts a mutation plan with up to three `write_file` mutations per loop. Before writing, it validates:

- approval is present and approved
- mutation count is within `maxMutationsPerLoop`
- each path is inside the low-risk allowlist
- forbidden operations are absent
- Provider/secret/deploy/chat-route operations are blocked

## Allowed Write Scope

Allowed real writes are limited to:

- `docs/phase*.md`
- `apps/ai-gateway-service/evidence/**`
- `tools/gvc/**`
- `tools/phase*/**`
- `package.json` scripts
- non-core read-only UI panel files when separately classified as low risk

## Forbidden Scope

The executor blocks:

- `legacy/**`
- `PROJECT_CONTEXT.md`
- `.env`
- `auth.json`
- secret store paths
- `/chat`
- `/chat-gateway/execute`
- credential resolver or provider runtime core changes
- deploy/release scripts
- billing/payment paths
- git commit or push operations

Provider, secret, deploy, and chat-route changes are blocked by operation classification as well as path classification.

## Mutation Lifecycle

Each accepted run writes a mutation plan evidence file before applying changes. After writes, verifier commands run. If a verifier fails, the executor restores the pre-mutation file snapshots. Rollback failure is a hard blocker.

Each run writes mutation evidence with:

- plan id
- mutated files
- validation result
- verifier results
- rollback status
- Provider/secret/deploy/chat-route safety flags

## Verification

The verifier exercises:

- allowed low-risk docs/evidence/verifier writes
- mutation plan evidence generation
- mutation evidence generation
- rollback simulation after verifier failure
- forbidden `legacy/` path blocking
- Provider/secret/deploy/chat-route operation blocking

Command:

```powershell
pnpm run verify:phase2031-2032-gvc-low-risk-autonomous-mutation
```

This phase does not call a Provider, read secrets, deploy, modify `/chat`, modify `/chat-gateway/execute`, modify `legacy/`, modify `PROJECT_CONTEXT.md`, create commits, push, or claim workspace clean.
