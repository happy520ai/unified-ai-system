# Phase574R-2 First-Screen Sample Entry UX Lock

## Goal

Lock the Mission Control first-screen trial order after Phase574R:

1. Initial Mission Control view shows the sample entry first.
2. Initial view keeps the Sample dry-run result hidden.
3. Clicking `开始 sample dry-run` expands the dry-run result chain.
4. Clicking `查看执行详情` opens the evidence detail drawer.

## Scope

This phase is limited to UI interaction order and verifier coverage for the
sample dry-run path. It does not add real provider execution and does not change
the chat runtime.

## UX Contract

Initial state:

- `Mission Control` is visible.
- `试用一个任务 / Try a sample task` is visible.
- `开始 sample dry-run` is visible.
- `Sample dry-run result` is not expanded.
- Evidence detail drawer is closed.

After clicking `开始 sample dry-run`:

- `Sample dry-run result` is visible.
- `Mission Understanding` is visible.
- `Recommended Mode` recommends `Tianshu`.
- `Normal / God / Tianshu` explanations are visible.
- `Security Shield`, `Provider / CredentialRef`, `Evidence Replay`, and `Next Step`
  are visible.

After clicking `查看执行详情`:

- The detail drawer opens.
- The drawer shows structured sample dry-run JSON.
- The JSON keeps `providerCallsMade=false` and `secretValueExposed=false`.

## Boundary

- no-provider-call
- no-secret
- no-deploy
- no-billing
- no-invoice
- no release, tag, artifact upload, commit, or push
- no `/chat` or `/chat-gateway/execute` changes
- no provider runtime changes
- no Yiyi, character, guided showcase, or floating avatar restoration

## Verification

The verifier at
`tools/phase574r2/validate-first-screen-sample-entry-ux-lock.mjs` starts a local
fake-provider service, opens `/ui` with real Chromium/CDP, captures screenshots,
checks initial state, clicks the sample dry-run button, checks the expanded
result, clicks the details button, and writes evidence JSON.

## Evidence

- `apps/ai-gateway-service/evidence/phase574r2/first-screen-sample-entry-ux-lock-result.json`
- `apps/ai-gateway-service/evidence/phase574r2/initial-first-screen.png`
- `apps/ai-gateway-service/evidence/phase574r2/after-click-sample-dry-run.png`
- `apps/ai-gateway-service/evidence/phase574r2/detail-drawer-open.png`
- `apps/ai-gateway-service/evidence/phase574r2/dom-snapshot.html`

## Rollback

Only revert this phase's scoped changes:

- Delete `tools/phase574r2/`.
- Delete this document and `docs/phase574r2-execution-report.md`.
- Delete `apps/ai-gateway-service/evidence/phase574r2/`.
- Revert the Phase574R-2 interaction-order change in `consolePage.js`.

Do not use `git reset --hard` or `git clean` without explicit user approval.
