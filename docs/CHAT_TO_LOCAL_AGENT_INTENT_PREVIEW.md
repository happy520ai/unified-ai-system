# Chat-to-Local-Agent Intent Preview

## A. Phase301A 目标和边界
Phase301A adds a read-only preview layer that can classify whether a chat request looks like a local-agent task.

This phase is strictly bounded to intent preview only:

- no local file write
- no patch apply
- no Auto Review Loop execution
- no command execution
- no model-triggered local execution
- no external provider call
- no paid API, MiMo, or embedding
- no real Codex exec
- no workflow runner
- no worktree
- no commit, push, deploy, or release
- no full_open

The goal is to preview intent, risk, approval needs, allowed and blocked actions, and recommended next steps without starting any local execution path.

## B. 上游 Phase294A-299A/300A 依赖说明
Phase301A depends on these upstream bounded phases remaining valid:

- Phase294A Safe Refactor Harness
- Phase295A Local Agent Permission Mode Gate
- Phase296A Read-only Local Agent Runner
- Phase297A-298A Approved Patch Runner + Auto Review Loop
- Phase299A Local Agent Operator Preview Panel

Phase300A Operator Preview Visibility & Approval Evidence Linkage is an optional enhancement dependency when present. It improves explanation quality, but Phase301A must not attempt to recreate it if missing.

This phase inherits all earlier safety rules:

- `legacy/` remains blocked
- `PROJECT_CONTEXT.md` remains blocked
- default NVIDIA `/chat` remains unchanged
- `.env` and secret access remain blocked
- workspace may remain dirty and must not be described as clean

## C. Chat-to-Local-Agent intent preview 工作流
The intent preview workflow is:

1. receive a chat-like input string
2. deterministically classify whether it looks like a local-agent request
3. assign a task type, risk level, and recommended permission mode
4. identify required approvals and blocked reasons
5. produce a preview package with file boundary and command boundary summaries
6. stop without executing any local operation

This workflow must never replace the default NVIDIA `/chat` path and must never auto-enter a local execution chain.

## D. 支持识别的本地任务类型
Phase301A should classify at least these local task types:

- `phase_verification`
- `verifier_fix_request`
- `documentation_update_request`
- `patch_proposal_request`
- `read_only_audit_request`
- `local_command_request`
- `unsafe_release_or_deploy_request`
- `unsafe_secret_or_env_request`
- `unsafe_git_destructive_request`
- `unknown`

These classifications are descriptive only. They do not grant execution permission.

## E. 不支持或必须拒绝的任务类型
The preview must block or reject requests such as:

- reading `.env`
- printing API keys
- destructive git cleanup
- `git reset --hard`
- `git clean`
- commit and push
- deploy or release
- modifying `legacy/`
- creating `PROJECT_CONTEXT.md`
- calling real provider smoke
- running `codex exec`
- enabling `full_open`

## F. 权限模式建议规则：manual / auto_review / full_open disabled
The preview may recommend only:

- `manual`
- `auto_review`

Suggested guidance:

- `manual` for documentation drafting, patch planning, review-only repair planning, and higher-risk local intent
- `auto_review` for bounded verification-style intent when the request is still preview-only and verifier-oriented

`full_open` stays disabled and must never be recommended.

## G. 风险等级规则：low / medium / high / blocked
The preview should use these risk levels:

- `low`: safe read-only verification or audit preview
- `medium`: bounded plan or documentation update preview that would still need approval later
- `high`: patch-oriented or command-oriented local intent that remains preview-only and approval-sensitive
- `blocked`: secrets, destructive git, release, deploy, full_open, legacy edits, or real external execution requests

## H. 审批点说明
The preview should surface approval expectations clearly:

- verification preview may still need human confirmation before any later real command run
- patch proposal intent needs human approval before any future apply path
- documentation update intent may still need review before any future write
- blocked intent must stop and not continue toward execution

## I. 推荐验证命令说明
The preview may recommend only safe local verifier-style commands such as:

- `node --check`
- `cmd /c pnpm run verify:...`
- `cmd /c pnpm run health:phase12a`
- `cmd /c pnpm run doctor:phase13a`
- `cmd /c pnpm -r --if-present check`

These commands are recommendations only in this phase. They must not be executed by the preview itself.

## J. allowedFiles / forbiddenPaths 预览规则
The preview must describe that future local write-capable work would require explicit `allowedFiles`.

It must also preview forbidden paths including at minimum:

- `legacy/`
- `PROJECT_CONTEXT.md`
- `.env`
- `.git`
- `node_modules`

## K. allowedCommands / blockedCommands 预览规则
The preview should summarize:

- safe allowed verifier prefixes from the existing permission policy
- blocked command patterns such as `git commit`, `git push`, `git reset`, `git clean`, `deploy`, `release`, `curl`, and `codex exec`

It must not imply that command recommendation equals command execution.

## L. Chat 与真实执行链路的隔离说明
Phase301A must keep chat intent preview isolated from real execution:

- `/chat` default behavior must not change
- default NVIDIA `/chat` mainline must not change
- no model response may automatically trigger local commands
- no preview result may automatically start patch apply or review loop execution

## M. 不可执行能力说明
Phase301A does not add:

- file writes
- patch apply
- Auto Review Loop execution
- command execution
- provider execution
- real Codex exec
- worktree
- workflow runner
- commit, push, deploy, or release

## N. 不可声称能力说明
Phase301A must not claim:

- automatic local execution from chat
- full_open mode
- automatic verifier repair
- automatic patch apply
- automatic release or deployment
- secret access
- clean workspace guarantee
- `/chat` now being a local agent executor

## O. Phase302A 后续建议，但不要执行
If a later phase is approved, the next safe step should still remain preview-first:

- refine intent explanations
- refine approval-point explanations
- refine risk-to-command guidance
- possibly add a carefully isolated preview surface only after explicit review

The next phase should not automatically become an execution phase.
