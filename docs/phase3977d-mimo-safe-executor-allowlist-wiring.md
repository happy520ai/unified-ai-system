# Phase3977D: MiMo Safe Executor Allowlist Wiring

## 目标
把 mimo 纳入 Safe Executor allowlist。

## 修改文件
- `apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.contract.js`

## 修改内容
1. `allowedProviderIds` 添加 `"mimo"`
2. `allowedCredentialRefs` 添加 `"credentialRef:mimo:default"`
3. `allowedModelIds` 添加 `"mimo-v2.5-pro"`

## 安全边界
- 不执行真实 Provider 调用
- 不读取 secret
- 不修改 /chat 或 /chat-gateway/execute
