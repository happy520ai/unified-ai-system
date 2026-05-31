# Phase567 Mission Control Internal Trial Readiness Checklist

## Purpose

Prepare Mission Control for a human internal trial after Phase566 real Chromium browser QA. This checklist tells internal testers what to open, what to inspect, what to report, and what must not be tested in this phase.

## Baseline

- Phase564A: 3D Yiyi hidden.
- Phase564B: 2D / character / companion UI hidden.
- Phase565: Core Mission Control product function audit sealed.
- Phase566: Real Chromium browser QA sealed.
- Current UI: pure AI Gateway / Mission Control / Normal / God / Tianshu / Security Shield / Evidence Replay / Provider-CredentialRef product surface.

## Trial Path Checklist

### Path 1: Open Mission Control

Checks:

- The page clearly reads as AI Gateway / multi-model control gateway.
- The first screen explains Mission Control without character framing.
- No Yiyi, avatar, companion, character, or persona visual module is visible.
- The page does not show mojibake or developer placeholder text.

Pass criteria:

- The tester can explain the product as an AI Gateway Workbench after one minute.

### Path 2: Understand Three Modes

Checks:

- Normal Mode is understood as single-model direct chat.
- God Mode is understood as multi-model review / supervisor synthesis.
- Tianshu Mode is understood as task routing / model combination planning.
- The UI clearly says candidate / dry-run / guarded path.
- The tester does not think real multi-provider execution is already online.

Pass criteria:

- The tester can describe when they would use Normal, God, and Tianshu.

### Path 3: Review Provider / CredentialRef

Checks:

- The tester understands they must configure their own provider key in a future authorized flow.
- The tester understands the UI refers to credentialRef only.
- The tester understands the page must not reveal secret values.
- Provider unconfigured state is understandable.

Pass criteria:

- The tester does not paste or expect real secrets during this phase.

### Path 4: Review Security Shield

Checks:

- The tester understands protection areas: Prompt Injection, Secret Leak, Provider Call Gate, Dangerous Action Lock, Approval Gate, Quota / Budget Guard.
- The tester understands this is an internal guarded product path, not a completed production security audit.
- Blocked action language is understandable.

Pass criteria:

- The tester can describe what Security Shield blocks and what it does not guarantee.

### Path 5: Review Evidence Replay

Checks:

- The tester understands evidence / trace / replay as internal validation material.
- The tester understands evidence package is local/internal.
- The tester does not interpret it as external upload or production audit completion.

Pass criteria:

- The tester can find Evidence Replay and explain why trace / replay matters.

### Path 6: Provider Unconfigured / Fallback State

Checks:

- Provider not configured is clearly explained.
- UI does not pretend provider connected.
- UI does not trigger providerCallsMade.
- UI does not show billing or invoice as active.

Pass criteria:

- The tester understands no provider call happened.

### Path 7: Error State Expectations

Checks:

- Provider unconfigured should lead to clear fallback.
- Missing credentialRef should not expose secrets.
- Candidate path should not execute as production.
- Dry-run result should be labeled as dry-run.
- Blocked action should explain the block reason.
- Fallback reason should be visible.

Pass criteria:

- The tester can tell whether a result is completed, blocked, fallback, or dry-run.

## Stop Conditions

Stop the trial and record feedback if any of the following appear:

- Character / companion UI is visible.
- A real provider call is attempted without explicit authorization.
- A secret value is shown.
- A deploy / release / tag / artifact upload action appears.
- Billing or invoice appears enabled.
- The UI claims production GA.
- The tester cannot distinguish dry-run from real execution.

## Safety Boundary

- no-provider-call
- no-secret
- no-deploy
- no-billing
- no-invoice
- Yiyi / character remains hidden
- chat gateway runtime unchanged
