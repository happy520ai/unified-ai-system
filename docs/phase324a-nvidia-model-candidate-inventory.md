# Phase324A NVIDIA Model Candidate Inventory

Generated: 2026-05-06T12:28:02.676Z

## 当前结论

- Phase324A 只做 NVIDIA 模型库扩容规划，不执行真实 smoke。
- 当前 Chat 下拉仍只应显示 2 个 verified selectable models。
- Phase324A 不把任何候选模型加入 Chat 下拉。
- Phase324B 才允许按真实 smoke 结果扩 verified set。
- 非 NVIDIA provider 不在本轮范围。

## Summary

- phase313EvidenceTotalModels: 148
- staticRegistryModelCount: 104
- providerSlots: nvidia, openai, claude, openrouter, mimo, local
- nvidiaOnlyRealProvider: true
- currentVerifiedChatModelCount: 2
- currentVerifiedChatModelIds: nvidia/llama-3.1-nemotron-nano-8b-v1, nvidia/llama-3.3-nemotron-super-49b-v1
- blockedCount: 0
- deprecatedCount: 5
- manualReviewCount: 0
- unknownCapabilityCount: 0
- withEvidenceIdCount: 2
- withoutEvidenceIdCount: 102
- chatCapableCandidateCount: 57
- nonChatExcludedCount: 47
- phase324bPriorityCandidateCount: 5
- phase324bSecondaryCandidateCount: 15

## 当前 verified chat models

- `nvidia/llama-3.1-nemotron-nano-8b-v1` | bucket=reasoning_chat | evidenceId=phase-313a-model-usability-matrix
- `nvidia/llama-3.3-nemotron-super-49b-v1` | bucket=reasoning_chat | evidenceId=phase-313a-model-usability-matrix

## candidateGroups

### current-verified-chat

- 数量：2

- `nvidia/llama-3.1-nemotron-nano-8b-v1` | bucket=reasoning_chat | status=smoke_passed | evidenceId=phase-313a-model-usability-matrix
- `nvidia/llama-3.3-nemotron-super-49b-v1` | bucket=reasoning_chat | status=smoke_passed | evidenceId=phase-313a-model-usability-matrix

### phase324b-priority-candidates

- 数量：5

- `nvidia/llama-3.3-nemotron-super-49b-v1.5` | bucket=reasoning_chat | status=unverified | evidenceId=none
- `nvidia/nemotron-3-nano-30b-a3b` | bucket=reasoning_chat | status=unverified | evidenceId=none
- `nvidia/nemotron-3-super-120b-a12b` | bucket=reasoning_chat | status=unverified | evidenceId=none
- `nvidia/nemotron-mini-4b-instruct` | bucket=reasoning_chat | status=unverified | evidenceId=none
- `nvidia/nvidia-nemotron-nano-9b-v2` | bucket=reasoning_chat | status=unverified | evidenceId=none

### phase324b-secondary-candidates

- 数量：15

- `abacusai/dracarys-llama-3.1-70b-instruct` | bucket=chat | status=unverified | evidenceId=none
- `meta/llama-3.1-70b-instruct` | bucket=chat | status=unverified | evidenceId=none
- `meta/llama-3.1-8b-instruct` | bucket=chat | status=unverified | evidenceId=none
- `meta/llama-3.3-70b-instruct` | bucket=chat | status=unverified | evidenceId=none
- `meta/llama2-70b` | bucket=chat | status=unverified | evidenceId=none
- `meta/llama3-8b` | bucket=chat | status=unverified | evidenceId=none
- `microsoft/phi-3-mini-4k-instruct` | bucket=chat | status=unverified | evidenceId=none
- `microsoft/phi-4-mini-instruct` | bucket=chat | status=unverified | evidenceId=none
- `mistralai/mistral-7b-instruct` | bucket=reasoning_chat | status=unverified | evidenceId=none
- `mistralai/mistral-7b-instruct-v0.3` | bucket=reasoning_chat | status=unverified | evidenceId=none
- `mistralai/mistral-nemotron` | bucket=reasoning_chat | status=unverified | evidenceId=none
- `mistralai/mistral-small-24b-instruct` | bucket=reasoning_chat | status=unverified | evidenceId=none
- `mistralai/mixtral-8x22b-instruct` | bucket=reasoning_chat | status=unverified | evidenceId=none
- `moonshotai/kimi-k2-instruct` | bucket=reasoning_chat | status=unverified | evidenceId=none
- `moonshotai/kimi-k2-instruct-0905` | bucket=reasoning_chat | status=unverified | evidenceId=none

### manual-review-required

- 数量：50

