# Agent Workforce Seed Prompt Pack

Phase: 223A

These seed prompts provide stable context for future Agent Workforce task
packages. Each prompt keeps the current system state, allowed scope,
forbidden actions, verification commands, evidence requirements, and Codex
response format visible before any task is delegated.

## Prompt 1: Generate Normal Development Task Package

Use this prompt when Agent Workforce turns a product goal into a Codex handoff.

```markdown
# Agent Workforce Development Task Seed

## Current System Context Summary
unified-ai-system is a local AI Gateway + Agent Workforce Preview console with
/ui, setup readiness, NVIDIA /chat main lane, Knowledge/RAG preview, templates,
saved plans/history, JSON/Markdown export, Codex Desktop Handoff Pack, manual
Codex result bridge, feedback outbox, controlled loop dry-run, and real browser
UI trial passed.

## Task Goal
Create a bounded implementation plan and Codex handoff for: <USER_GOAL>.

## Allowed Modification Scope
- apps/ when the task is application behavior.
- packages/ when shared contracts, SDK, config, or utilities are required.
- docs/ and evidence only when the task asks for documentation or validation.
- tools/agent-workforce only for local handoff/bridge helpers.

## Forbidden Actions
- no legacy changes
- no PROJECT_CONTEXT.md
- no default NVIDIA /chat lane change
- no automatic Codex execution by default
- no real Agent execution
- no worktree creation
- no workflow run hookup
- no external runner dispatch
- no auto commit/push
- no plaintext API keys

## Recommended Verification Commands
cmd /c pnpm run health:phase12a
cmd /c pnpm run doctor:phase13a
cmd /c pnpm run verify:phase199a-real-ui-trial-runtime-sync
cmd /c pnpm run verify:phase105a-user-journey
cmd /c pnpm run verify:phase107a-secret-safety
cmd /c pnpm -r --if-present check

## Evidence Requirements
- Record changed files.
- Record commands run.
- Record verification results.
- Record any new evidence paths.
- Record that no legacy, PROJECT_CONTEXT.md, default NVIDIA /chat, commit,
  push, worktree, workflow run, external runner dispatch, or secret exposure
  occurred.

## Codex Response Format
A. Summary
B. Changed Files
C. Commands Run
D. Tests / Verification
E. Evidence Paths
F. Boundary Check
G. Known Issues
H. Next Step
```

## Prompt 2: Generate Codex Fix Task Package

Use this prompt when verification fails or a bug is found and the system needs
a targeted repair instruction.

```markdown
# Agent Workforce Fix Task Seed

## Current System Context Summary
unified-ai-system is a local AI Gateway + Agent Workforce Preview console. It
has /ui, NVIDIA /chat main lane, Knowledge/RAG preview, Agent Workforce
templates, saved plans/history, JSON/Markdown export, Codex handoff,
manual result import, feedback generation, controlled loop dry-run, and real
browser UI trial passed.

## Failure Or Bug
<PASTE_FAILURE_OR_BUG_SUMMARY>

## Allowed Modification Scope
- Only files directly required to fix the failure.
- Prefer the smallest patch compatible with existing patterns.
- Verification entrypoints and evidence may be updated only when the task
  explicitly concerns validation.

## Forbidden Actions
- no legacy changes
- no PROJECT_CONTEXT.md
- no default NVIDIA /chat lane change
- no automatic Codex execution by default
- no real Agent execution
- no worktree creation
- no workflow run hookup
- no external runner dispatch
- no auto commit/push
- no plaintext API keys

## Recommended Verification Commands
cmd /c pnpm run verify:<FAILED_PHASE>
cmd /c pnpm run verify:phase107a-secret-safety
cmd /c pnpm run verify:phase105a-user-journey
cmd /c pnpm run health:phase12a
cmd /c pnpm -r --if-present check

## Evidence Requirements
- Explain root cause.
- List the minimal fix.
- Include before/after verification result.
- Include evidence paths if evidence was refreshed.
- Confirm no legacy, PROJECT_CONTEXT.md, default NVIDIA /chat, commit, push,
  worktree, workflow run, external runner dispatch, or secret exposure.

## Codex Response Format
A. Root Cause
B. Fix Summary
C. Changed Files
D. Commands Run
E. Verification Result
F. Evidence Paths
G. Boundary Check
H. Remaining Risk
```

## Prompt 3: Generate Codex Result Review Task

Use this prompt when Codex returns a result and the system needs to review it
and generate feedback.

```markdown
# Agent Workforce Codex Result Review Seed

## Current System Context Summary
unified-ai-system has a local Codex result inbox and feedback outbox. The
system can read .codex-handoff/inbox/latest-codex-result.md, create a system
review, and produce feedback to Codex. Default mode remains manual/dry-run.

## Codex Result Source
.codex-handoff/inbox/latest-codex-result.md

## Allowed Modification Scope
- .codex-handoff/review for review and feedback files.
- apps/ai-gateway-service/evidence for phase evidence when a verifier runs.
- docs/ only when documenting the review or boundary.

## Forbidden Actions
- no legacy changes
- no PROJECT_CONTEXT.md
- no default NVIDIA /chat lane change
- no automatic Codex execution by default
- no real Agent execution
- no worktree creation
- no workflow run hookup
- no external runner dispatch
- no auto commit/push
- no automatic patch apply
- no plaintext API keys

## Recommended Verification Commands
cmd /c pnpm run codex:result:import
cmd /c pnpm run verify:phase212a-roundtrip-manual-bridge-trial
cmd /c pnpm run verify:phase217a-codex-loop-dry-run-trial
cmd /c pnpm run verify:phase107a-secret-safety
cmd /c pnpm -r --if-present check

## Evidence Requirements
- Review Summary
- Changed Files
- Commands Run
- Tests Passed
- Evidence Paths
- Known Issues
- Boundary Check
- Feedback to Codex

## Codex Response Format
A. Review Decision: accepted-preview / needs-fix / blocked
B. Required Fixes
C. Verification Gaps
D. Boundary Issues
E. Feedback to Codex
F. Evidence Paths
G. Next Step
```
