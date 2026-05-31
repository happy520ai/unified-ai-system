# Phase324A Smoke Batch Strategy

Generated: 2026-05-06

## 1. Phase324B batch size

- 建议第一批：5 个
- 最大不超过：10 个
- 稳定后再扩到：10-20 个 verified chat models

## 2. Batch selection rules

优先选择：

- NVIDIA provider slot 下的 chat-like 候选
- `nvidia/*` publisher 优先
- `chat / reasoning_chat / code`
- 非 deprecated
- 非 blocked
- 非 smoke_failed
- capability bucket 清晰
- 有基础 metadata
- 不依赖非 chat 输入
- 不要求 multimodal / retrieval / downloadable only / special payload

本轮排除：

- embedding
- rerank
- vision / multimodal
- safety / pii / translation
- biology
- openusd
- autonomous_driving
- voice / video
- deprecated
- blocked / smoke_failed

## 3. Smoke prompt 建议

Phase324A 只写策略，不执行这些 prompt。

建议 prompt：

- `请用一句中文回答：你能正常工作吗？`
- `Return a short JSON object with status=ok and one sentence.`

要求：

- 安全
- 短
- 便宜
- 可验证

## 4. Smoke request constraints

- `providerId=nvidia`
- `dryRun=false`
- `maxTokens` 小
- `timeout` 明确
- 不输出 API key
- 不记录 prompt 中任何 secret
- 不并发过高
- 失败可重试，但次数有限
- 不得把 dry-run 结果写成真实 smoke

## 5. Evidence format

每个 smoke 应写：

- `modelId`
- `providerId`
- `timestamp`
- `providerCalled`
- `completionVerified`
- `assistantTextSample` redacted / truncated
- `httpStatus` 或 `errorCode`
- `latencyMs`
- `evidenceId`
- `finalStatus`

## 6. Phase324B 第一批建议模型

- `nvidia/llama-3.3-nemotron-super-49b-v1.5`
- `nvidia/nemotron-3-nano-30b-a3b`
- `nvidia/nemotron-3-super-120b-a12b`
- `nvidia/nemotron-mini-4b-instruct`
- `nvidia/nvidia-nemotron-nano-9b-v2`

## 7. 第二批扩展池建议

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

## 8. Regression commands

Phase324B 后至少执行：

- `cmd /c pnpm run verify:phase313a-model-usability-matrix`
- `cmd /c pnpm run verify:phase322a-workbench-chat-gateway-real-nvidia`
- `cmd /c pnpm run verify:phase321a-workbench-product-recovery`
- `cmd /c pnpm run verify:phase107a-secret-safety`
- `cmd /c pnpm -r --if-present check`
