# Approved Patch Runner + Auto Review Loop

## A. Phase297A-298A 目标和边界
Phase297A-298A adds a controlled Approved Patch Runner and a whitelist-only Auto Review Loop on top of the Phase296A read-only runner baseline.

This merged phase is strictly bounded to:

- approved patch only
- auto review only
- human approval required for patch application
- dry-run by default
- no full-open mode
- no unattended infinite loop
- no automatic commit, push, deploy, or release
- no worktree
- no workflow runner
- no external provider call
- no paid API, MiMo, or embedding call
- no real Codex exec

This phase does not change the default NVIDIA `/chat` mainline, does not modify `legacy/`, does not create `PROJECT_CONTEXT.md`, and does not read `.env` or secret files.

## B. 上游 Phase294A/295A/296A 依赖
Phase297A-298A depends on these upstream boundaries remaining intact:

- Phase294A Safe Refactor Harness
- Phase295A Local Agent Permission Mode Gate
- Phase296A Read-only Local Agent Runner

This phase inherits all earlier rules:

- `legacy/` stays blocked
- `PROJECT_CONTEXT.md` stays blocked
- default NVIDIA `/chat` stays unchanged
- workspace may remain dirty and must not be described as clean
- no real Codex exec, workflow runner, or worktree creation

## C. Approved Patch Runner 工作流
The Approved Patch Runner workflow is:

1. receive a patch request with `allowedFiles`, `patchOperations`, mode, and `approvalRecord`
2. normalize file paths inside the repository root
3. block any forbidden path before preview or apply
4. confirm every target file is explicitly listed in `allowedFiles`
5. generate a deterministic diff preview
6. generate a rollback manifest summary
7. stop with `approvalRequired=true` when approval is missing or dry-run stays enabled
8. only allow real apply when `approvalRecord.status === "approved"` and `dryRun === false`

The runner is designed to return structured preview metadata first. Real apply is opt-in and never the default.

## D. Auto Review Loop 工作流
The Auto Review Loop workflow is:

1. receive review rounds or a single command batch
2. cap `maxRounds` at `3`
3. validate every command against the whitelist
4. skip blocked or non-whitelisted commands
5. run allowed local verifier commands only when mode allows it and `dryRun === false`
6. stop immediately on the first verification failure
7. build a `go`, `no-go`, or `review-required` review package
8. return review metadata and next steps without auto-fixing

The loop is a bounded review surface, not an unattended repair loop.

## E. Manual Approval Mode 行为
`manual` mode remains the most conservative path.

In `manual` mode:

- patch preview is allowed
- rollback manifest preview is allowed
- review package generation is allowed
- real patch apply requires per-patch human approval
- auto review commands are not auto-run by default
- commands may still be prepared for operator review

`manual` mode must not silently escalate into write execution.

## F. Auto Review Mode 行为
`auto_review` mode remains controlled and whitelist-only.

In `auto_review` mode:

- read-only inspection remains allowed
- review commands may run automatically only when they match the local whitelist
- task-level approval may unlock apply only for explicitly listed `allowedFiles`
- patch apply still requires an approved record and `dryRun=false`
- auto review stops on failures and does not continue with self-directed repair

`auto_review` is still not `full_open`, and it is not an unattended execution system.

## G. full-open 禁用说明
`full_open` stays disabled in this phase.

This phase only supports:

- `manual`
- `auto_review`

It must not expose:

- `full_open`
- hidden fallback escalation
- automatic widening of file access
- unrestricted command execution

## H. allowedFiles / forbiddenPaths 规则
Approved patch operations must stay inside explicit `allowedFiles`.

Forbidden paths must include at minimum:

- `legacy/`
- `PROJECT_CONTEXT.md`
- `.env`
- `.env.local`
- `.env.production`
- `.env.development`
- `.git`
- `.git/`
- `node_modules`
- `node_modules/`

The runner must reject:

- files outside the repository root
- files not explicitly listed in `allowedFiles`
- any path under forbidden locations

## I. allowedCommands / blockedCommands 规则
The Auto Review Loop may whitelist only these local command prefixes:

- `node --check`
- `cmd /c pnpm run verify:`
- `cmd /c pnpm run health:phase12a`
- `cmd /c pnpm run doctor:phase13a`
- `cmd /c pnpm -r --if-present check`

Blocked commands must include at minimum:

- `git add`
- `git commit`
- `git push`
- `git reset`
- `git clean`
- `deploy`
- `release`
- `curl`
- `Invoke-WebRequest`
- `codex exec`
- `docker push`
- `npm publish`
- `pnpm publish`
- `gh release`
- `gh workflow run`

Profiles such as `external-risk`, `manual-only`, and `release-preflight` stay blocked by default.

## J. rollback manifest 规则
The rollback manifest is metadata only.

It must:

- record `changedFiles`
- record `beforeHash` and `afterHash`, or an equivalent before/after summary
- avoid storing secret values
- avoid storing `.env` contents
- avoid providing `git reset`
- avoid automatic rollback

The manifest exists so an operator can understand what would need to be reversed later.

## K. go / no-go / review-required 判定规则
The review package must return exactly one of:

- `go`
- `no-go`
- `review-required`

Recommended interpretation:

- `go`: all allowed checks passed and no blockers remain
- `no-go`: at least one blocker exists, a boundary failed, or a command failed
- `review-required`: boundaries held, but warnings, skipped commands, or pending approval still need operator review

The review output must include blockers, warnings, commands run, commands skipped, evidence paths, changed files, boundary check, next steps, and approval requirements.

## L. maxRounds 和停止规则
The Auto Review Loop must keep:

- `dryRun=true` by default
- `maxRounds=1` by default
- `maxRoundsLimit=3`

It must stop when:

- a command is blocked
- a command fails
- a boundary check fails
- the planned rounds reach the configured limit

It must not self-schedule further rounds and must not become an infinite loop.

## M. 禁止 commit/push/deploy/release 说明
Phase297A-298A must preserve:

- `autoCommit=false`
- `autoPush=false`
- `releaseOrDeployAllowed=false`

This phase does not authorize:

- `git add`
- `git commit`
- `git push`
- deployment
- release
- publishing packages
- pushing container images

## N. 不可声称能力说明
Phase297A-298A must not claim:

- full-open local agent execution
- unattended infinite loop execution
- automatic commit or push
- deploy or release capability
- worktree support
- workflow runner support
- external provider-backed agent execution
- real Codex exec
- secret or `.env` access
- clean workspace status

It is a controlled local preview kernel only.

## O. Phase299A 或后续阶段建议，但不要执行
If a later phase is approved, the next safe direction should be a narrow operator-facing preview that shows:

- patch approval record status
- dry-run versus apply-ready state
- review loop whitelist visibility
- blocker and rollback summary visibility

That next step should remain bounded and should not expand into full-open execution.
