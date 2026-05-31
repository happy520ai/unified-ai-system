# Local Agent Permission Mode Gate

## A. Phase295A 目标和边界
Phase295A adds a local permission mode gate for future local agent work. It defines two safe modes only:

- `manual`
- `auto_review`

This phase is local-only and static-policy-only. It does not start a real Local Agent Runner, does not apply patches, does not execute unattended development, and does not enter Phase296A.

## B. 上游 Phase294A 依赖
Phase295A depends on the verified Phase294A Safe Refactor Harness baseline.

Phase294A established the local static guardrail contract:

- no `legacy/` modification
- no `PROJECT_CONTEXT.md`
- no default NVIDIA `/chat` mainline change
- no paid API or external provider call
- no release, deploy, commit, or push

Phase295A inherits these boundaries and expresses them as permission-mode policy.

## C. 模式总览
Phase295A supports exactly two modes:

1. `manual`
2. `auto_review`

`full_open` is explicitly disabled and must not become an available mode in this phase.

## D. Manual Approval Mode 规则
`manual` is the default safe mode.

It allows:

- local read-only inspection
- planning
- patch proposal generation
- review summary generation

It requires human approval before:

- writing files
- applying patches
- performing task-scoped write actions

It does not allow:

- commit
- push
- deploy
- release
- unattended execution
- real Local Agent Runner start

## E. Auto Review Mode 规则
`auto_review` is a controlled review mode, not an execution mode.

It allows:

- whitelisted local reads
- automatic execution of whitelisted local verifier commands
- automatic generation of review, go/no-go, and evidence summaries

It still requires task-level approval before:

- writing files
- applying patches

It does not allow:

- `full_open`
- commit
- push
- deploy
- release
- reading `.env` or secrets
- reading or modifying `legacy/`
- creating or using `PROJECT_CONTEXT.md`
- real Local Agent Runner execution

## F. full_open 禁用规则
`full_open` must be represented as disabled.

Phase295A must not:

- expose `full_open` as selectable
- treat `full_open` as fallback
- silently upgrade `manual` or `auto_review` into `full_open`

## G. 路径边界与 blockedPaths
The policy must block at least these paths:

- `legacy/`
- `PROJECT_CONTEXT.md`
- `.env`

It may also block additional secret-like or runtime-sensitive paths, but it must not allow access that breaks earlier phase boundaries.

## H. 命令边界与 blockedCommandPatterns
The policy must block dangerous command categories, including:

- `git commit`
- `git push`
- `git reset`
- `git clean`
- `deploy`
- `release`
- `curl`
- `codex exec`

These patterns are denied in both `manual` and `auto_review`.

## I. 允许自动运行的本地验证边界
`auto_review` may allow a whitelist of local verifier commands only.

This whitelist must stay bounded to local checks such as:

- `node --check`
- `cmd /c pnpm run verify:*`
- `cmd /c pnpm run health:phase12a`
- `cmd /c pnpm run doctor:phase13a`

Allowing a verifier command does not grant write, patch apply, release, deploy, commit, push, or real agent execution.

## J. Harness / Verifier 检查项
The Phase295A verifier must statically confirm:

1. document exists
2. evidence JSON and Markdown exist
3. root and service scripts exist
4. policy exports `manual` and `auto_review`
5. `full_open` is disabled
6. `blockedPaths` includes `legacy/`, `PROJECT_CONTEXT.md`, and `.env`
7. blocked command patterns include `git commit`, `git push`, `git reset`, `git clean`, `deploy`, `release`, `curl`, and `codex exec`
8. evidence safety fields stay at `0` or `false`

## K. Phase295A 不可声称能力
Phase295A must not claim:

- real Local Agent Runner is available
- patch apply is automatic
- commit or push is allowed
- deploy or release is allowed
- unattended execution is allowed
- `full_open` exists as a usable mode
- secrets or `.env` are readable
- Phase296A has started

## L. Phase296A 前置条件说明
Phase296A must not start automatically after Phase295A.

Before any later phase considers deeper local agent capability, all of the following still need explicit confirmation:

- Phase294A remains passing
- Phase295A passes
- no new boundary breach is introduced
- `manual` and `auto_review` remain bounded modes only
- `full_open` remains disabled
- no real runner execution path has been enabled under the Phase295A name
