# Phase3971A: Xiaomi Provider Readiness Matrix

## 目标
确认项目内是否已有 Xiaomi / MiMo provider 定义、adapter、model registry、CredentialRef 引用、smoke runner 入口。

## 扫描结果

### Provider ID 识别
- 项目内实际命名：`mimo`（不是 `xiaomi`）
- Provider Display Name：`MiMo Token Plan`
- Endpoint：`https://token-plan-cn.xiaomimimo.com/v1`

### Readiness Matrix

| 检查项 | 状态 | 说明 |
|--------|------|------|
| providerId | `mimo` | 在 shared-config 中定义 |
| adapterExists | ✅ | httpLlmProviderAdapter 有 mimo 特殊处理 |
| modelRegistryExists | ✅ | unifiedModelRegistry 中有 mimo 条目（status: blocked-for-phase312a） |
| credentialRefNameExists | ❌ | CredentialRef resolver contract 中不包含 mimo |
| smokeRunnerExists | ❌ | 没有专门的 mimo smoke runner |
| selectableNow | ❌ | 不可选择 |
| realProviderCallAllowedNow | ❌ | 不允许真实调用 |

### Blockers
1. `credentialref_mimo_not_in_allowlist` - CredentialRef 不在 allowlist 中
2. `safe_executor_mimo_not_allowed` - Safe Executor Contract 不允许 mimo
3. `smoke_runner_not_yet_created` - Smoke Runner 尚未创建

## 安全边界
- 不调用 Provider
- 不读取 secret
- 不修改 /chat 或 /chat-gateway/execute
- 不 deploy
