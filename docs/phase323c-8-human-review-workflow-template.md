# Phase323C-8 Human Review Workflow Template

Generated: 2026-05-06T12:12:24.997Z

## Declarations

- 不删除 scripts
- 不移动 entrypoints
- 不改 package scripts 语义
- 不执行候选脚本
- 不运行 release / deploy / commit / push / docker publish / GitHub release 类脚本

## Current Baseline

- rootScriptCount: 446
- serviceScriptCount: 403
- protected-core: 25
- historical-compatible: 253
- archive-candidate-low-risk: 87
- archive-candidate-needs-manual-review: 257
- forbidden-dangerous: 106
- unknown-review-required: 481

## Allowed Human Decisions

- `keep`
- `keep-historical-compatible`
- `mark-deprecated-only`
- `candidate-for-future-archive`
- `forbidden-do-not-run`
- `needs-more-context`

## Allowed Future Actions

- `no-op`
- `document-only`
- `deprecated-index-only`
- `manual-review-again`
- `future-archive-candidate`
- `forbidden-do-not-run`

## Priority Rules

| Priority | Label | Default Decision | Default Future Action | Can Delete |
|----------|-------|-----------------|----------------------|------------|
| 0 | forbidden-dangerous | forbidden-do-not-run | forbidden-do-not-run | no |
| 1 | unknown-review-required | needs-more-context | manual-review-again | no |
| 2 | manual-review | manual-review-required | manual-review-again | no |
| 3 | low-risk | manual-review-required | future-archive-candidate | no |

## Review Item Template

Each item must contain:

- `id` (required)
- `name` (required)
- `source` (required, e.g. `script:root`, `entrypoint:service`)
- `category` (required)
- `priority` (required, 0-3)
- `currentCommand` (required)
- `linkedEntrypoint` (optional)
- `reason` (required)
- `humanDecision` (required, one of allowed values)
- `riskLevel` (required)
- `futureAction` (required, one of allowed values)
- `requiredEvidence` (required)
- `notes` (optional)

## Review Batch Template

- maxItemsPerBatch: 20
- Each batch must include: batchId, sourceCategory, reviewer, reviewDate, candidateItems, decisionSummary, requiredRegressionCommands, rollbackPlan

## Rollback Plan

- 如果误改 package scripts 或删除 entrypoints：`git revert <commit>`
- 不 reset、不 clean、不 force push、不自动恢复。

## Required Regression Commands (All Batches)

- `cmd /c pnpm run health:phase12a`
- `cmd /c pnpm run doctor:phase13a`
- `cmd /c pnpm run verify:phase321a-workbench-product-recovery`
- `cmd /c pnpm run verify:phase313a-model-usability-matrix`
- `cmd /c pnpm run verify:phase107a-secret-safety`
- `cmd /c pnpm -r --if-present check`

## Extra Regression When Touching Chat/UI

- `cmd /c pnpm run verify:phase322a-workbench-chat-gateway-real-nvidia`

## Batch Samples

### Batch p0-batch-001: forbidden-dangerous-p0

- batchId: `p0-batch-001`
- maxItemsPerBatch: 20
- status: `template`

#### Sample Candidates (first 5)

| # | id | name | priority | humanDecision | futureAction |
|---|-----|------|----------|---------------|-------------|
| 1 | script:root:run:phase282a-commit-readine | run:phase282a-commit-readiness | 0 | (需人工填写, 建议 forbidden-do-not-run) | (需人工填写, 建议 forbidden-do-not-run) |
| 2 | script:root:run:phase283a-ui-release-rea | run:phase283a-ui-release-readi | 0 | (需人工填写, 建议 forbidden-do-not-run) | (需人工填写, 建议 forbidden-do-not-run) |
| 3 | script:root:run:phase284a-final-commit-p | run:phase284a-final-commit-pac | 0 | (需人工填写, 建议 forbidden-do-not-run) | (需人工填写, 建议 forbidden-do-not-run) |
| 4 | script:root:run:phase289a-deployment-run | run:phase289a-deployment-runti | 0 | (需人工填写, 建议 forbidden-do-not-run) | (需人工填写, 建议 forbidden-do-not-run) |
| 5 | script:root:verify:phase109a-deployment- | verify:phase109a-deployment-re | 0 | (需人工填写, 建议 forbidden-do-not-run) | (需人工填写, 建议 forbidden-do-not-run) |

