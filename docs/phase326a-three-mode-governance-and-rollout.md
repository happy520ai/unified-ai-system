# Phase326A Three Mode Governance And Rollout

## Current Stage

Phase326A is limited to:

- `design_only`
- `contract_draft`

It does not enter:

- shadow_config runtime
- real non-NVIDIA call
- production enablement
- God Mode runtime
- Tianshu Mode runtime

## Stage 1: design_only

- entry criteria: product mode concept is approved for documentation
- allowed actions: write design docs, define boundaries, describe user-owned model library dependency
- forbidden actions: runtime changes, provider calls, UI enablement
- evidence requirements: design documents and execution report
- rollback trigger: design conflicts with current provider governance
- exit criteria: design docs reviewed and JSON draft planned

## Stage 2: contract_draft

- entry criteria: design_only docs exist
- allowed actions: create JSON contract draft and parse-check it
- forbidden actions: load the contract in runtime, route requests by mode, modify selectable gate
- evidence requirements: JSON parse check and safety report
- rollback trigger: contract implies enabled runtime or permits secret values
- exit criteria: contract draft validates and remains design_only

## Stage 3: shadow_config

- entry criteria: later explicit phase authorizes non-runtime config examples
- allowed actions: create non-routing config samples
- forbidden actions: live provider credential reads, route eligibility, Workbench switches
- evidence requirements: shadow config validation evidence
- rollback trigger: config can affect runtime behavior
- exit criteria: dry-run design is approved

## Stage 4: dry_run_without_provider_call

- entry criteria: shadow_config cannot affect runtime
- allowed actions: simulate mode selection, model selection, and governance decisions
- forbidden actions: provider calls, paid API fallback, selectable mutation
- evidence requirements: dry-run evidence with `providerCalled=false`
- rollback trigger: any attempted provider call
- exit criteria: dry-run decisions are auditable and deny-by-default

## Stage 5: internal_test_with_nvidia_only

- entry criteria: explicit later phase authorizes NVIDIA-only internal mode tests
- allowed actions: small NVIDIA-only internal smoke or simulation
- forbidden actions: OpenAI, Claude, OpenRouter, MiMo, or unauthorized provider calls
- evidence requirements: NVIDIA-only evidence and main-chain verifier
- rollback trigger: Chat Gateway regression, provider failure, completion verification failure
- exit criteria: internal NVIDIA-only test passes without changing production provider assumptions

## Stage 6: guarded_user_owned_provider_test

- entry criteria: user-owned provider credential boundary is implemented and approved in a later phase
- allowed actions: guarded test using explicit user-owned credentials
- forbidden actions: platform-supplied paid fallback, unapproved model use, broad beta enablement
- evidence requirements: approval record, budget guard, audit trace, provider smoke evidence
- rollback trigger: budget breach, secret exposure risk, route regression
- exit criteria: narrow user-owned provider test passes

## Stage 7: limited_beta

- entry criteria: guarded user-owned provider test passes
- allowed actions: limited user group and explicit mode policy testing
- forbidden actions: global default enablement, hidden paid provider use
- evidence requirements: success metrics, failure metrics, audit samples, rollback drill
- rollback trigger: reliability, cost, safety, or UX regression
- exit criteria: beta readiness review passes

## Stage 8: production_enablement

- entry criteria: product, security, provider governance, and rollback readiness are approved
- allowed actions: explicit production enablement for approved users and modes
- forbidden actions: unaudited provider access, missing credential guard, unverified model routing
- evidence requirements: production readiness pack, security review, SLA boundary, rollback plan
- rollback trigger: provider incident, cost anomaly, safety incident, unacceptable quality regression
- exit criteria: monitored production operation meets governance thresholds

## Stage 9: rollback

- entry criteria: rollback trigger fires or operator requests rollback
- allowed actions: disable mode, deny routes, remove mode policy, preserve evidence
- forbidden actions: delete failure evidence, hide incidents, use git reset or git clean as default
- evidence requirements: rollback report and post-rollback verifier
- rollback trigger: not applicable
- exit criteria: affected mode disabled and verifier chain passes

