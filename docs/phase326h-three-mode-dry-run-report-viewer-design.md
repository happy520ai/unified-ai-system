# Phase326H Three Mode Dry-Run Report Viewer Design

## Purpose

Phase326H designs a future viewer for Normal / God / Tianshu dry-run reports.

This phase is design-only. It does not modify Workbench UI, `consolePage.js`, routes, or runtime mode behavior.

## Tabs

- Normal report tab
- God report tab
- Tianshu report tab

## God Mode Panels

- participantModels
- modelContributions
- disagreements
- resolvedConflicts
- supervisorDecision
- confidenceSummary
- auditTrace

## Tianshu Mode Panels

- taskClassification
- capabilityRequirements
- candidateModels
- plannerDecision
- selectedModels
- rejectionReason
- fallbackPlan
- auditTrace

## Safety Display

The viewer must make dry-run state visible:

- `providerCallsMade=false`
- `secretValueExposed=false`
- runtime stage is dry-run or design-only
- no user should mistake reports for real runtime execution

