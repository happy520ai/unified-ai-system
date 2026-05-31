# Phase576A Brain Adapter And Distributed Scheduler

## Brain Adapter

Employee brain bindings are preview-only. The default mode is `dry_run`; the future Gateway adapter mode remains `gateway_adapter_preview` and requires approval before any real provider call.

## Scheduler

The scheduler must enforce:

- `maxCandidateEmployees <= 5`
- `maxActiveEmployees <= 3`
- `maxBrainCalls = 0`
- per-employee timeout
- global timeout
- evidence required
- provider call approval required

## Evidence

Every dry-run selection must record why employees were selected or rejected, what policy limited fanout, and why no provider call occurred.
