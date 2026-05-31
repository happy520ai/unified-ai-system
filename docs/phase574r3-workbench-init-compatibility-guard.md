# Phase574R-3 Workbench Init Compatibility Guard

## Goal

Prevent Mission Control first-screen initialization from showing a fatal red
toast when `workbenchApiClient.listApprovals` is unavailable in a local dry-run
build.

The Phase574R-2 sample dry-run order remains locked:

1. Initial screen shows `试用一个任务 / 开始 sample dry-run`.
2. Initial screen keeps the Sample dry-run result hidden.
3. Clicking `开始 sample dry-run` expands the result.
4. Clicking `查看执行详情` opens the detail drawer.

## Root Cause

`consolePage.js` creates an in-page `workbenchApiClient` bridge through
`createWorkbenchApiBridge()`. The Workbench initialization flow calls
`loadApprovals()`, which previously assumed
`workbenchApiClient.listApprovals()` always exists.

In the affected local dry-run surface, that method was not guaranteed, so
initialization could throw:

`workbenchApiClient.listApprovals is not a function`

That exception was caught by the global bootstrap catch block and shown as a
fatal red initialization toast.

Note: the repository also has `apps/ai-gateway-service/src/ui/workbench/apiClient.js`.
The requested candidate path `src/ui/workbenchApiClient.js` does not exist in
this repository. The active failing caller is in `consolePage.js`.

## Fix

`loadApprovals()` now checks:

```js
const canListApprovals =
  workbenchApiClient && typeof workbenchApiClient.listApprovals === "function";
```

If the method exists, the original list behavior runs.

If the method is missing:

- no exception is thrown
- no red fatal initialization toast is shown
- `state.approvals` is set to an empty list
- `state.approvalsUnsupported=true`
- the approvals panel shows a non-fatal local dry-run unavailable message
- Mission Control and sample dry-run remain usable

Only the missing `listApprovals` method is guarded. Other initialization errors
still surface through the existing bootstrap error path.

## Safety Boundary

- no-provider-call
- no-secret
- no-deploy
- no-billing
- no-invoice
- no `/chat` changes
- no `/chat-gateway/execute` changes
- no provider runtime changes
- no credential or secret-reading changes
- no Yiyi, character, guided showcase, or floating avatar restoration
- no commit, push, deploy, release, tag, or artifact upload

## Verification

`tools/phase574r3/validate-workbench-init-compatibility-guard.mjs` starts a
fake-provider local service, opens `/ui` in real Chromium/CDP, verifies there is
no visible initialization failure, then clicks the sample dry-run and details
drawer path.

The Phase574, Phase574R, Phase574R-2, and Phase574R-3 browser verifiers use
software-rendered single-process Chromium flags in this Windows environment.
This keeps the verification target equivalent while avoiding a local headless
GPU crash (`GPU process isn't usable`) that prevented CDP from reaching the
Mission Control page.

## Evidence

- `apps/ai-gateway-service/evidence/phase574r3/workbench-init-compatibility-guard-result.json`
- `apps/ai-gateway-service/evidence/phase574r3/initial-no-init-error.png`
- `apps/ai-gateway-service/evidence/phase574r3/after-click-sample-dry-run.png`
- `apps/ai-gateway-service/evidence/phase574r3/detail-drawer-open.png`
- `apps/ai-gateway-service/evidence/phase574r3/dom-snapshot.html`

## Rollback

Only revert this phase:

- delete `tools/phase574r3/`
- delete this document
- delete `docs/phase574r3-execution-report.md`
- delete `apps/ai-gateway-service/evidence/phase574r3/`
- revert the Phase574R-3 `loadApprovals()` guard and `approvalsUnsupported`
  rendering in `consolePage.js`

Do not use `git reset --hard` or `git clean -fd` without explicit user approval.
