# Phase3984A CredentialRef Multi-Provider One-Shot Smoke

## Goal

通过 CredentialRef-only 和 maxRequests=1 方式对可用 Provider 做真实 one-shot smoke；缺失凭证的 Provider 记录真实 blocker，不伪造调用。

## Result

- attemptedProviderCount: 1
- successCount: 1
- providerCallsMade: true
- recommended_sealed: true
- blocker: none

## Attempts

- nvidia: credentialEnvPresent=true, providerCallsMade=true, ok=true, blocker=none
- mimo: credentialEnvPresent=false, providerCallsMade=false, ok=false, blocker=credential_env_missing
- openrouter: credentialEnvPresent=false, providerCallsMade=false, ok=false, blocker=credential_env_missing

## Safety Boundary

- 未读取 `.env` 或 `auth.json`。
- 未打印 raw secret 或 Authorization header。
- 未修改 `/chat` 或 `/chat-gateway/execute`。
- 未修改模型 selectable 状态。
- 未部署、未 commit、未 push。
