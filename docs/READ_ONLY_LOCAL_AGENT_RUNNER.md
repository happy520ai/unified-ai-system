# Read-only Local Agent Runner

## A. Phase296A 目标和边界
Phase296A adds a read-only local agent runner baseline for future local project tasks.

This phase is strictly bounded to read-only capabilities:

- read allowed files
- search allowed text
- inspect package scripts
- read git status in read-only form
- build context summaries
- generate plans
- generate patch proposals as text only

This phase does not write files, does not apply patches, does not execute dangerous commands, does not call external providers, does not read `.env`, and does not start a real Local Agent Runner process.

## B. 上游 Phase294A / Phase295A 依赖
Phase296A depends on:

- Phase294A Safe Refactor Harness
- Phase295A Local Agent Permission Mode Gate

Phase296A inherits all earlier boundaries:

- no `legacy/` modification
- no `PROJECT_CONTEXT.md`
- no default NVIDIA `/chat` mainline change
- no paid API or external provider call
- no commit, push, deploy, or release

## C. 只读 Runner 允许工具
The read-only runner may expose only these tools:

- `listDir`
- `readTextFile`
- `searchText`
- `readPackageScripts`
- `gitStatusReadonly`
- `buildContextSummary`
- `proposePlan`

No additional write-capable tool is allowed in this phase.

## D. 明确禁止的能力
The runner must forbid:

- `writeFile`
- `applyPatch`
- `deleteFile`
- non-whitelisted `runCommand`
- `git commit`
- `git push`
- `git reset`
- `git clean`
- deploy
- release
- real Codex exec
- workflow runner
- worktree creation

## E. 路径与 secrets 边界
The runner must keep these path and secret boundaries:

- block `legacy/`
- block `PROJECT_CONTEXT.md`
- block `.env`
- block secret-like environment files
- do not claim secret access is available

Phase296A is read-only, so even allowed file paths are still read-only only.

## F. Permission Mode Gate 继承规则
The runner must reference Phase295A permission policy and remain compatible with:

- `manual`
- `auto_review`

It must not allow `full_open`.

The runner must preserve:

- approval-first behavior for any future write path
- `autoCommit=false`
- `autoPush=false`
- `releaseOrDeployAllowed=false`

## G. Task Schema 约束
The local task schema must define:

- allowed task actions
- blocked task actions
- supported modes
- blocked paths
- blocked command patterns
- deterministic preview output shape

The schema must not imply that the runner can execute writes or patch application.

## H. HTTP / UI Preview 边界
If no safe insertion point exists, HTTP route and UI changes may be skipped.

If a route is added in a future safe insertion step, it must be:

- preview-only
- deterministic
- read-only
- non-executing
- non-provider-calling

Phase296A does not require a real route or real UI execution path to pass.

## I. Verifier 检查项
The Phase296A verifier must check:

1. read-only runner file exists
2. task schema file exists
3. verifier file exists
4. root and service scripts exist
5. runner references permission mode policy
6. only allowed tools are exposed
7. forbidden methods are absent or explicitly disabled
8. evidence keeps safety flags at `0` or `false`
9. document markers exist

## J. 不可声称能力
Phase296A must not claim:

- write-capable local agent execution
- automatic patch apply
- automatic file mutation
- commit or push capability
- deploy or release capability
- external provider task execution
- `.env` or secret access
- workflow runner support
- worktree support
- Phase297A already started

## K. 验证命令
Phase296A verification is limited to local static checks and local health / regression commands:

- `node --check apps/ai-gateway-service/src/agent-runner/readOnlyLocalAgentRunner.js`
- `node --check apps/ai-gateway-service/src/agent-runner/localAgentTaskSchema.js`
- `node --check apps/ai-gateway-service/src/entrypoints/verifyReadOnlyLocalAgentRunner.js`
- `cmd /c pnpm run verify:phase296a-read-only-local-agent-runner`
- `cmd /c pnpm run verify:phase295a-local-agent-permission-mode-gate`
- `cmd /c pnpm run verify:phase294a-safe-refactor-harness`
- `cmd /c pnpm run verify:safe-regression-matrix`
- `cmd /c pnpm run verify:phase107a-secret-safety`
- `cmd /c pnpm run health:phase12a`
- `cmd /c pnpm run doctor:phase13a`
- `cmd /c pnpm -r --if-present check`

## L. Phase297A 前置条件说明
Phase297A must not start automatically after Phase296A.

Before any later phase considers a deeper local agent path, all of the following still need explicit confirmation:

- Phase294A remains passing
- Phase295A remains passing
- Phase296A passes
- no write path has been enabled under the Phase296A name
- no route or UI has turned into a real execution surface
- `full_open` remains disabled
