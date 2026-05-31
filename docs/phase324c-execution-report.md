# Phase324C Execution Report

## 本轮执行范围

- 执行 Phase324C selectable review。
- 仅将 2 个 Phase324B smoke_passed 且 evidence 完整的 NVIDIA 模型写入 verified metadata。
- 不调用 NVIDIA API，不调用非 NVIDIA API。
- 不修改 Chat Gateway、/chat-gateway/execute、Chat send、UI、httpServer、provider client。

## 修改文件

- `tools/phase324c/build-phase324c-selectable-review.mjs`
- `tools/phase324c/apply-phase324c-selectable-update.mjs`
- `docs/phase324c-selectable-model-review.json`
- `docs/phase324c-selectable-model-review.md`
- `docs/phase324c-model-registry-update-report.md`
- `docs/phase324c-execution-report.md`
- `apps/ai-gateway-service/evidence/phase-313a-model-verification-state.json`
- `apps/ai-gateway-service/evidence/phase-313a-model-usability-matrix.json`
- `apps/ai-gateway-service/evidence/phase-313a-model-usability-matrix.md`

## selectable 结果

- 新增 selectable models:
  - `nvidia/nemotron-3-super-120b-a12b`
  - `nvidia/nemotron-mini-4b-instruct`
- 仍不可选 models:
  - `nvidia/llama-3.3-nemotron-super-49b-v1.5`
  - `nvidia/nemotron-3-nano-30b-a3b`
  - `nvidia/nvidia-nemotron-nano-9b-v2`

## evidenceId mapping

- `nvidia/nemotron-3-super-120b-a12b` -> `phase324b-nvidia_nemotron_3_super_120b_a12b-20260506124314`
- `nvidia/nemotron-mini-4b-instruct` -> `phase324b-nvidia_nemotron_mini_4b_instruct-20260506124316`

## 验证结果

- `verify:phase313a-model-usability-matrix`: pass
  - `smokePassedModels=4`
  - `selectableModels=4`
  - Chat dropdown 包含原始 2 个加新增 2 个
- `verify:phase321a-workbench-product-recovery`: pass
- `verify:phase107a-secret-safety`: pass
- `pnpm -r --if-present check`: pass
- `verify:phase322a-workbench-chat-gateway-real-nvidia`: pass

## 安全边界确认

- 修改 model-library runtime code: no
- 修改 selectable gate logic: no
- 修改 Chat dropdown code: no
- 修改 `/chat-gateway/execute`: no
- 调用 NVIDIA API: no
- 调用非 NVIDIA API: no
- 伪造 evidenceId: no
- 将 smoke_failed 模型加入 selectable: no

## 风险与回滚说明

- 本轮风险集中在 verifier 口径与 verification metadata 对齐；已通过 Phase313A verifier 验证。
- 回滚仅需移除本轮新增的 2 条 verification metadata，并恢复本轮生成的 Phase313A evidence。
- 不需要 `git reset` 或 `git clean`。

## 是否建议封板

- 建议：是
- 原因：Phase324C 只接入了 2 个 Phase324B smoke_passed 模型，未改 gate 逻辑和主链，且 Phase313A / Phase321A / Phase107A / Phase322A 回归全部通过。
