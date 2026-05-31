# Phase2033-GVC-Timed-Runner-Autonomous-Mutation-Integration

## Goal

Connect the Phase2032 low-risk autonomous executor to the Phase2019 timed runner. When owner approval is present, the timed runner may execute at most one low-risk real mutation task per loop.

This keeps the timed runner manual-start only. It does not register a service, startup task, scheduler, Provider bridge, deploy bridge, or chat-route integration.

## Approval Gate

The runner reads:

```text
docs/approvals/gvc-low-risk-autonomous-mutation-approval.json
```

Real mutation is allowed only when `approved=true` and `scope=low_risk_only`. The approval must keep Provider, secret, deploy, chat-route, legacy, and `PROJECT_CONTEXT.md` modification permissions blocked.

## Runner Behavior

Per loop:

- `runner-control.json` is read first.
- `paused=true` writes idle evidence and does not mutate.
- `stopRequested=true` writes graceful shutdown evidence and does not mutate.
- L3 or approval-required tasks are skipped and recorded.
- At most one selected L0/L1/L2 task may produce a mutation plan.
- The mutation plan is passed to the Phase2032 executor.
- The executor writes plan evidence and mutation evidence.
- A verifier failure triggers rollback.
- Two consecutive failures stop the runner.

The default timed runner interval remains `30000` ms. `dailyLoopLimit` remains `500`; real autonomous mutation is additionally capped by `dailyRealExecutionLoopLimit=100`.

## Blocked Operations

The integration keeps these blocked:

- Provider calls
- raw secret reads
- deploy/release/tag/artifact upload/push/commit
- `legacy/`
- `PROJECT_CONTEXT.md`
- `/chat`
- `/chat-gateway/execute`
- credential resolver or provider runtime core changes
- billing/payment changes

## Verification

The Phase2033 verifier runs fixture scenarios for:

- three-loop test mode with at least one real low-risk mutation
- paused state with no mutation
- stopRequested graceful shutdown with no mutation
- forbidden path blocking
- rollback simulation
- Provider/secret/deploy/chat-route blocked flags

Command:

```powershell
pnpm run verify:phase2033-gvc-timed-runner-autonomous-mutation-integration
```

This phase does not call a Provider, read secrets, deploy, modify `/chat`, modify `/chat-gateway/execute`, modify `legacy/`, modify `PROJECT_CONTEXT.md`, commit, push, or claim workspace clean.
