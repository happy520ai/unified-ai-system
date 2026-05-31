# Phase326K Three-mode Dry-run Summary Dashboard Design

## Goal

Phase326K designs a future dashboard for summarizing Normal, God, and Tianshu dry-run outputs. It is design-only and does not modify the real Workbench UI.

## Dashboard Areas

1. Summary Cards: totalDryRuns, godModeDryRuns, tianshuDryRuns, providerCallsMade, nonNvidiaProviderCallsMade, secretValueExposed, blockedScenarios, warningCount.
2. God Mode Panel: participant selector summary, selected participants, scoring breakdown, supervisor pipeline status, and dry-run-only badge.
3. Tianshu Panel: capability index summary, indexed models, rejected models, planner decision summary, and dry-run-only badge.
4. Safety Panel: no provider call, no secret exposure, no runtime enabled, no non-NVIDIA call.
5. Evidence / Source Panel: source docs, source dry-run files, generatedAt, and missingSources.

## Runtime Boundary

- uiRuntimeEnabled=false
- providerCallsAllowed=false
- nonNvidiaProviderCallsAllowed=false
- secretValueAllowed=false
- no changes to consolePage.js
- no God or Tianshu runtime enablement
