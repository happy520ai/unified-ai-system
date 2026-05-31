# Phase323C-7 Deprecated Human Review Checklist

## 本轮不执行声明

- 不删除 scripts。
- 不移动 entrypoints。
- 不改 package scripts。
- 不执行候选脚本。
- 不运行 release / deploy / commit / push / docker publish / GitHub release 类脚本。

## 人工复核优先级

- Priority 0 forbidden-dangerous: 106
- Priority 1 unknown-review-required: 481
- Priority 2 archive-candidate-needs-manual-review: 257
- Priority 3 archive-candidate-low-risk: 87
- Priority 4 historical-compatible: 253
- Priority 5 protected-core: 25

## 人工复核流程

- 先确认来源、用途、当前依赖方，再决定是否进入未来 archive 候选。
- `forbidden-dangerous` 只允许标记为 `forbidden-do-not-run`。
- `unknown-review-required` 与 `archive-candidate-needs-manual-review` 不得自动归档。
- `archive-candidate-low-risk` 仍需至少一次人工确认。
- 任何真实归档必须另开阶段，并执行回归验证。

## Representative Samples

### Priority 0 forbidden-dangerous
- script:root:run:phase282a-commit-readiness-preflight
- script:root:run:phase283a-ui-release-readiness-preflight
- script:root:run:phase284a-final-commit-package-clean-baseline-gate
- script:root:run:phase289a-deployment-runtime-stability
- script:root:verify:phase109a-deployment-readiness
- script:root:verify:phase110a-docker-readiness
- script:root:verify:phase112a-non-docker-release-check
- script:root:verify:phase113b-docker-blocker-docs

### Priority 1 unknown-review-required
- script:root:build
- script:root:start:agent-console
- script:root:start:ai-gateway-service
- script:root:dev:phase7a-service
- script:root:start:pme
- script:root:smoke:mimo-route
- script:root:smoke:mimo-paid-route
- script:root:discover:mimo-model-id

### Priority 2 archive-candidate-needs-manual-review
- script:root:verify:phase103a-product-readiness
- script:root:verify:phase154a-template-acceptance-sample-plans
- script:root:verify:phase158a-product-readiness-known-limits
- script:root:verify:phase161a-ui-information-architecture
- script:root:verify:phase170a-readme-agents-boundary-sync
- script:root:verify:phase181a-empty-state-first-use-guidance
- script:root:verify:phase191a-manual-trial-walkthrough
- script:root:verify:phase199a-real-ui-trial-runtime-sync

### Priority 3 archive-candidate-low-risk
- script:root:verify:phase155a-template-export-copy-ux
- script:root:verify:phase156a-guided-onboarding-demo-dataset
- script:root:verify:phase164a-plan-output-readability
- script:root:verify:phase168a-guided-demo-mode-polish
- script:root:verify:phase169a-user-manual-navigation
- script:root:verify:phase173a-manual-qa-checklist
- script:root:verify:phase174a-evidence-manifest-final
- script:root:verify:phase177a-documentation-crosslink-index

## Future Action Vocabulary

- `keep`
- `protected-do-not-touch`
- `manual-review`
- `deprecate-index-only`
- `candidate-for-future-archive`
- `forbidden-do-not-run`
- `unknown-review-required`
