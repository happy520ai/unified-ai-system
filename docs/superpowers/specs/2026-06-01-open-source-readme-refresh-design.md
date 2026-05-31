# Unified AI System Open-Source Readiness Refresh Design

## Background

The repository already has a documented dry-run-first, local-first, governance-aware posture through Phase606R and Phase607R. It can be cloned and inspected safely, but its public-facing presentation is still too internal, phase-heavy, and not polished enough for a formal open-source homepage.

The owner wants two things in this round:

1. Make the project more ready for open-source presentation.
2. Rewrite the README in a more polished, product-facing way.

This design keeps the existing safety posture intact. It does not claim deployment readiness, production readiness, or real Provider verification beyond evidence-backed statements already present in the repository.

## Goals

- Add a root `LICENSE` file using Apache-2.0.
- Add root open-source collaboration documents:
  - `SECURITY.md`
  - `CONTRIBUTING.md`
  - `CODE_OF_CONDUCT.md`
- Rewrite the public-facing portions of `README.md` into a bilingual Chinese/English structure.
- Keep the repository positioned as:
  - local-first
  - dry-run-first
  - governance-aware
  - not yet a deployed SaaS
- Preserve the existing README managed block and avoid breaking the current verifier chain.
- Add package metadata needed for a public GitHub repository while keeping `private: true` to avoid accidental npm publication.

## Non-Goals

- No public release execution.
- No deploy, release, tag, artifact upload, push, or commit.
- No full historical evidence scrub in this round.
- No secret discovery or `.env` inspection.
- No changes to `/chat`, `/chat-gateway/execute`, provider runtime, or `legacy/`.
- No claim that the repository is fully public-release ready beyond the documented dry-run/open-source-preflight posture.

## Repository Facts Used By This Design

- `README.md` already contains the managed block required by `sync:readme-agents-current-state`.
- `AGENTS.md` already contains the managed agent rules block.
- `package.json` currently sets `"private": true`.
- `.env` is ignored and not tracked; `.env.example` and `.env.enterprise.example` are tracked.
- Phase607R already records real public blockers:
  - missing license file
  - missing security policy
  - missing contributing guide
  - evidence local path scrub still required
  - public README polish still required

## Proposed Approach

### Option A: Minimum patch

Add only `LICENSE` and a small README intro refresh.

Pros:
- Lowest risk.
- Fastest to land.

Cons:
- Still reads like an internal engineering repository.
- Does not solve missing open-source collaboration files.

### Option B: Open-source readiness refresh

Add the missing root collaboration files, improve package metadata, and substantially rewrite the public-facing README while preserving the managed block.

Pros:
- Best balance of polish, safety, and effort.
- Solves the visible public blockers that are safe to solve in this round.
- Improves trust and readability for GitHub visitors.

Cons:
- Still leaves historical evidence scrub for a later phase.

### Option C: Full public-release prep

Do Option B plus deeper evidence/path/screenshot scrubbing and broader public packaging work.

Pros:
- Strongest public-repo posture.

Cons:
- Too broad for this round.
- Higher risk of colliding with historical evidence and previously recorded blockers.

### Recommendation

Use Option B.

It solves the owner's request directly, stays inside the existing verified boundaries, and does not overreach into high-risk historical cleanup or release preparation.

## File-Level Design

### 1. `LICENSE`

Create a root Apache License 2.0 text file.

Why:
- Removes the Phase607R license blocker.
- Matches the owner's explicit choice.
- Supports commercial use better than a narrower copyleft approach.

### 2. `SECURITY.md`

Create a concise security policy that covers:
- supported disclosure channel using GitHub Issues only for non-sensitive reports
- instruction not to post secrets publicly
- instruction to redact logs and endpoints
- note that real provider execution is not the default path
- note that this repo should not be treated as deployed production infrastructure

The document must not promise an enterprise-grade vulnerability response SLA.

### 3. `CONTRIBUTING.md`

Create a contributor guide aligned with the project's existing hard boundaries:
- do not modify `legacy/`
- do not expose `.env`, secrets, or credential values
- do not change default `/chat` behavior for public-readiness work
- do not run real Providers by default
- run the project verification scripts before claiming completion
- preserve README/AGENTS managed block sync

