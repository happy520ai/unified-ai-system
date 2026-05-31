# Local Agent Operator Preview Panel

## A. Phase299A 目标和边界
Phase299A adds a read-only operator preview layer for the local agent safety stack introduced in Phase295A, Phase296A, and Phase297A-298A.

This phase is strictly bounded to read-only operator preview only:

- no new execution capability
- no real patch apply
- no auto review execution
- no external provider call
- no paid API, MiMo, or embedding
- no real Codex exec
- no workflow runner
- no worktree
- no commit, push, deploy, or release
- no full-open mode

The preview exists so an operator can inspect current mode, dry-run posture, approval posture, whitelist rules, blocked rules, rollback summary, and review status semantics without executing anything.

## B. 上游 Phase294A/295A/296A/297A-298A 依赖
Phase299A depends on these upstream boundaries remaining in place:

- Phase294A Safe Refactor Harness
- Phase295A Local Agent Permission Mode Gate
- Phase296A Read-only Local Agent Runner
- Phase297A-298A Approved Patch Runner + Auto Review Loop

Phase299A inherits all earlier boundaries:

- `legacy/` remains blocked
- `PROJECT_CONTEXT.md` remains blocked
- default NVIDIA `/chat` remains unchanged
- `.env` and secret access remain blocked
- workspace may be dirty and must not be described as clean

## C. Operator Preview 展示内容
The operator preview may display only read-only state summaries such as:

- supported permission modes
- `full_open` disabled state
- patch runner dry-run defaults
- approval requirement defaults
- allowed files versus forbidden paths summary
- allowed commands versus blocked commands summary
- auto review max rounds summary
- rollback manifest summary rules
- `go`, `no-go`, and `review-required` status meanings
- operator-facing warnings and informational notes

## D. Permission Mode 状态展示规则
The preview must show:

- `manual`
- `auto_review`
- `full_open` disabled

For each enabled preview mode, the panel may show:

- mode label
- `requireApprovalBeforeWrite`
- `requireApprovalBeforePatchApply`
- `autoRunSafeVerifiers`
- blocked path rules
- blocked command rules

It must not display any mode as execution-unrestricted.

## E. Patch Approval 状态展示规则
The preview must show that patch application remains approval-gated.

Recommended preview fields:

- human approval required
- manual mode requires per-patch approval
- auto review mode still requires approved task or patch scope
- patch apply is blocked by default
- patch targets must stay inside explicit `allowedFiles`

The preview must not imply that approval metadata equals already-executed apply.

## F. Dry-run / Apply-ready 状态展示规则
The preview must make the dry-run boundary obvious:

- `dryRunDefault=true`
- `realPatchAppliedByDefault=false`
- apply-ready requires approved record and explicit non-dry-run path

Phase299A is preview-only, so the panel may describe apply-ready rules but must not trigger them.

## G. Auto Review Loop 状态展示规则
The preview may show:

- `dryRunDefault=true`
- `maxRoundsDefault=1`
- `maxRoundsLimit=3`
- `autoFixEnabled=false`
- whitelist-only command policy
- failure-stop behavior

It must not execute the loop or present the loop as always-on automation.

## H. allowedFiles / forbiddenPaths 展示规则
The preview may summarize that approved patch targets must stay inside explicit `allowedFiles`.

The preview must also show that forbidden paths include at minimum:

- `legacy/`
- `PROJECT_CONTEXT.md`
- `.env`
- `.git`
- `node_modules`

It must not suggest that forbidden paths can be bypassed by mode selection.

## I. allowedCommands / blockedCommands 展示规则
The preview may summarize the local review whitelist:

- `node --check`
- `cmd /c pnpm run verify:`
- `cmd /c pnpm run health:phase12a`
- `cmd /c pnpm run doctor:phase13a`
- `cmd /c pnpm -r --if-present check`

It must also summarize blocked commands such as:

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
- `gh workflow run`

## J. maxRounds / stop rules 展示规则
The preview must show:

- default `maxRounds=1`
- hard cap `maxRoundsLimit=3`
- stop on blocked command
- stop on verifier failure
- stop on boundary violation
- no unattended infinite loop

## K. rollback manifest 摘要展示规则
The preview may show rollback manifest summary semantics only:

- changed files are recorded
- before and after summary or hash is recorded
- secret content is not recorded
- `.env` content is not recorded
- automatic rollback is not enabled

The preview must not expose a rollback execution button or command.

## L. go / no-go / review-required 展示规则
The preview may explain:

- `go`: checks passed and no blocker remains
- `no-go`: blocker, boundary failure, or command failure exists
- `review-required`: warnings, skipped commands, pending approval, or preview-only status still needs a human decision

The preview may show a sample or latest read-only review shape, but must not run review execution.

## M. 不可执行能力说明
Phase299A does not add:

- patch apply execution
- auto review execution
- commit or push
- deploy or release
- worktree execution
- workflow runner execution
- external provider-backed agent execution
- real Codex exec

It is an operator-facing read-only summary layer only.

## N. 不可声称能力说明
Phase299A must not claim:

- full-open local agent mode
- unattended execution
- automatic patching
- automatic review loop execution
- clean workspace guarantee
- `.env` or secret access
- provider call capability
- execution buttons already enabled in UI
- route-based execution support

## O. Phase300A 后续建议，但不要执行
If a later phase is approved, the next safe step should still stay read-first:

- show richer operator context
- show approval record provenance
- show review evidence linkage
- show why a state is blocked

The next phase should not automatically expand into real execution capability.
