# Phase 285A Product Console UX Hardening

## Executive Summary

Phase 285A turns the current engineering-heavy console into a clearer product console for local use, review, and demonstration. It adds a Chinese / bilingual product entry, plain-language capability cards, non-claimable capability warnings, next-action guidance, a safety boundary panel, and a demo / product explanation entry.

This phase does not add runtime provider capability, does not call any model, and does not change the default provider route.

## Product Console Goal

The goal is to make the first screen understandable to a non-engineer while preserving the existing advanced engineering panels for evidence, verifier, phase, and readiness details.

## User-Facing UX Principles

- Put plain-language product status before engineering phase details.
- Show what the system can do before showing verifier history.
- Show what the system cannot claim yet in the same first-screen area.
- Keep safety boundaries visible and concrete.
- Keep advanced engineering details accessible but secondary.

## Chinese / Bilingual Copy Strategy

The primary console entry uses Chinese first, with English labels where helpful:

- AI 总控台 / Unified AI Gateway Console
- 当前系统能做什么 / What the system can do
- 当前系统还不能承诺什么 / What the system cannot claim yet
- 下一步建议 / Next actions
- 风险与边界 / Safety boundaries
- 高级工程信息 / Advanced engineering view

## Homepage Information Architecture

The homepage now has a product-oriented entry above the detailed chat and engineering panels:

1. Product title and plain-language subtitle.
2. Capability explanation for normal users.
3. Non-claimable capability warnings.
4. Next action guidance.
5. Safety boundary status.
6. Demo / product explanation entry.
7. Advanced engineering panel links remain available below.

## Business-Friendly Capability Explanation

The console explains that the system can help observe AI Gateway status, provider / routing / cost boundaries, local knowledge previews, evidence chains, safety boundaries, next-step suggestions, and local runtime checks.

This is a product explanation entry only. It is not a customer quote, not a sales promise, and not a production deployment claim.

## What The System Can Do

- View unified AI Gateway status.
- Observe provider, routing, and cost boundary metadata.
- Preview local knowledge enrichment and public knowledge import flows.
- Review evidence and verifier chains.
- Review safety boundaries.
- See recommended next tasks.
- Check local runtime health and readiness.

## What The System Cannot Claim Yet

- It cannot claim production-ready.
- It cannot claim real release completed.
- It cannot claim remote deploy completed.
- It cannot claim automatic knowledge learning is live.
- It cannot claim paid API / MiMo / embedding is default-enabled.
- It cannot claim workspace clean unless git status proves clean.

## Safety Boundary Presentation

The UI now surfaces these boundary facts in plain text:

- Paid API called: false
- MiMo called: false
- Embedding called: false
- External provider called: false
- legacy modified: false
- PROJECT_CONTEXT.md created: false
- commit performed: false
- push performed: false
- production ready claimed: false

## Next Action Guidance

The product entry recommends:

1. 人工确认 commit
2. Phase 286A Product Deep Optimization Roadmap
3. Phase 287A Modular Architecture Refactor First Cut
4. Phase 289A Deployment and Runtime Stability Hardening

These are recommendations only. This phase does not automatically enter any next phase.

## Demo Mode / Sales Mode Guidance

The demo / product explanation entry is for showing the local preview state, capability boundaries, and next steps. It must not be presented as a real commercial deployment, remote release, paid provider execution, or production-ready system.

## Engineering Advanced Panel Boundary

Existing phase / evidence / verifier / readiness panels are preserved. They are still available as the advanced engineering view, but they should not be the first thing a normal user must understand.

## No Production-Ready Claim Boundary

Phase 285A is UI productization and copy hardening only. It does not prove production readiness, release readiness, remote deployment readiness, security certification, or commercial delivery readiness.

## Final Phase 285A Conclusion

Phase 285A provides a clearer Chinese / bilingual product console entry while preserving the advanced engineering panels. No paid API, MiMo, embedding, external provider, release, deploy, commit, or push is performed.
