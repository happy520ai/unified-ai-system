# Open-Source Readiness Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Apache-2.0 licensing, public collaboration documents, and a bilingual product-facing README without breaking the existing Phase606R/Phase607R public-readiness verifier chain.

**Architecture:** This change is documentation-first and metadata-first. The implementation keeps all runtime behavior untouched, adds root-level open-source governance files, updates package metadata for GitHub presentation, and rewrites only the public-facing README sections above the managed block while preserving required disclaimer phrases and the managed state sync block.

**Tech Stack:** Markdown, JSON, pnpm scripts, existing Phase606R/Phase607R verifier scripts

---

## File Structure

- Create: `LICENSE`
- Create: `SECURITY.md`
- Create: `CONTRIBUTING.md`
- Create: `CODE_OF_CONDUCT.md`
- Create: `docs/superpowers/plans/2026-06-01-open-source-readme-refresh.md`
- Modify: `README.md`
- Modify: `package.json`
- Verify: `tools/phase606r/validate-open-source-minimum-readiness-lock.mjs`
- Verify: `tools/phase607r/validate-public-repo-hygiene-preflight.mjs`

### Task 1: Add Root Open-Source Governance Files

**Files:**
- Create: `E:/AI-Data/AI网关系统/unified-ai-system/LICENSE`
- Create: `E:/AI-Data/AI网关系统/unified-ai-system/SECURITY.md`
- Create: `E:/AI-Data/AI网关系统/unified-ai-system/CONTRIBUTING.md`
- Create: `E:/AI-Data/AI网关系统/unified-ai-system/CODE_OF_CONDUCT.md`

- [ ] **Step 1: Create the Apache-2.0 license file**

Create `LICENSE` with the standard Apache License 2.0 text, starting with:

```text
Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/
```

Expected result:
- Root `LICENSE` exists.
- Phase607R no longer reports `license_file_missing_decision_recorded`.

- [ ] **Step 2: Create the security policy**

Create `SECURITY.md` with these required sections:

```md
# Security Policy

## Scope
- This repository is a local-first, dry-run-first AI Gateway Workbench.
- Default clone/read workflows must not require real Provider calls.

## Reporting A Vulnerability
- For non-sensitive issues, open a GitHub issue.
- Do not paste API keys, tokens, `.env` content, raw endpoint values, or private logs into public reports.
- Redact secrets and machine-specific paths before sharing evidence.

## Supported Contribution Boundary
- Do not modify `legacy/`.
- Do not change `/chat` or `/chat-gateway/execute` as part of public-readiness work.
- Do not treat this repository as a deployed production service.
```

Expected result:
- `SECURITY.md` exists.
- No promise of SLA or production incident response is added.

- [ ] **Step 3: Create the contributor guide**

Create `CONTRIBUTING.md` with these required rules:

```md
# Contributing

## Default Posture
- Treat this project as local-first and dry-run-first unless a later approved phase explicitly says otherwise.

## Hard Boundaries
- Do not modify `legacy/`.
- Do not expose `.env`, API keys, tokens, credential values, or webhook values.
- Do not change the default `/chat` path for open-source readiness work.
- Do not run OpenAI, Claude, OpenRouter, MiMo, NVIDIA, or other real Providers by default.
- Do not claim workspace clean unless it was explicitly verified.

## Before You Finish
- Run `pnpm run preflight:phase632-token-saving`
- Run `pnpm sync:readme-agents-current-state`
- Run `pnpm verify:phase606r-open-source-minimum-readiness-lock`
- Run `pnpm verify:phase607r-public-repo-hygiene-preflight`
```

Expected result:
- `CONTRIBUTING.md` exists.
- Phase607R no longer reports `contributing_file_missing_safety_guide_available`.

- [ ] **Step 4: Create the code of conduct**

Create `CODE_OF_CONDUCT.md` with a short standard policy:

```md
# Code of Conduct

## Our Standards
- Be respectful.
- Be constructive.
- Assume good intent, but prioritize safety and evidence.
- Harassment, abuse, and unsafe disclosure of secrets are not acceptable.

## Enforcement
- Maintainers may remove comments, issues, or contributions that violate these expectations.
```

Expected result:
- `CODE_OF_CONDUCT.md` exists.
- The file stays concise and generic enough for open-source collaboration.

### Task 2: Update Public Repository Metadata

**Files:**
- Modify: `E:/AI-Data/AI网关系统/unified-ai-system/package.json`

- [ ] **Step 1: Add public repository metadata without changing package publication posture**

Update the top-level fields in `package.json` so they include:

```json
{
  "name": "unified-ai-system",
  "version": "0.1.0",
  "private": true,
  "license": "Apache-2.0",
  "repository": {
    "type": "git",
    "url": "https://github.com/happy520ai/unified-ai-system.git"
  },
  "homepage": "https://github.com/happy520ai/unified-ai-system",
  "bugs": {
    "url": "https://github.com/happy520ai/unified-ai-system/issues"
  }
}
```

Expected result:
- GitHub metadata is complete.
- `"private": true` remains unchanged.

