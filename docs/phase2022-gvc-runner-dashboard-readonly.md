# Phase2022-GVC-Runner-Dashboard-ReadOnly

## Goal

Add a read-only GVC runner dashboard in Mission Control / Owner OS so the owner can see runner status without opening JSON files.

## Scope

- 只读 UI only.
- Reads `docs/project-brain/timed-runner-state.json`.
- Reads `docs/project-brain/runner-control.json`.
- Reads `apps/ai-gateway-service/evidence/gvc-execution-history.json`.
- Reads latest Phase2021 runner-control evidence summary.

## Display Contract

The panel shows:

- runner 是否运行
- 当前是否 paused
- 今日 loop 次数
- 最近执行任务
- 最近 blocker
- skipped approval_required
- safety flags
- evidence 路径

## Boundary

- 不新增执行按钮.
- 不新增 Provider 按钮.
- 不新增真实 stop/start 操作.
- No Provider call.
- No secret read.
- No deploy, release, tag, artifact upload, push, or commit.
- No `/chat` modification.
- No `/chat-gateway/execute` modification.
- No `legacy/` modification.
- No `PROJECT_CONTEXT.md` modification.

## Verification

```powershell
node --check apps/ai-gateway-service/src/ui/components/GvcRunnerDashboardPanel.js
node --check apps/ai-gateway-service/src/ui/components/MissionControlPanel.js
node --check apps/ai-gateway-service/src/entrypoints/verifyPhase2022GvcRunnerDashboardReadOnly.js
pnpm run verify:phase2022-gvc-runner-dashboard-readonly
pnpm run smoke:phase308a-desktop-workbench-ui
pnpm run verify:phase107a-secret-safety
pnpm run verify:phase321a-workbench-product-recovery
pnpm -r --if-present check
```

## Evidence

- `apps/ai-gateway-service/evidence/phase2022-gvc-runner-dashboard-readonly/runner-dashboard-readonly-result.json`
- `apps/ai-gateway-service/evidence/phase2022-gvc-runner-dashboard-readonly/runner-dashboard-readonly-result.md`
