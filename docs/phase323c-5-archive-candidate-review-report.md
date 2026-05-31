# Phase323C-5 Archive Candidate Review Report

本报告基于静态分析生成。

- staticOnly: true
- executedCandidateScripts: false
- deletedScripts: false
- movedEntrypoints: false
- package script 语义未改变

## Category Summary

- protected-core: 25
- active-support: 50
- historical-compatible: 253
- archive-candidate-low-risk: 87
- archive-candidate-needs-manual-review: 257
- forbidden-dangerous: 106
- unknown-review-required: 481

## Protected Core
- script:root:check
- script:root:health:phase12a
- script:root:doctor:phase13a
- script:root:verify:phase107a-secret-safety
- script:root:verify:phase312a-unified-model-library
- script:root:verify:phase313a-model-usability-matrix
- script:root:verify:phase314a-chat-gateway-task-closure
- script:root:verify:phase319a-functional-landing

## Active Support
- script:root:inventory:phase323c
- script:root:governance:phase323c
- script:root:commands:phase323c
- script:root:verify:phase308a-desktop-grade-bilingual-workbench-ux
- script:root:verify:phase312a-frontend-backend-links
- script:root:smoke:phase312a-chat-ui-runtime
- script:root:smoke:phase312a-nvidia-real-models
- script:root:smoke:phase313a-dry-run-model-verification-plan

## Historical Compatible
- script:root:benchmark:token-saving
- script:root:benchmark:rag-source-selection
- script:root:benchmark:response-cache
- script:root:benchmark:system-capability
- script:root:benchmark:response-cache-hardening
- script:root:benchmark:model-tier-routing
- script:root:benchmark:quality-cost-routing
- script:root:import:public-knowledge:preview

## Archive Candidate Low Risk
- script:root:verify:phase155a-template-export-copy-ux
- script:root:verify:phase156a-guided-onboarding-demo-dataset
- script:root:verify:phase164a-plan-output-readability
- script:root:verify:phase168a-guided-demo-mode-polish
- script:root:verify:phase169a-user-manual-navigation
- script:root:verify:phase173a-manual-qa-checklist
- script:root:verify:phase174a-evidence-manifest-final
- script:root:verify:phase177a-documentation-crosslink-index

## Archive Candidate Needs Manual Review
- script:root:verify:phase103a-product-readiness
- script:root:verify:phase154a-template-acceptance-sample-plans
- script:root:verify:phase158a-product-readiness-known-limits
- script:root:verify:phase161a-ui-information-architecture
- script:root:verify:phase170a-readme-agents-boundary-sync
- script:root:verify:phase181a-empty-state-first-use-guidance
- script:root:verify:phase191a-manual-trial-walkthrough
- script:root:verify:phase199a-real-ui-trial-runtime-sync

## Forbidden Dangerous
- script:root:run:phase282a-commit-readiness-preflight
- script:root:run:phase283a-ui-release-readiness-preflight
- script:root:run:phase284a-final-commit-package-clean-baseline-gate
- script:root:run:phase289a-deployment-runtime-stability
- script:root:verify:phase109a-deployment-readiness
- script:root:verify:phase110a-docker-readiness
- script:root:verify:phase112a-non-docker-release-check
- script:root:verify:phase113b-docker-blocker-docs

## Unknown Review Required
- script:root:build
- script:root:start:agent-console
- script:root:start:ai-gateway-service
- script:root:dev:phase7a-service
- script:root:start:pme
- script:root:smoke:mimo-route
- script:root:smoke:mimo-paid-route
- script:root:discover:mimo-model-id

## Notes

- 本轮不删除 scripts，不移动 entrypoints，不重命名任何入口。
- 本轮不执行候选脚本，只做静态分类。
- `archive-candidate-needs-manual-review` 与 `unknown-review-required` 必须继续人工复核后，才可进入未来 archive plan。
