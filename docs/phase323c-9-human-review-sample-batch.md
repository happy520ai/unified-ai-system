# Phase323C-9 Human Review Sample Batch

Generated: 2026-05-06T12:12:35.651Z

## Declarations

- **本轮不删除 scripts**
- **本轮不移动 entrypoints**
- **本轮不改 package scripts**
- **本轮不执行候选脚本**
- **本轮不做真实归档**

## Current Baseline

- Total low-risk candidates: 87
- Selected for this sample: 20

## Decision Summary

- keep: 0
- keep-historical-compatible: 3
- mark-deprecated-only: 0
- candidate-for-future-archive: 17
- needs-more-context: 0

## Sample Items

| # | id | name | proposedHumanDecision | proposedFutureAction |
|---|-----|------|----------------------|---------------------|
| script:root:verify:phase155a-template-export-copy-ux | script:root:verify:phase155a-template-export-copy- | verify:phase155a-template-export-co | candidate-for-future-archive | future-archive-candidate |
| script:root:verify:phase156a-guided-onboarding-demo-dataset | script:root:verify:phase156a-guided-onboarding-dem | verify:phase156a-guided-onboarding- | keep-historical-compatible | document-only |
| script:root:verify:phase164a-plan-output-readability | script:root:verify:phase164a-plan-output-readabili | verify:phase164a-plan-output-readab | candidate-for-future-archive | future-archive-candidate |
| script:root:verify:phase168a-guided-demo-mode-polish | script:root:verify:phase168a-guided-demo-mode-poli | verify:phase168a-guided-demo-mode-p | keep-historical-compatible | document-only |
| script:root:verify:phase169a-user-manual-navigation | script:root:verify:phase169a-user-manual-navigatio | verify:phase169a-user-manual-naviga | candidate-for-future-archive | future-archive-candidate |
| script:root:verify:phase173a-manual-qa-checklist | script:root:verify:phase173a-manual-qa-checklist | verify:phase173a-manual-qa-checklis | candidate-for-future-archive | future-archive-candidate |
| script:root:verify:phase174a-evidence-manifest-final | script:root:verify:phase174a-evidence-manifest-fin | verify:phase174a-evidence-manifest- | candidate-for-future-archive | future-archive-candidate |
| script:root:verify:phase177a-documentation-crosslink-index | script:root:verify:phase177a-documentation-crossli | verify:phase177a-documentation-cros | candidate-for-future-archive | future-archive-candidate |
| script:root:verify:phase180a-final-product-decision-gate | script:root:verify:phase180a-final-product-decisio | verify:phase180a-final-product-deci | candidate-for-future-archive | future-archive-candidate |
| script:root:verify:phase183a-terminology-consistency | script:root:verify:phase183a-terminology-consisten | verify:phase183a-terminology-consis | candidate-for-future-archive | future-archive-candidate |
| script:root:verify:phase185a-accessibility-readability | script:root:verify:phase185a-accessibility-readabi | verify:phase185a-accessibility-read | candidate-for-future-archive | future-archive-candidate |
| script:root:verify:phase186a-demo-goal-copy-polish | script:root:verify:phase186a-demo-goal-copy-polish | verify:phase186a-demo-goal-copy-pol | keep-historical-compatible | document-only |
| script:root:verify:phase187a-history-detail-polish | script:root:verify:phase187a-history-detail-polish | verify:phase187a-history-detail-pol | candidate-for-future-archive | future-archive-candidate |
| script:root:verify:phase188a-boundary-banner-safety-notice | script:root:verify:phase188a-boundary-banner-safet | verify:phase188a-boundary-banner-sa | candidate-for-future-archive | future-archive-candidate |
| script:root:verify:phase189a-microcopy-regression-pack | script:root:verify:phase189a-microcopy-regression- | verify:phase189a-microcopy-regressi | candidate-for-future-archive | future-archive-candidate |
| script:root:verify:phase190a-ux-polish-closure | script:root:verify:phase190a-ux-polish-closure | verify:phase190a-ux-polish-closure | candidate-for-future-archive | future-archive-candidate |
| script:root:verify:phase194a-final-user-trial-closure | script:root:verify:phase194a-final-user-trial-clos | verify:phase194a-final-user-trial-c | candidate-for-future-archive | future-archive-candidate |
| script:root:verify:phase196a-small-ui-copy-fix-pass | script:root:verify:phase196a-small-ui-copy-fix-pas | verify:phase196a-small-ui-copy-fix- | candidate-for-future-archive | future-archive-candidate |
| script:root:verify:phase197a-docs-quickstart-tightening | script:root:verify:phase197a-docs-quickstart-tight | verify:phase197a-docs-quickstart-ti | candidate-for-future-archive | future-archive-candidate |
| script:root:verify:phase198a-lightweight-iteration-closure | script:root:verify:phase198a-lightweight-iteration | verify:phase198a-lightweight-iterat | candidate-for-future-archive | future-archive-candidate |

## Why These Are Samples Only

Each item in this batch is a **Priority 3 low-risk candidate**:

- They are not part of the Phase322A real Chat main chain.
- They are not part of the 5 Workbench main modules.
- They are not part of the secret safety verification chain.
- They are not part of the diagnostics / providerConfig / fileContext bridge.
- They have been classified as low-risk by the Phase323C archive review.
- However, **no item has been verified as truly unused by any verification chain** in this phase.
- Therefore, this batch is **human review template only**, not a deletion plan.

## Batch Review Operation Steps

1. **Read**: Review each item's id, name, source, and reason.
2. **Check**: For each item, verify it is not referenced by any active verification script or documentation.
3. **Decide**: Assign one of the allowed human decisions:
   - `keep`
   - `keep-historical-compatible`
   - `mark-deprecated-only`
   - `candidate-for-future-archive`
   - `needs-more-context`
4. **Record**: Fill in the decision in the batch JSON.
5. **Do NOT execute any deletion or movement in this phase.**

## Required Regression Commands

- `cmd /c pnpm run health:phase12a`
- `cmd /c pnpm run doctor:phase13a`
- `cmd /c pnpm run verify:phase321a-workbench-product-recovery`
- `cmd /c pnpm run verify:phase313a-model-usability-matrix`
- `cmd /c pnpm run verify:phase107a-secret-safety`
- `cmd /c pnpm -r --if-present check`

## Rollback Plan

- 如误删或误移动，必须通过 `git revert` 回退。
- 不 reset、不 clean、不 force push、不自动恢复。

## Next Phase Requirement

如要对这批候选做真实处理（删除、移动、归档），**必须另开新 Phase**，并在新 Phase 中：

1. 对每个 item 做独立人工确认。
2. 执行完整回归验证（health + doctor + product recovery + model usability + secret safety + check）。
3. 如果涉及生产 UI 或 Chat 主链，额外执行 `verify:phase322a-workbench-chat-gateway-real-nvidia`。
4. 用 `git revert` 做回滚保障。
5. 不得批量删除或移动。
