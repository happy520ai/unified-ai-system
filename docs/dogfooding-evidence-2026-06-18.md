# Dogfooding Evidence — 2026-06-18

## 真实对话证据

### 测试 1: 基础对话
- **时间**: 2026-06-18T14:08:48.248Z
- **端点**: POST /chat
- **请求**: `{"prompt":"Hello, say hi in one sentence"}`
- **响应**: `{"success":true,"text":"Hi, it's nice to meet you!"}`
- **模型**: nvidia/llama-3.3-nemotron-super-49b-v1
- **Token 数**: 36
- **延迟**: 3249ms
- **状态**: ✅ 成功

### 测试 2: 模型导入
- **端点**: POST /models/import/preview
- **请求**: `{"apiKey":"phase107a-secret-should-not-appear","providerHint":"auto"}`
- **响应**: `{"status":"needs_provider_selection","maskedKey":"phase107****pear"}`
- **状态**: ✅ 正确掩码

### 测试 3: 健康检查
- **端点**: GET /health/check
- **响应**: `{"status":"ready"}`
- **状态**: ✅ 正常

### 测试 4: SLO 状态
- **端点**: GET /slo
- **响应**: 包含延迟百分位、错误率、请求计数
- **状态**: ✅ 正常

### 测试 5: 可观测性
- **端点**: GET /observability/status
- **响应**: 包含 tracer、SLO、连接池状态
- **状态**: ✅ 正常

## 验证结果

| 验证项 | 状态 |
|--------|------|
| node --check (1,084 文件) | ✅ 通过 |
| doctor:phase13a | ✅ 通过 |
| verify:safe-regression-matrix | ✅ 通过 |
| verify:phase107a-secret-safety | ✅ 通过 (status: "passed") |
| health:phase12a | ✅ 通过 (conclusion: "service-health-ready") |
| /chat 真实对话 | ✅ 成功 (NVIDIA llama-3.3) |

## 测试套件状态

- **通过**: 198
- **失败**: 38 (主要是 vitest→node:test 转换问题和复杂集成测试)
- **通过率**: 84%

## 修复的问题

1. **phase107a verification** — 修复了 `modelImportMasksUnknownKey` 检查
   - 根因: 路由框架已读取 body，但 handler 又调用 `readJson` 重复读取
   - 修复: 使用框架传入的 `body` 参数

2. **Provider 路由** — 修复了 `NO_PROVIDER_ROUTE` 错误
   - 根因: 固定路由模式下 `defaultModelId` 与实际模型 ID 不匹配
   - 修复: 添加三级降级匹配（严格→仅 Provider→全部候选）

3. **工作区清理** — 删除了垃圾文件
   - 删除: `nul`, `new`, `{console.error(e.message)`
   - 更新: `.gitignore` 排除临时目录

4. **测试修复** — 将 19 个 vitest 测试转换为 node:test
   - 修复了 `assert.ok(x)=== (y)` 等语法错误
   - 修复了 `toBeInstanceOf`、`toContain`、`toThrow` 等 API

## CI 建立

- 创建了 `.github/workflows/ci.yml`
- 包含: 测试、语法检查、安全验证、健康检查
- 支持 Node.js 20/22 矩阵测试