This file should point contributors to safe dry-run-first workflows instead of generic "just open a PR" language.

### 4. `CODE_OF_CONDUCT.md`

Create a short, standard open-source conduct document with:
- respectful collaboration expectations
- no harassment
- good-faith review culture
- maintainers may remove unsafe or abusive contributions

Keep it concise and conventional. Do not over-customize it.

### 5. `package.json`

Add or update top-level public metadata fields:
- `"license": "Apache-2.0"`
- `"repository"`
- `"homepage"`
- `"bugs"`

Keep:
- `"private": true`

Reason:
- Public repository metadata helps GitHub presentation.
- Keeping `private: true` prevents accidental package publication and does not conflict with source-code openness on GitHub.

### 6. `README.md`

Rewrite the public-facing top and middle sections while preserving the managed block boundaries.

The new README structure should be:

1. Project title
2. One-paragraph bilingual positioning
3. Public posture / boundary statement
4. Why this project exists
5. Core capabilities
6. Architecture overview
7. Current verified posture
8. Quick start for clone/read/dry-run demo
9. Repository structure
10. Safety and contribution highlights
11. Managed current-state block
12. Additional internal phase-heavy material below that block if needed

The first screen must continue to satisfy Phase607R wording requirements:
- dry-run
- local preview
- governance demo
- default: no real Provider calls
- no general availability claim
- no deployment promise

The rewrite should feel stronger and more polished, but it must not:
- claim GA
- claim deployment complete
- claim production-ready
- imply that all Providers are safely runnable by default

## Copy Direction For The README

The README should sound like a serious product-engineering project, not a toy demo and not an internal note dump.

Desired tone:
- ambitious but evidence-aware
- product-facing
- bilingual
- commercial-grade aspiration without false claims

Good phrases:
- "AI Gateway Workbench"
- "multi-provider orchestration"
- "model governance"
- "dry-run-first operator workflow"
- "evidence-backed engineering"
- "local-first control plane"

Avoid:
- "production-ready"
- "enterprise-grade" unless directly qualified
- "fully open-source release complete"
- "GA"
- "deployed"

## Validation Plan

Minimum validation after implementation:

- `pnpm run preflight:phase632-token-saving`
- `pnpm sync:readme-agents-current-state`
- `pnpm verify:phase606r-open-source-minimum-readiness-lock`
- `pnpm verify:phase607r-public-repo-hygiene-preflight`
- `pnpm verify:phase306c-readme-agents-auto-sync-guard`

Additional spot checks:

- `node --check` for any changed verifier-related JS file if touched
- confirm `README.md` still contains the managed block markers
- confirm `AGENTS.md` is untouched unless sync regenerates managed content

## Risks And Mitigations

### Risk 1: README rewrite breaks verifier wording

Mitigation:
- Keep the first-screen disclaimer phrases required by Phase607R.
- Preserve the Phase606R managed-block line.

### Risk 2: Public docs overclaim readiness

Mitigation:
- Reuse existing documented posture:
  - dry-run-first
  - no default real Provider calls
  - no deployment promise

### Risk 3: Missing historical public scrub still exists

Mitigation:
- Say so explicitly in README/docs where appropriate.
- Do not claim full public-release cleanliness.

## Acceptance Criteria

This design is successful when:

- Apache-2.0 license file exists at repo root.
- Root `SECURITY.md`, `CONTRIBUTING.md`, and `CODE_OF_CONDUCT.md` exist.
- `README.md` is clearly more polished and bilingual without losing required safety disclaimers.
- `package.json` contains the public metadata fields and still keeps `private: true`.
- Phase606R, Phase607R, and README/AGENTS sync verifiers still pass.
- No changes are made to `legacy/`, `/chat`, `/chat-gateway/execute`, provider runtime, or secrets.

## Explicit Boundaries

- No commit.
- No push.
- No deploy.
- No release.
- No workspace-clean claim.
- No secret read or print.
- No paid Provider call.
- No MiMo, OpenAI, Claude, or OpenRouter call.
