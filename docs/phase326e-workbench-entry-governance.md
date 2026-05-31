# Phase326E Workbench Entry Governance

## Mode Entry Enablement Conditions

- mode contract exists
- user mode policy exists
- user selectable model set exists
- credential reference boundary is implemented
- provider governance approves route use
- dry-run evidence exists
- rollback path exists

## User-Scoped Policy

Each user may have:

- mode policy
- selectableModels
- fallback chain
- provider budget policy
- provider allowlist and blocklist

## God Mode Governance

God Mode entry must show:

- participant count
- estimated cost risk
- estimated latency risk
- role assignment preview
- disabled reason if runtime is not enabled

## Tianshu Governance

Tianshu entry must show:

- task classification preview
- plannerDecision preview
- candidate model explanation
- rejection reason if no eligible model exists

## Entry States

- disabled
- hidden
- experimental
- shadow_config_only

Experimental entries should not be exposed by default.

## Rollback

Rollback deletes Phase326E shadow_config files. No runtime route or UI code rollback is needed.