- [ ] **Step 2: Re-check for formatting and field placement**

Run:

```powershell
Get-Content -TotalCount 20 package.json
```

Expected:
- The new metadata fields appear near the top of the file.
- JSON remains valid.

### Task 3: Rewrite the Public-Facing README

**Files:**
- Modify: `E:/AI-Data/AI网关系统/unified-ai-system/README.md`

- [ ] **Step 1: Preserve the verifier-required first-screen posture**

The first screen of `README.md` must still contain these phrases:

```text
dry-run
local preview
governance demo
Default: no real Provider calls
no general availability claim
no deployment promise
```

Expected result:
- Phase607R first-screen checks still pass.

- [ ] **Step 2: Replace the current top section with a bilingual product-facing introduction**

Rewrite the beginning of `README.md` into a structure like:

```md
# unified-ai-system / AI Gateway Workbench

An evidence-backed, local-first AI Gateway Workbench for multi-provider orchestration, model governance, and dry-run-first operator workflows.

一个面向真实工程交付的 AI Gateway Workbench，用于多 Provider 接入、模型治理、任务路由、证据链验证与本地优先控制。

Public repo preflight status: dry-run / local preview / governance demo. Default: no real Provider calls. This repository makes no general availability claim and no deployment promise.
```

Expected result:
- The repo feels like a serious product project.
- The bilingual introduction is concise and strong.

- [ ] **Step 3: Add high-signal overview sections above the managed block**

Add or rewrite these sections before `<!-- BEGIN UNIFIED_AI_SYSTEM_CURRENT_STATE -->`:

```md
## Why This Project Exists
## Core Capabilities
## Architecture Snapshot
## Current Verified Posture
## Quick Start
## Repository Map
## Safety Notes
```

Each section should include short, concrete bullets. Required content:
- multi-provider direction
- model governance
- dry-run-first execution
- evidence-backed verification
- local-first operator workflow
- explicit note that this is not deployed production SaaS

Expected result:
- New visitors understand the project before seeing internal phase details.

- [ ] **Step 4: Keep the managed block intact**

Do not remove or rename:

```md
<!-- BEGIN UNIFIED_AI_SYSTEM_CURRENT_STATE -->
...
<!-- END UNIFIED_AI_SYSTEM_CURRENT_STATE -->
```

Expected result:
- `pnpm sync:readme-agents-current-state` can still manage the block.

- [ ] **Step 5: Remove or downplay confusing internal-only top-of-file clutter**

Specifically reduce first-screen prominence of:

```text
OpenCode hardening pack
machine-local install copy text
garbled encoding lines
provider-specific setup that looks like the default clone path
```

Expected result:
- README no longer starts like an internal bootstrap notebook.

### Task 4: Validate, Sync, And Repair

**Files:**
- Verify: `E:/AI-Data/AI网关系统/unified-ai-system/README.md`
- Verify: `E:/AI-Data/AI网关系统/unified-ai-system/package.json`
- Verify: `E:/AI-Data/AI网关系统/unified-ai-system/AGENTS.md`

- [ ] **Step 1: Run Phase632 preflight**

Run:

```powershell
pnpm run preflight:phase632-token-saving
```

Expected:
- Exit code `0`
- `preflightPassed=true`

- [ ] **Step 2: Sync README and AGENTS managed blocks**

Run:

```powershell
pnpm sync:readme-agents-current-state
```

Expected:
- Managed block stays valid.
- If the sync rewrites unrelated managed content, record it as a verifier side effect instead of hiding it.

- [ ] **Step 3: Run open-source readiness verification**

Run:

```powershell
pnpm verify:phase606r-open-source-minimum-readiness-lock
pnpm verify:phase607r-public-repo-hygiene-preflight
pnpm verify:phase306c-readme-agents-auto-sync-guard
```

Expected:
- All commands exit `0`
- No secret or endpoint overclaim errors
- No missing README/AGENTS managed block errors

- [ ] **Step 4: If a verifier fails, repair the relevant docs or metadata and rerun**

Allowed repair targets:

```text
README first-screen disclaimer wording
package.json metadata shape
missing root open-source files
managed block sync drift
```

Not allowed:

```text
weakening secret checks
removing required disclaimers
claiming production readiness
changing `/chat`
editing `legacy/`
```

Expected result:
- Verification is green without weakening project boundaries.

## Self-Review

### Spec coverage

- License: covered by Task 1 Step 1.
- Security, contributing, conduct files: covered by Task 1 Steps 2-4.
- Package public metadata: covered by Task 2.
- README bilingual polish and managed-block preservation: covered by Task 3.
- Validation and self-repair loop: covered by Task 4.

### Placeholder scan

- No `TBD`, `TODO`, or "implement later" placeholders remain.
- Commands, files, and required text are explicit.

### Type consistency

- `README.md`, `package.json`, and root policy file names match the spec exactly.
- GitHub URLs match the owner-provided repository URL exactly.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-01-open-source-readme-refresh.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

The user has already explicitly instructed implementation to proceed in this session, so default to option 2 unless redirected.
