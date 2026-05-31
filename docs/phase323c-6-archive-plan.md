# Phase323C-6 Archive Plan

## 不执行归档声明

- 本轮不删除 scripts。
- 本轮不移动 entrypoints。
- 本轮不改 package scripts 语义。
- 本轮不执行任何 archive candidate 脚本。
- 本轮只做静态索引、只读规划和人工复核流程设计。

## 当前基线摘要

- rootScriptCount: 446
- serviceScriptCount: 403
- entrypointCount: 410
- protected-core: 25
- active-support: 50
- historical-compatible: 253
- archive-candidate-low-risk: 87
- archive-candidate-needs-manual-review: 257
- forbidden-dangerous: 106
- unknown-review-required: 481

## 未来归档流程建议

- Stage A：只读索引。持续刷新 inventory、archive review、deprecated index，不执行候选脚本。
- Stage B：人工复核 low-risk / manual-review。逐项确认是否仍被当前产品链路、验证链路或文档引用。
- Stage C：deprecated alias / warning index。先生成面向人的弃用索引，不删除原入口。
- Stage D：归档路径设计。为未来归档保留独立目录、说明文档和回滚路径。
- Stage E：小批量迁移。每次只处理一小组低风险候选，禁止批量移动。
- Stage F：验证回归。每次迁移后必须重跑 product recovery、secret safety、主链回归。
- Stage G：最终删除或长期保留。只有在多轮人工复核和回归后，才决定删除或继续保留为历史入口。

## 归档候选门槛

- 必须不属于 protected-core。
- 必须不影响 Phase322A 主链。
- 必须不影响 5 个 Workbench 主模块。
- 必须不影响 secret safety。
- 必须不是 providerConfig / diagnostics / chat-gateway 主链验证。
- 必须至少经过一轮人工复核。

## 禁止默认执行类别

- forbidden-dangerous 中的 release / deploy / commit / push / docker publish / GitHub release 等脚本只能作为历史资产保留，不允许默认执行。
- 这类入口未来只能出现在只读索引、风险说明或人工操作手册中，不能加入推荐命令集。

## 人工复核优先级

- 第一优先级：archive-candidate-needs-manual-review。
- 第二优先级：unknown-review-required。
- 第三优先级：forbidden-dangerous。

## 代表性样例

### protected-core
- script:root:check
- script:root:health:phase12a
- script:root:doctor:phase13a
- script:root:verify:phase107a-secret-safety
- script:root:verify:phase312a-unified-model-library
- script:root:verify:phase313a-model-usability-matrix
- script:root:verify:phase314a-chat-gateway-task-closure
- script:root:verify:phase319a-functional-landing

### archive-candidate-low-risk
- script:root:verify:phase155a-template-export-copy-ux
- script:root:verify:phase156a-guided-onboarding-demo-dataset
- script:root:verify:phase164a-plan-output-readability
- script:root:verify:phase168a-guided-demo-mode-polish
- script:root:verify:phase169a-user-manual-navigation
- script:root:verify:phase173a-manual-qa-checklist
- script:root:verify:phase174a-evidence-manifest-final
- script:root:verify:phase177a-documentation-crosslink-index

### archive-candidate-needs-manual-review
- script:root:verify:phase103a-product-readiness
- script:root:verify:phase154a-template-acceptance-sample-plans
- script:root:verify:phase158a-product-readiness-known-limits
- script:root:verify:phase161a-ui-information-architecture
- script:root:verify:phase170a-readme-agents-boundary-sync
- script:root:verify:phase181a-empty-state-first-use-guidance
- script:root:verify:phase191a-manual-trial-walkthrough
- script:root:verify:phase199a-real-ui-trial-runtime-sync

### forbidden-dangerous
- script:root:run:phase282a-commit-readiness-preflight
- script:root:run:phase283a-ui-release-readiness-preflight
- script:root:run:phase284a-final-commit-package-clean-baseline-gate
- script:root:run:phase289a-deployment-runtime-stability
- script:root:verify:phase109a-deployment-readiness
- script:root:verify:phase110a-docker-readiness
- script:root:verify:phase112a-non-docker-release-check
- script:root:verify:phase113b-docker-blocker-docs

### unknown-review-required
- script:root:build
- script:root:start:agent-console
- script:root:start:ai-gateway-service
- script:root:dev:phase7a-service
- script:root:start:pme
- script:root:smoke:mimo-route
- script:root:smoke:mimo-paid-route
- script:root:discover:mimo-model-id

## 输入来源

- review json: `docs\phase323c-5-archive-candidate-review.json`
- review report: `docs\phase323c-5-archive-candidate-review-report.md`
- inventory: `docs\phase323c-script-entrypoint-inventory.json`
- governance: `docs\phase323c-script-governance-policy.md`
- service governance: `docs\phase323c-service-command-governance-policy.md`

## Governance Headings Snapshot

- tier-0-core-daily
- tier-1-product-regression
- tier-2-provider-model-regression
- tier-3-security-boundary
- tier-4-historical-compatible
- tier-5-archive-candidate
- Service Daily Core Commands
- Service Workbench Regression Commands
- Service Model-Library Commands
- Service Safety Commands

## Archive Review Report Note

- 上游 review report 行数: 96
- 本计划沿用 Phase323C-5 的静态分类结果，不新增运行时判断。
