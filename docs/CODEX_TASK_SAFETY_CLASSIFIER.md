# Codex Task Safety Classifier

Phase 257A classifies potential Codex tasks before any future one-shot
readiness decision. Classification is preview-only.

## 1. safe-preview Definition

safe-preview means the task can be documented or checked without real Codex
execution. It may generate handoff text, review criteria, or verifier evidence.

Examples:

- update a preview-only doc
- add a verifier for readiness checks
- refine UI copy for disabled status

## 2. needs-human-review Definition

needs-human-review means the task may be reasonable but needs explicit human
review before readiness can continue.

Examples:

- touching shared contracts
- changing package scripts
- modifying files near dirty workspace changes

## 3. blocked Definition

blocked means readiness cannot proceed until a known blocker is resolved.

Examples:

- missing prerequisite evidence
- failed verifier
- unclear allowed files
- dirty workspace overlap

## 4. forbidden Definition

forbidden means the task must not proceed under this readiness layer.

Examples:

- modify `legacy/`
- create `PROJECT_CONTEXT.md`
- call real `codex exec`
- execute codex command
- create worktrees
- connect workflow runner
- no automatic commit or push

## 5. Examples By Class

- safe-preview: draft a manual handoff checklist.
- needs-human-review: update a verifier shared by multiple phases.
- blocked: expected evidence is missing.
- forbidden: run Codex CLI from the service.

## 6. Never Automatic

These tasks must never be automatic:

- code execution
- code modification
- worktree creation
- workflow runner dispatch
- commit, push, PR, or release
- secret migration

## 7. Handoff-only Tasks

Tasks that describe a future change can only generate handoff text when
executionEnabled=false and codexExecInvoked=false.

## 8. One-shot Readiness Candidates

Only safe-preview and some human-reviewed low-risk tasks can enter one-shot
readiness, and only after preflight and evidence requirements are explicit.

## 9. Human Confirmation Required

Human confirmation is required for anything with dirty workspace overlap,
shared contract impact, evidence refresh, or security boundary risk.

## 10. Classification Output Template

```text
taskId:
classification: safe-preview | needs-human-review | blocked | forbidden
reason:
allowedScope:
blockedScope:
requiredVerification:
expectedEvidence:
executionEnabled=false
codexExecInvoked=false
approvalPreviewIsExecutionPermission=false
```

## 11. UI Prompt

The `/ui` Personal Operator Console should show Task Safety Classifier:

- safe-preview
- needs-human-review
- blocked
- forbidden
- handoff only
- human confirmation

## 12. Required Verification

```powershell
cmd /c pnpm run verify:phase257a-codex-task-safety-classifier
```

## 13. Boundary

This phase must not:

- Modify `legacy/`
- Create `PROJECT_CONTEXT.md`
- Do not add heavy dependencies
- Do not call real `codex exec`
- Do not execute codex command
- Do not create worktrees
- Do not connect workflow runner
- Do not automatically commit or push
- Do not change the default NVIDIA `/chat` mainline
- Do not promise unattended automatic development
- Do not treat approval-preview as execution authorization
- Do not write real API keys
- Do not describe dirty workspace as clean
- Do not describe readiness as execution completed

## 14. Final Conclusion

Phase 257A gives the operator a preview-only safety classifier before any
future one-shot readiness decision.
