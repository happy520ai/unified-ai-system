# Phase576A System Architecture Current State Audit

## Verified Current State

The current system is an internal Mission Control dry-run prototype for AI Gateway evaluation. It is not a production launch, not a real provider scheduler, and not a deployed multi-tenant SaaS.

Phase574R and Phase574R-2 established the sample dry-run interaction path: first-screen sample entry, explicit start action, result panel, and detail drawer. Phase574R-3 exists as a compatibility guard for the `listApprovals` initialization failure risk, but local port 3100 can still be stale if an older service is already running.

## Architecture Finding

Workforce must be a separate domain. It should not be added as more runtime logic inside `consolePage.js`, and it must not copy AI Gateway routing, provider selection, credential handling, or `/chat-gateway/execute` behavior.

## Required Split

- Position Library: source-backed classification seed, not runtime employees.
- Employee Library: virtual expert role instances, not a complete global workforce.
- Employee Brain Adapter: dry-run preview through a Gateway boundary, not direct provider calls.
- Workforce Scheduler: controlled fanout, budget, timeout, approval, and evidence.

## Boundary

No provider calls, no secret reads, no deploy, no billing, no invoice, no character module restoration, and no claim that all world jobs are covered.
