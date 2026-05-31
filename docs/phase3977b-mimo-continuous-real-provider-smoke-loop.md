# Phase3977B-3978B: MiMo Continuous Real Provider Smoke Lane

## 概述
owner 已明确授权 MiMo / Xiaomi 进入持续真实 Provider smoke。

## 授权参数
- `providerCallAllowed=true`
- `continuousRealSmokeAllowed=true`
- `maxRequests=200`
- `maxDurationMinutes=120`
- `intervalSeconds=30`
- `maxTotalEstimatedTokens=250000`
- `credentialRefOnly=true`

## 阶段

### Phase3977B: Continuous Smoke Loop Blocked Gate
- 生成授权文件和设计框架
- 由于 CredentialRef / Safe Executor 未就绪，输出 blocked mode evidence

### Phase3977C: CredentialRef Resolver Contract Wiring
- 把 mimo 的 CredentialRef 纳入 resolver contract
- 不写入 secret value，不读取 secret，不调用 Provider

### Phase3977D: Safe Executor Allowlist Wiring
- 把 mimo 纳入 Safe Executor allowlist
- 只允许通过 safe internal provider executor 执行

### Phase3977E: Continuous Smoke Readiness Recheck
- 复核 mimo 是否满足持续真实 smoke 的所有前置条件
- 仍不执行 Provider 调用

### Phase3977F: Continuous Real Smoke Execute
- 执行 MiMo 持续真实 Provider smoke
- 严格遵守 approval input 的限制

### Phase3978B: Continuous Smoke Reality Review
- 复核持续真实 smoke 结果
- 判断 mimo 是否可以作为主验证 Provider

## 安全边界
- 不读取 raw secret
- 不打印 API key / token / Authorization header
- 不修改 /chat 或 /chat-gateway/execute
- 不 deploy / release / tag / artifact upload
- 不声称 production ready 或 provider stability
