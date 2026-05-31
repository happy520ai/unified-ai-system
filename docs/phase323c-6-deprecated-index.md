# Phase323C-6 Deprecated Index

## Summary

- protected-core: 25
- active-support: 50
- historical-compatible: 253
- archive-candidate-low-risk: 87
- archive-candidate-needs-manual-review: 257
- forbidden-dangerous: 106
- unknown-review-required: 481

## Future Action Rules

- `keep`: 当前必须保留或仍然是活跃支撑入口。
- `deprecate-index-only`: 允许进入弃用索引，但本轮不删除、不移动。
- `manual-review`: 必须先人工复核，再决定是否进入弃用索引下一阶段。
- `forbidden-do-not-run`: 仅保留历史记录和风险说明，不允许默认执行。
- `unknown-review-required`: 用途未明，必须先人工确认。

## Protected Core
- script:root:check
- script:root:health:phase12a
- script:root:doctor:phase13a
- script:root:verify:phase107a-secret-safety
- script:root:verify:phase312a-unified-model-library
- script:root:verify:phase313a-model-usability-matrix
- script:root:verify:phase314a-chat-gateway-task-closure
- script:root:verify:phase319a-functional-landing
- script:root:verify:phase321a-workbench-product-recovery
- script:root:verify:phase322a-workbench-chat-gateway-real-nvidia

## Low Risk Candidates
- script:root:verify:phase155a-template-export-copy-ux
- script:root:verify:phase156a-guided-onboarding-demo-dataset
- script:root:verify:phase164a-plan-output-readability
- script:root:verify:phase168a-guided-demo-mode-polish
- script:root:verify:phase169a-user-manual-navigation
- script:root:verify:phase173a-manual-qa-checklist
- script:root:verify:phase174a-evidence-manifest-final
- script:root:verify:phase177a-documentation-crosslink-index
- script:root:verify:phase180a-final-product-decision-gate
- script:root:verify:phase183a-terminology-consistency

## Manual Review Required
- script:root:verify:phase103a-product-readiness
- script:root:verify:phase154a-template-acceptance-sample-plans
- script:root:verify:phase158a-product-readiness-known-limits
- script:root:verify:phase161a-ui-information-architecture
- script:root:verify:phase170a-readme-agents-boundary-sync
- script:root:verify:phase181a-empty-state-first-use-guidance
- script:root:verify:phase191a-manual-trial-walkthrough
- script:root:verify:phase199a-real-ui-trial-runtime-sync
- script:root:verify:phase200a-real-ui-trial-final-seal
- script:root:verify:phase204a-safe-desktop-runner-design

## Forbidden Dangerous
- script:root:run:phase282a-commit-readiness-preflight
- script:root:run:phase283a-ui-release-readiness-preflight
- script:root:run:phase284a-final-commit-package-clean-baseline-gate
- script:root:run:phase289a-deployment-runtime-stability
- script:root:verify:phase109a-deployment-readiness
- script:root:verify:phase110a-docker-readiness
- script:root:verify:phase112a-non-docker-release-check
- script:root:verify:phase113b-docker-blocker-docs
- script:root:verify:phase114a-user-manual-release-pack
- script:root:verify:phase115a-docker-runtime-recheck

## Unknown Review Required
- script:root:build
- script:root:start:agent-console
- script:root:start:ai-gateway-service
- script:root:dev:phase7a-service
- script:root:start:pme
- script:root:smoke:mimo-route
- script:root:smoke:mimo-paid-route
- script:root:discover:mimo-model-id
- script:root:calibrate:token-estimator
- script:root:audit:full-codebase

## Safety Statement

- 本轮只生成 deprecated index，不删除 scripts，不移动 entrypoints。
- 本轮不执行任何 candidate 脚本，不改变 package scripts 语义。
