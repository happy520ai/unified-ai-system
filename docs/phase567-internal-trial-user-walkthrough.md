# Phase567 Internal Trial User Walkthrough

## Purpose

This walkthrough is for human internal testers preparing to review Mission Control after Phase566 browser QA. It focuses on product understanding, guarded paths, and feedback quality. It does not ask testers to call providers, enter secrets, deploy, bill, invoice, or test production GA behavior.

## Baseline

- Phase564A hidden the former 3D visual module.
- Phase564B hidden the former 2D / character / companion module.
- Phase565 sealed the core product function audit.
- Phase566 sealed real Chromium browser QA.
- Current interface is the AI Gateway / Mission Control product surface with Normal, God, Tianshu, Security Shield, Evidence Replay, Provider, and CredentialRef guidance.

## Path 1: Open Mission Control

Steps:

1. Open the local Workbench UI.
2. Locate Mission Control on the first screen.
3. Read the first-screen product positioning.
4. Confirm the page reads as an AI Gateway / multi-model control gateway.

Checks:

- You can explain the product purpose in one minute.
- No Yiyi / character / companion visual module is visible.
- No avatar, 2D fallback, 3D placeholder, pseudo-3D, snowman, or blob wording is visible.
- No mojibake or developer placeholder text blocks the product message.

## Path 2: Understand Three Modes

Steps:

1. Review Normal Mode.
2. Review God Mode.
3. Review Tianshu Mode.
4. Compare when each mode should be used.

Expected understanding:

- Normal Mode means single-model direct chat.
- God Mode means multi-model review / supervisor synthesis.
- Tianshu Mode means task routing / model combination planning.
- Current paths are candidate / dry-run / guarded path unless explicitly marked otherwise.
- The UI must not imply real multi-provider execution is already online.

## Path 3: Review Provider / CredentialRef

Steps:

1. Open the Provider / CredentialRef guidance area.
2. Read how provider configuration is represented.
3. Confirm the screen uses credentialRef-only language.

Expected understanding:

- A tester should not paste real provider keys during this phase.
- Secret values must not be shown by the page.
- Provider unconfigured state should be clear.
- no-provider-call remains the boundary for this trial.

## Path 4: Review Security Shield

Steps:

1. Locate Security Shield.
2. Read each protection category.
3. Check whether blocked action language is understandable.

Expected understanding:

- Security Shield covers Prompt Injection, Secret Leak, Provider Call Gate, Dangerous Action Lock, Approval Gate, and Quota / Budget Guard.
- It is an internal guarded path, not a completed production security audit.
- no-secret and no-deploy remain active boundaries.

## Path 5: Review Evidence Replay

Steps:

1. Locate Evidence Replay.
2. Read how evidence, trace, and replay are described.
3. Confirm it feels like a product capability rather than a temporary debug panel.

Expected understanding:

- Evidence is local/internal validation material.
- Evidence Replay helps explain what happened, why it happened, and how to review it.
- It does not mean external upload, production audit completion, billing, invoice, or deployment.

## Path 6: Provider Unconfigured / Fallback State

Steps:

1. Review the unconfigured provider state.
2. Confirm the UI explains fallback behavior.
3. Confirm the page does not say the provider is connected.

Expected understanding:

- Provider unconfigured is a valid internal trial state.
- The page must not pretend a provider call occurred.
- no-provider-call, no-billing, and no-invoice remain explicit boundaries.

## Path 7: Error State Expectations

Use this path as a reading and interpretation check. Do not force real provider calls.

Expected states:

- Provider unconfigured: explain missing configuration.
- Missing credentialRef: explain missing reference without exposing secrets.
- Candidate not executable: explain guarded / preview-only state.
- Dry-run result: label as dry-run.
- Blocked action: explain the block reason.
- Fallback reason: show why fallback occurred.

## Completion Criteria

The internal trial walkthrough is successful when the tester can explain:

- What Mission Control is for.
- When to use Normal, God, and Tianshu.
- Why Provider / CredentialRef exists.
- What Security Shield protects.
- What Evidence Replay proves.
- Why no-provider-call, no-secret, no-deploy, no-billing, and no-invoice are required in this phase.
- Why Yiyi / character remains hidden.