- `abacusai/dracarys-llama-3.1-70b-instruct` | bucket=chat | status=unverified | evidenceId=none
- `bytedance/seed-oss-36b-instruct` | bucket=chat | status=unverified | evidenceId=none
- `deepseek-ai/deepseek-v3.1-terminus` | bucket=reasoning_chat | status=unverified | evidenceId=none
- `deepseek-ai/deepseek-v3.2` | bucket=reasoning_chat | status=unverified | evidenceId=none
- `deepseek-ai/deepseek-v4-flash` | bucket=reasoning_chat | status=unverified | evidenceId=none
- `deepseek-ai/deepseek-v4-pro` | bucket=reasoning_chat | status=unverified | evidenceId=none
- `google/codegemma-7b` | bucket=code | status=unverified | evidenceId=none
- `google/gemma-2-2b-it` | bucket=chat | status=unverified | evidenceId=none
- `google/gemma-7b` | bucket=chat | status=unverified | evidenceId=none
- `meta/llama-3.1-70b-instruct` | bucket=chat | status=unverified | evidenceId=none
- `meta/llama-3.1-8b-instruct` | bucket=chat | status=unverified | evidenceId=none
- `meta/llama-3.2-1b-instruct` | bucket=chat | status=unverified | evidenceId=none
- `meta/llama-3.2-3b-instruct` | bucket=chat | status=unverified | evidenceId=none
- `meta/llama-3.3-70b-instruct` | bucket=chat | status=unverified | evidenceId=none
- `meta/llama2-70b` | bucket=chat | status=unverified | evidenceId=none
- `meta/llama3-8b` | bucket=chat | status=unverified | evidenceId=none
- `microsoft/phi-3-medium-128k-instruct` | bucket=chat | status=unverified | evidenceId=none
- `microsoft/phi-3-mini-4k-instruct` | bucket=chat | status=unverified | evidenceId=none
- `microsoft/phi-4-mini-flash-reasoning` | bucket=reasoning_chat | status=unverified | evidenceId=none
- `microsoft/phi-4-mini-instruct` | bucket=chat | status=unverified | evidenceId=none
- ... 其余 30 项见 JSON

## excludedGroups

### excluded-not-chat

- 数量：47

### excluded-blocked-or-deprecated

- 数量：5

### excluded-no-evidence

- 数量：102

## Phase324B smoke batch recommendation

- 第一批建议：5
- 最大建议：10
- 第一批模型：
- `nvidia/llama-3.3-nemotron-super-49b-v1.5`
- `nvidia/nemotron-3-nano-30b-a3b`
- `nvidia/nemotron-3-super-120b-a12b`
- `nvidia/nemotron-mini-4b-instruct`
- `nvidia/nvidia-nemotron-nano-9b-v2`
- 第二批扩展池：
- `abacusai/dracarys-llama-3.1-70b-instruct`
- `meta/llama-3.1-70b-instruct`
- `meta/llama-3.1-8b-instruct`
- `meta/llama-3.3-70b-instruct`
- `meta/llama2-70b`
- `meta/llama3-8b`
- `microsoft/phi-3-mini-4k-instruct`
- `microsoft/phi-4-mini-instruct`
- `mistralai/mistral-7b-instruct`
- `mistralai/mistral-7b-instruct-v0.3`

## 风险

- Phase313A evidence 显示 NVIDIA provider slot 下存在 148 条 catalog records，但当前静态源码可复建 records 为 104 条；两者必须在报告中区分，避免把 live discovery 合并结果当作纯源码事实。
- 当前 verified selectable models 仍只有 2 个；Phase324A 不得把任何未 smoke 模型加入 Chat 下拉。
- partner catalog 中大量模型虽然挂在 NVIDIA provider slot 下，但不等于本轮应优先 smoke；Phase324B 第一批应先控制在 NVIDIA publisher 自有模型。
- smoke_failed 的 nvidia/llama-3.1-nemotron-ultra-253b-v1 已知 404，不应纳入第一批 priority candidate。

## nextPhaseInputs

- Phase324B 第一批建议先测 5 个 priority candidates：nvidia/llama-3.3-nemotron-super-49b-v1.5, nvidia/nemotron-3-nano-30b-a3b, nvidia/nemotron-3-super-120b-a12b, nvidia/nemotron-mini-4b-instruct, nvidia/nvidia-nemotron-nano-9b-v2
- Phase324B 真实 smoke 必须记录 providerCalled=true、completionVerified=true、assistantText 非空、latencyMs、httpStatus/errorCode、evidenceId
- Phase324C 只把 smoke_passed 且 evidence 合格的模型加入 selectable verified set
- Phase324D 再做模型库 UI 增强，不在 Phase324A 修改任何生产 UI 或 Chat 主链

