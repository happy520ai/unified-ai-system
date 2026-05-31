# Operator Preview Visibility & Approval Evidence Linkage

## A. Phase300A 目标和边界
Phase300A enhances the Phase299A operator preview with clearer read-only explanations and evidence linkage.

This phase is strictly visibility-only:

- no patch apply
- no auto review execution
- no new execution route
- no external provider call
- no paid API, MiMo, or embedding
- no real Codex exec
- no workflow runner
- no worktree
- no commit, push, deploy, or release
- no full_open

The purpose is to help an operator understand what the preview state means, not to add any new execution surface.

## B. 上游 Phase294A/295A/296A/297A-298A/299A 依赖
Phase300A depends on these upstream stages staying valid:

- Phase294A Safe Refactor Harness
- Phase295A Local Agent Permission Mode Gate
- Phase296A Read-only Local Agent Runner
- Phase297A-298A Approved Patch Runner + Auto Review Loop
- Phase299A Local Agent Operator Preview Panel

This phase inherits all earlier boundaries:

- `legacy/` remains blocked
- `PROJECT_CONTEXT.md` remains blocked
- default NVIDIA `/chat` remains unchanged
- `.env` and secret access remain blocked
- workspace may remain dirty and must not be described as clean

## C. Permission Mode 可见性增强
Phase300A adds an explanation layer for permission modes so an operator can quickly tell:

- what `manual` means
- what `auto_review` means
- why `full_open` stays disabled
- which rules remain unchanged across both modes

The explanation is descriptive only and must not change any mode behavior.

## D. Approval Record 可见性增强
The preview should explain approval semantics clearly:

- approval metadata is still required before patch apply
- `manual` mode expects patch-scope approval
- `auto_review` may accept task-scope approval, but only under the existing bounded rules
- approval state does not mean a patch was already applied

## E. Dry-run / Apply-ready 可见性增强
The preview should explain:

- why `dryRunDefault=true`
- why `realPatchAppliedByDefault=false`
- what “apply-ready” means in a purely descriptive sense
- why Phase300A still does not execute patch apply

## F. Go / No-go / Review-required 可见性增强
The preview should explain the three review states:

- `go`
- `no-go`
- `review-required`

It should also clarify that a preview review state is an operator aid, not an automatic execution decision.

## G. Rollback Manifest 摘要可见性增强
The preview should explain what the rollback manifest summary represents:

- changed files list
- before/after summary or hash
- no secret recording
- no `.env` recording
- no automatic rollback

This explanation is intended to help the operator interpret the summary safely.

## H. Evidence Linkage 规则
The preview should explain how evidence relates to the current state:

- Phase299A evidence proves preview-only operator state
- Phase297A-298A evidence proves dry-run-by-default patch and review boundaries
- upstream verifier presence helps establish continuity
- evidence linkage is descriptive and read-only

The explanation must not claim that evidence equals live execution.

## I. Blocker / Warning / Informational 解释规则
The preview should make it obvious how to interpret:

- blockers
- warnings
- informational notes

Recommended meaning:

- blocker: a stop condition or unresolved safety issue
- warning: a caution that still needs human review
- informational: context that does not, by itself, block preview use

## J. 不可执行能力说明
Phase300A does not add:

- patch runner execution
- auto review loop execution
- command execution
- provider execution
- commit or push
- deploy or release
- workflow runner
- worktree
- real Codex exec

It is still a read-only visibility layer.

## K. 不可声称能力说明
Phase300A must not claim:

- `full_open` availability
- automatic patch apply
- automatic go/no-go enforcement
- automatic evidence generation by execution
- clean workspace guarantee
- secret access
- model call capability
- UI or route execution controls added

## L. Phase301A 后续建议，但不要执行
If a later phase is approved, the next safe step should still remain operator-first:

- show richer provenance for evidence references
- show clearer reasons behind blocked or review-required states
- keep expanding visibility before expanding execution

The next stage should not automatically become an execution phase.
