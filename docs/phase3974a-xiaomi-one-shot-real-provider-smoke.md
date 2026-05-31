# Phase3974A: Xiaomi One-Shot Real Provider Smoke

## 目标
在 owner 明确授权后，对 Xiaomi / MiMo 执行最多 1 次真实 Provider smoke。

## 前置条件
- Phase3971A sealed/pass
- Phase3972A sealed/pass 且 readyForOwnerAuthorizedOneShotSmoke=true
- Phase3973A approval input 存在且 decision = `approved_execute_xiaomi_one_shot_real_provider_smoke`

## 执行约束
- `requestAttemptCount <= 1`
- `retryAttemptCount = 0`
- `maxRequests = 1`
- 使用 CredentialRef（不读取 raw secret）
- 不打印 Authorization header
- 不写入 provider response 中的敏感 header

## 当前状态
等待 owner 授权后执行。

## 安全边界
- 不读取 raw secret
- 不打印 key/token/header
- 不 deploy
- 不修改 /chat 或 /chat-gateway/execute
