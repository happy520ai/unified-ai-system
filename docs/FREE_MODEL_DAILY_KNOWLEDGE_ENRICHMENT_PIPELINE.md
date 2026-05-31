# Free Model Daily Knowledge Enrichment Pipeline

## Executive Summary

Phase 278A seals a local preview for a free-model-assisted daily knowledge enrichment pipeline. It defines policy, rate and time budgets, source trust, duplicate guards, near-duplicate review, and an enrichment ledger without running real learning.

## Local Preview Boundary

This phase is local-preview-only. It writes policy and evidence, but performs no real learning, no real provider call, and no real scheduler execution.

## Free Model Only Policy

The policy is free-model-only. Even the free-model path is not called in this phase; it is represented as future metadata behind manual approval.

## No Paid API Boundary

No paid API is called. `paidApiCallCount` remains `0`, and paid providers remain out of scope.

## No MiMo Boundary

MiMo is not called, not used for enrichment, and not set as any default path.

## No Embedding Boundary

No embedding API is called. The preview uses deterministic local metadata and text hashes only.

## No External Provider Call Boundary

No external provider is called. The pipeline does not send project context, public knowledge, prompts, or candidate text outside the local process.

## Daily Learning Policy

The daily learning policy is a future local-preview contract: collect candidate items, check source trust, clean data, run duplicate guards, record ledger entries, and wait for manual approval before any real run is considered in a later phase.

## Rate Limit Policy: 40 requests/min

The policy records a rate limit of `40 requests/min` for a future free-model-assisted path. No requests are made in Phase 278A.

## Daily Time Budget Policy: 2 hours/day

The policy records a daily budget of `2 hours/day` for future enrichment. Phase 278A does not start a timer or background worker.

## Source Trust Rules

Candidate knowledge requires a source trust score of at least `0.70`, attribution, freshness metadata, and a recognized source category.

## Authority / Professional Source Requirements

Preferred sources include official docs, academic or standards sources, government or public institutions, recognized references, and verified public knowledge fixtures. Unknown or low-trust sources are rejected.

## Clean Data Requirements

Candidate data must be sanitized before ledger or import preview. Secret-like content, unclean text, and raw provider secrets are rejected.

## Private Knowledge Duplicate Guard

Private project knowledge is checked first. Anything already present in private project evidence or project knowledge is not learned again.

## Public Knowledge Duplicate Guard

Public knowledge already present in the public library is not learned again.

## Current Batch Duplicate Guard

Duplicates inside the current enrichment batch are rejected before they can enter the preview ledger as accepted items.

## Near Duplicate Guard

Near duplicates are not auto-imported. They become `review_required` metadata and require manual review.

## Enrichment Ledger

The local preview ledger records candidate id, source, trust score, novelty decision, acceptance status, review requirement, and manual approval state. It does not record provider outputs because no provider is called.

## Manual Approval Scheduler

The scheduler mode is `manual-approval-required`. Phase 278A does not enable a real automatic scheduler.

## Evidence and Verification

Evidence is written to:

- `apps/ai-gateway-service/evidence/phase-278a-free-model-daily-knowledge-enrichment.json`
- `apps/ai-gateway-service/evidence/phase-278a-free-model-daily-knowledge-enrichment.md`

Verification command:

```powershell
cmd /c pnpm run verify:phase278a-free-model-daily-knowledge-enrichment
```

## Non-Production Claim Boundary

This is not production-ready, not a production scheduler, not a production knowledge training system, and not a proof that all future source pollution or duplication risks are solved.

## Final Phase 278A Conclusion

Phase 278A provides a bounded local preview for daily knowledge enrichment policy, duplicate safety, and ledger evidence. It does not call paid APIs, MiMo, embeddings, external providers, real schedulers, or real learning jobs.
