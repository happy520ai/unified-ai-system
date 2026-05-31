# Phase322A Workbench Chat Gateway Real NVIDIA Closure

## 目标

Phase322A 只做一件事：修通 Workbench Chat 到 `/chat-gateway/execute` 的真实 NVIDIA 回答闭环。

## 已确认根因

- `provider-config/test` 成功不等于 Chat 真实可用。
- `provider-config/test` 直接调用 `createNvidiaUnifiedClient().chatCompletion(...)`。
- `/chat-gateway/execute` 会先走 intent -> plan -> execute -> completion verify，链路更长。
- 运行中的 `3100` managed service 曾停留在旧代码，仍返回 `real_smoke_not_enabled`。
- Workbench Chat 之前只传字符串 `selectedModel`，没有显式使用 `manual_model`，存在被自动规划器改选模型的风险。

## 本轮修复

- Workbench Chat 发送时显式提交：
  - `mode=manual_model`
  - `dryRun=false`
  - `providerId=nvidia`
  - `selectedModel={ providerId, modelId }`
- `/chat-gateway/execute` 在收到已选模型但未显式带 mode 时，也会兜底切到 `manual_model`。
- 返回体增加 `failureCode` / `failureMessage`，便于 UI 诚实解释失败原因。

## 验收口径

### 无 Key

- `providerCalled=false`
- `completionVerified=false`
- `failureCode=nvidia_api_key_missing`
- 不得伪装成 dry-run 成功

### 有 NVIDIA Key

- `providerCalled=true`
- `providerName=nvidia`
- `completionVerified=true`
- `executionStatus=completed`
- `assistantText` 非空
- `evidenceId` 非空

## 浏览器边界

- `realBrowserUsed=false`
- `manualRealBrowserVerificationRequired=false`
- `manualBrowserVerified=true`
- `userConfirmedChatSuccess=true`
- ??????????? `/ui`??????????UI ???? NVIDIA ???

## 安全边界

- 未修改 `legacy/`
- 未创建 `PROJECT_CONTEXT.md`
- 未 commit / push / deploy / release
- 未调用 OpenAI / Claude / OpenRouter / MiMo / paid API
- 未暴露 `.env` / API Key / secret
- 未改变默认 `/chat`
