# UI-ready Approved Local Operation Loop

## A. Phase303A-305A Goal And Boundary
Phase303A-305A turns the Phase302A UI-ready intent explanation into a controlled local operation loop. The loop can preview intent, create a patch proposal, require an approval record, apply an approved patch through the approved patch runner, run a bounded Auto Review Loop, and record evidence/rollback metadata.

The boundary is intentionally narrow: no full-open mode, no unattended infinite loop, no commit, no push, no deploy, no release, no workflow runner, no worktree, no real Codex exec, no provider call, and no `.env` or secret access.

## B. Upstream Phase294A-302A Dependencies
This phase depends on:
- Phase294A Safe Refactor Harness.
- Phase295A Local Agent Permission Mode Gate.
- Phase296A Read-only Local Agent Runner.
- Phase297A-298A Approved Patch Runner and Auto Review Loop.
- Phase299A Local Agent Operator Preview Panel.
- Phase301A Chat-to-Local-Agent Intent Preview.
- Phase302A UI-ready Intent Explanation and Approval Preview with `routeAdded=true` and `uiUpdated=true`.

## C. User-ready Flow
The intended `/ui` flow is:
- User enters a local operation request.
- System classifies intent and explains risk.
- User chooses Manual Approval Mode or Auto Review Mode.
- User explicitly fills `allowedFiles`.
- System generates a patch proposal and diff preview without writing.
- User explicitly approves apply.
- System applies only through the approved patch runner when every safety gate passes.
- System runs Auto Review Loop only with whitelisted commands and bounded rounds.
- System returns `go`, `no-go`, or `review-required`.
- System records evidence paths and rollback manifest metadata.

## D. Permission Mode Selection
Only two permission modes are available:
- Manual Approval Mode: writes require explicit user approval.
- Auto Review Mode: safe verifier commands may run when approved and whitelisted, but patch apply still requires approval.

Full-open is disabled and is not a selectable permission mode.

## E. allowedFiles Required Rule
`allowedFiles` must be explicit before any apply path. Empty `allowedFiles` is acceptable for preview, but it blocks approval and real apply. The apply runner may only touch paths listed in `allowedFiles`.

## F. Patch Proposal And Diff Preview Rules
Patch proposal generation is read-only. It does not write files and does not apply patches. A proposal contains:
- `operationId`
- `allowedFiles`
- `proposedChanges`
- `diffPreview`
- `forbiddenPathCheck`
- `approvalRequired: true`
- `readyToApply`

The diff preview intentionally omits raw content from the UI summary and remains non-executing metadata until the user approves.

## G. Approval Record Rules
An approval record must include:
- `operationId`
- `input`
- `intentType`
- `riskLevel`
- `permissionMode`
- `allowedFiles`
- `approvedByUser`
- `approvedAt`
- `status`
- `dryRun`
- `fullOpenAllowed=false`
- `autoCommit=false`
- `autoPush=false`
- `releaseOrDeploy=false`

Allowed status values are `draft`, `approved`, and `rejected`. A blocked intent, empty `allowedFiles`, forbidden path, or full-open request cannot become approved for apply.

## H. Real Apply Patch Safety Gate
Real apply is allowed only when all gates pass:
- `approvalRecord.status === "approved"`
- `approvalRecord.approvedByUser === true`
- `approvalRecord.dryRun === false`
- request `dryRun === false`
- `allowedFiles` is non-empty
- forbidden path checks pass
- patch proposal is `readyToApply === true`
- actual writing is delegated only to `approvedPatchRunner`

If any gate fails, the operation returns blocked metadata and does not write.

## I. Auto Review Loop Whitelist Rules
Auto Review Loop may only run commands allowed by the existing Auto Review policy, including bounded `node --check`, `cmd /c pnpm run verify:*`, `cmd /c pnpm run health:phase12a`, `cmd /c pnpm run doctor:phase13a`, and `cmd /c pnpm -r --if-present check` where supported by the policy.

`maxRounds` is capped at 3. A failed or blocked command stops the loop. The loop does not auto-fix.

## J. go / no-go / review-required Rules
Auto Review Loop returns:
- `go` only when checks complete without blockers.
- `no-go` when a blocker or failed command appears.
- `review-required` when the result needs human judgment, such as dry-run review or skipped commands.

## K. Rollback Manifest Rules
Every apply attempt returns rollback manifest metadata. The manifest records file summaries and hashes rather than secret values. Auto rollback remains disabled; rollback is an operator-reviewed manual action.

## L. Fail-fast Rule
The loop stops on the first blocker. It does not continue into more rounds, does not auto-repair, and does not retry indefinitely.

## M. Forbidden Capabilities
This phase forbids:
- full-open
- commit
- push
- deploy
- release
- destructive git cleanup
- `.env` or secret reads
- legacy mutation
- `PROJECT_CONTEXT.md` creation
- real Codex exec
- worktree creation
- workflow runner integration

## N. UI Usage
Open `/ui` and use the `Approved Local Operation Loop` panel:
- Enter a local operation request.
- Select Manual Approval Mode or Auto Review Mode.
- Fill exact `allowedFiles`.
- Click `Preview Intent`.
- Click `Generate Patch Proposal`.
- Review blockers, warnings, diff preview, and rollback summary.
- Click `Approve Apply` only when the proposal is ready and explicitly approved.
- Click `Run Auto Review` to run the bounded review path.
- Click `Stop / Reset Current Operation` to clear state.

The panel displays that full-open is disabled, commit/push/deploy/release are unavailable, `.env` and secrets are blocked, `legacy/` is blocked, and a dirty workspace must not be described as clean.

## O. HTTP Route
This phase adds one route:
- `POST /agent-runner/local-operation`

The route accepts `action`:
- `preview`: intent, explanation, approval preview, execution preview all non-writing.
- `propose`: patch proposal and diff preview only.
- `apply-approved`: approved patch apply through safety gates and `approvedPatchRunner`.
- `auto-review`: bounded Auto Review Loop with whitelist commands and `maxRounds <= 3`.

The default `/chat` route is not changed.

## P. Capabilities That Must Not Be Claimed
This phase must not claim global release readiness, cloud deployment, production multi-user safety, real Codex execution, workflow runner execution, full-open automation, automatic commit/push, or an always-clean workspace.

## Q. Suggested Phase306A Direction
A later Phase306A may consider richer patch authoring UX, better rollback presentation, and stronger per-file edit review. Do not start Phase306A from this phase.
