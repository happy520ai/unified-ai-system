# Phase324A Execution Report

Generated: 2026-05-06

## 1. 本轮执行范围

- NVIDIA 模型库只读盘点
- candidate inventory 生成
- Phase324B smoke batch 规划
- Phase324A 执行报告

## 2. 实际修改文件

- `tools/phase324a/build-phase324a-nvidia-model-inventory.mjs`
- `docs/phase324a-nvidia-model-candidate-inventory.json`
- `docs/phase324a-nvidia-model-candidate-inventory.md`
- `docs/phase324a-nvidia-model-library-expansion-plan.md`
- `docs/phase324a-smoke-batch-strategy.md`
- `docs/phase324a-execution-report.md`

## 3. 是否修改模型库源码

- 否

## 4. 是否修改 Chat 下拉

- 否

## 5. 是否修改 /chat-gateway/execute

- 否

## 6. 是否调用 NVIDIA API

- 否

## 7. 是否调用非 NVIDIA API

- 否

## 8. 当前 verified chat models

- `nvidia/llama-3.1-nemotron-nano-8b-v1`
- `nvidia/llama-3.3-nemotron-super-49b-v1`

## 9. 候选模型分层摘要

- current-verified-chat：2
- phase324b-priority-candidates：5
- phase324b-secondary-candidates：15
- manual-review-required：55
- excluded-not-chat：47
- excluded-blocked-or-deprecated：6
- excluded-no-evidence：102

## 10. Phase324B smoke batch 建议

- 第一批建议 5 个
- 最大不超过 10 个
- 先优先 `nvidia/*` publisher 自有 reasoning/chat 候选
- 每个模型必须生成 evidence

## 11. 风险与回滚说明

- 风险：
  - Phase313A evidence 显示 148 条 provider-slot records，但当前静态源码可复建 104 条 records，必须区分 live discovery 合并结果与静态源码种子。
  - partner catalog 候选较多，不应在第一批 smoke 中过早扩大范围。
  - 已知 `nvidia/llama-3.1-nemotron-ultra-253b-v1` 为 smoke_failed，不应混入 priority。
- 回滚：
  - 仅回退本轮 `tools/phase324a/*` 与 `docs/phase324a*`
  - 不需要 `git reset`
  - 不需要 `git clean`

## 12. 验证命令与结果

- `cmd /c pnpm run verify:phase107a-secret-safety`：通过，`docsBoundaryPresent=true`
- `cmd /c pnpm run health:phase12a`：通过
- `cmd /c pnpm run doctor:phase13a`：通过
- `cmd /c pnpm run verify:phase321a-workbench-product-recovery`：通过
- `cmd /c pnpm run verify:phase313a-model-usability-matrix`：通过，`selectableModels=2`
- `cmd /c pnpm -r --if-present check`：通过
- `cmd /c node tools\\phase324a\\build-phase324a-nvidia-model-inventory.mjs`：通过
- `node --check tools\\phase324a\\build-phase324a-nvidia-model-inventory.mjs`：通过

## 13. 是否建议封板 Phase324A

- 是

## 14. 下一阶段建议

- Phase324B：NVIDIA smoke batch 第一批，只测 5 个左右 priority candidates
- Phase324C：只把 smoke_passed 且 evidence 合格的模型加入 selectable verified set
- Phase324D：模型库 UI 增强，显示状态、失败原因、evidenceId、能力标签、不可选原因
- 多 Provider：暂不启动，必须另开大阶段
