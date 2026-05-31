# Phase323C-10 Human Review Sample Decisions

Generated: 2026-05-06T12:12:35.699Z

## 本轮不执行声明

- 本轮不删除 scripts。
- 本轮不移动 entrypoints。
- 本轮不修改 package scripts。
- 本轮不执行任何候选脚本。
- 本轮不做真实归档。
- 本轮只是记录人工结论模板。

## 样板范围

- 仅处理 Phase323C-9 的 20 个 low-risk sample items。
- 当前 decision item 数量: 20
- 默认 reviewerDecision: pending-human-review
- 允许的 status: pending, reviewed-keep, reviewed-mark-deprecated-only, reviewed-future-archive-candidate, reviewed-needs-more-context
- 允许的 futureAction: no-op, document-only, deprecated-index-only, manual-review-again, future-archive-candidate

## 20 个样板列表

| # | id | name | reviewerDecision | futureAction | status |
|---|----|------|------------------|--------------|--------|
| 1 | script:root:verify:phase155a-template-export-copy-ux | verify:phase155a-template-export-copy-ux | pending-human-review | future-archive-candidate | pending |
| 2 | script:root:verify:phase156a-guided-onboarding-demo-dataset | verify:phase156a-guided-onboarding-demo-dataset | pending-human-review | document-only | pending |
| 3 | script:root:verify:phase164a-plan-output-readability | verify:phase164a-plan-output-readability | pending-human-review | future-archive-candidate | pending |
| 4 | script:root:verify:phase168a-guided-demo-mode-polish | verify:phase168a-guided-demo-mode-polish | pending-human-review | document-only | pending |
| 5 | script:root:verify:phase169a-user-manual-navigation | verify:phase169a-user-manual-navigation | pending-human-review | future-archive-candidate | pending |
| 6 | script:root:verify:phase173a-manual-qa-checklist | verify:phase173a-manual-qa-checklist | pending-human-review | future-archive-candidate | pending |
| 7 | script:root:verify:phase174a-evidence-manifest-final | verify:phase174a-evidence-manifest-final | pending-human-review | future-archive-candidate | pending |
| 8 | script:root:verify:phase177a-documentation-crosslink-index | verify:phase177a-documentation-crosslink-index | pending-human-review | future-archive-candidate | pending |
| 9 | script:root:verify:phase180a-final-product-decision-gate | verify:phase180a-final-product-decision-gate | pending-human-review | future-archive-candidate | pending |
| 10 | script:root:verify:phase183a-terminology-consistency | verify:phase183a-terminology-consistency | pending-human-review | future-archive-candidate | pending |
| 11 | script:root:verify:phase185a-accessibility-readability | verify:phase185a-accessibility-readability | pending-human-review | future-archive-candidate | pending |
| 12 | script:root:verify:phase186a-demo-goal-copy-polish | verify:phase186a-demo-goal-copy-polish | pending-human-review | document-only | pending |
| 13 | script:root:verify:phase187a-history-detail-polish | verify:phase187a-history-detail-polish | pending-human-review | future-archive-candidate | pending |
| 14 | script:root:verify:phase188a-boundary-banner-safety-notice | verify:phase188a-boundary-banner-safety-notice | pending-human-review | future-archive-candidate | pending |
| 15 | script:root:verify:phase189a-microcopy-regression-pack | verify:phase189a-microcopy-regression-pack | pending-human-review | future-archive-candidate | pending |
| 16 | script:root:verify:phase190a-ux-polish-closure | verify:phase190a-ux-polish-closure | pending-human-review | future-archive-candidate | pending |
| 17 | script:root:verify:phase194a-final-user-trial-closure | verify:phase194a-final-user-trial-closure | pending-human-review | future-archive-candidate | pending |
| 18 | script:root:verify:phase196a-small-ui-copy-fix-pass | verify:phase196a-small-ui-copy-fix-pass | pending-human-review | future-archive-candidate | pending |
| 19 | script:root:verify:phase197a-docs-quickstart-tightening | verify:phase197a-docs-quickstart-tightening | pending-human-review | future-archive-candidate | pending |
| 20 | script:root:verify:phase198a-lightweight-iteration-closure | verify:phase198a-lightweight-iteration-closure | pending-human-review | future-archive-candidate | pending |

## 人工填写说明

- reviewerDecision 只能由人工填写，不允许脚本自动改成 archive 或 delete。
- reviewer 可填写人工审核人标识。
- reviewDate 可填写人工审核日期。
- 如人工认为应保留，仅允许改为 `reviewed-keep` 或保留 pending。
- 如人工认为只做 deprecated 标记，仅允许改为 `reviewed-mark-deprecated-only`。
- 如人工认为未来可归档，仅允许改为 `reviewed-future-archive-candidate`。
- 如仍需更多上下文，仅允许改为 `reviewed-needs-more-context`。

## 仍然不允许触发的动作

- 不允许删除 scripts。
- 不允许移动 entrypoints。
- 不允许修改 package.json。
- 不允许修改 apps/ai-gateway-service/package.json。
- 不允许执行 archive candidate 脚本。
- 不允许把 pending-human-review 自动转成真实归档动作。
- 未来真实处理必须另开新 Phase。

## Required Regression Commands

- `cmd /c pnpm run health:phase12a`
- `cmd /c pnpm run doctor:phase13a`
- `cmd /c pnpm run verify:phase321a-workbench-product-recovery`
- `cmd /c pnpm run verify:phase313a-model-usability-matrix`
- `cmd /c pnpm run verify:phase107a-secret-safety`
- `cmd /c pnpm -r --if-present check`

## 未来真实处理边界

- 未来若要做 deprecated-index-only 之外的真实动作，必须另开独立 Phase。
- 未来若要归档或删除，必须先人工确认引用链，再执行完整回归。
- 本文件不是删除计划，也不是自动归档授权。