### Batch p1-batch-001: unknown-review-required-p1

- batchId: `p1-batch-001`
- maxItemsPerBatch: 20
- status: `template`

#### Sample Candidates (first 5)

| # | id | name | priority | humanDecision | futureAction |
|---|-----|------|----------|---------------|-------------|
| 1 | script:root:build | build | 1 | (需人工填写, 建议 needs-more-context) | (需人工填写, 建议 manual-review-again) |
| 2 | script:root:start:agent-console | start:agent-console | 1 | (需人工填写, 建议 needs-more-context) | (需人工填写, 建议 manual-review-again) |
| 3 | script:root:start:ai-gateway-service | start:ai-gateway-service | 1 | (需人工填写, 建议 needs-more-context) | (需人工填写, 建议 manual-review-again) |
| 4 | script:root:dev:phase7a-service | dev:phase7a-service | 1 | (需人工填写, 建议 needs-more-context) | (需人工填写, 建议 manual-review-again) |
| 5 | script:root:start:pme | start:pme | 1 | (需人工填写, 建议 needs-more-context) | (需人工填写, 建议 manual-review-again) |

### Batch p2-batch-001: archive-candidate-manual-review-p2

- batchId: `p2-batch-001`
- maxItemsPerBatch: 20
- status: `template`

#### Sample Candidates (first 5)

| # | id | name | priority | humanDecision | futureAction |
|---|-----|------|----------|---------------|-------------|
| 1 | script:root:verify:phase103a-product-rea | verify:phase103a-product-readi | 2 | (需人工填写, 建议 ) | (需人工填写, 建议 manual-review-again) |
| 2 | script:root:verify:phase154a-template-ac | verify:phase154a-template-acce | 2 | (需人工填写, 建议 ) | (需人工填写, 建议 manual-review-again) |
| 3 | script:root:verify:phase158a-product-rea | verify:phase158a-product-readi | 2 | (需人工填写, 建议 ) | (需人工填写, 建议 manual-review-again) |
| 4 | script:root:verify:phase161a-ui-informat | verify:phase161a-ui-informatio | 2 | (需人工填写, 建议 ) | (需人工填写, 建议 manual-review-again) |
| 5 | script:root:verify:phase170a-readme-agen | verify:phase170a-readme-agents | 2 | (需人工填写, 建议 ) | (需人工填写, 建议 manual-review-again) |

### Batch p3-batch-001: archive-candidate-low-risk-p3

- batchId: `p3-batch-001`
- maxItemsPerBatch: 20
- status: `template`

#### Sample Candidates (first 5)

| # | id | name | priority | humanDecision | futureAction |
|---|-----|------|----------|---------------|-------------|
| 1 | script:root:verify:phase155a-template-ex | verify:phase155a-template-expo | 3 | (需人工填写, 建议 ) | (需人工填写, 建议 future-archive-candidate) |
| 2 | script:root:verify:phase156a-guided-onbo | verify:phase156a-guided-onboar | 3 | (需人工填写, 建议 ) | (需人工填写, 建议 future-archive-candidate) |
| 3 | script:root:verify:phase164a-plan-output | verify:phase164a-plan-output-r | 3 | (需人工填写, 建议 ) | (需人工填写, 建议 future-archive-candidate) |
| 4 | script:root:verify:phase168a-guided-demo | verify:phase168a-guided-demo-m | 3 | (需人工填写, 建议 ) | (需人工填写, 建议 future-archive-candidate) |
| 5 | script:root:verify:phase169a-user-manual | verify:phase169a-user-manual-n | 3 | (需人工填写, 建议 ) | (需人工填写, 建议 future-archive-candidate) |

## Future Archive Stages

- Stage A: 只读索引刷新 (inventory + archive-review + deprecated-index)
- Stage B: 人工复核 low-risk / manual-review (逐项确认引用关系)
- Stage C: deprecated alias / warning index 生成
- Stage D: 归档路径设计 (独立目录 + 说明 + 回滚路径)
- Stage E: 小批量迁移 (每次 ≤20 项, 禁止批量移动)
- Stage F: 验证回归 (product recovery + secret safety + 主链)
- Stage G: 最终删除或长期保留

## Protected Core Boundary

protected-core 中的 25 个入口禁止归档，禁止被标记为 candidate-for-future-archive 或 forbidden-do-not-run。
