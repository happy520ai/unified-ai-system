# Phase323D-8 Workbench Bridge Stability Report

## 范围

本轮只稳定化已存在的三个低风险 bridge，不接入新页面，不接 Chat send，不接 approvals。
本轮不改 `httpServer.js`，不改 `/chat-gateway/execute`，不改 `routeRegistry`。

## Diagnostics Bridge

### 当前状态

- **已接入** `apiClient.getDiagnosticsStatus()`，路径 `/workbench/diagnostics/status`，方法 `GET`
- 在 `consolePage.js` 的 `createWorkbenchApiBridge()` zone 中桥接
- `loadDiagnostics()` 和 `refreshAll()` 均通过 bridge 调用
- 诊断中心页面的三个统计卡片、最近 Chat 请求记录、错误记录、高级诊断详情均通过 bridge 返回的数据渲染

### 边界

- 不修改服务端 `/workbench/diagnostics/status` 路由
- 不修改 `httpServer.js`
- 请求参数: GET, 无 body
- 响应: JSON `{ health, doctor, modelLibrary, chatGateway, providerStatus }`
- 不调用外部 API
- 不读取 `.env` 或 secret

## ProviderConfig Bridge

### 当前状态

- **已接入** `apiClient.getProviderConfigStatus()` (GET `/provider-config/status`)
- **已接入** `apiClient.saveProviderConfig(body)` (POST `/provider-config/save`)
- **已接入** `apiClient.testProviderConfig(body)` (POST `/provider-config/test`)
- 在 `consolePage.js` 的 `createWorkbenchApiBridge()` zone 中桥接
- `saveProviderConfig()` 和 `testProviderConfig()` 通过 `postJsonViaBridge()` 辅助方法收敛
- 模型配置页面的保存、测试、状态展示均通过 bridge 调用

### 边界

- Key 明文从不回显：`status` 只返回 `apiKeyConfigured: true/false`
- `save` 写入后前端清空输入框
- `test` 可以真实调用 NVIDIA API 进行连接测试
- providerId 固定为 `nvidia`
- 不展示 secret / token / .env 路径或名称

## FileContext Bridge

### 当前状态

- **已接入** `apiClient.selectFileContext(body)`，路径 `/file-context/select`，方法 `POST`
- 在 `consolePage.js` 的 `createWorkbenchApiBridge()` zone 中桥接
- `handleFilesSelected(event)` 通过 bridge 调用
- 文件列表展示层有敏感文件名/路径遮罩

### 边界

- 仅登记/预览，不读取真实文件内容
- 不触发 embedding batch training
- 不调用 paid API
- body: `{ files: [{ name, path, size, type }] }`
- 敏感文件名（`.env`、`secret`、`token`）前端遮罩为 `[blocked-sensitive-file]`
- 敏感路径前端遮罩为 `[blocked-sensitive-path]`

## 三者共同边界

| 边界项 | diagnostics | providerConfig | fileContext |
|--------|-------------|---------------|-------------|
| Bridge 接入 | 是 | 是 | 是 |
| apiClient 方法 | `getDiagnosticsStatus()` | `getProviderConfigStatus()`, `saveProviderConfig()`, `testProviderConfig()` | `selectFileContext()` |
| HTTP method | GET | GET/POST/POST | POST |
| 调用外部 API | 否 | test 可调 NVIDIA | 否 |
| 读取 secret | 否 | 否 | 否 |
| 修改 httpServer.js | 否 | 否 | 否 |
| 修改 /chat-gateway/execute | 否 | 否 | 否 |

## 尚未 Bridge 的页面

| 页面 | 原因 |
|------|------|
| Chat send | intentionally not migrated：涉及 `/chat-gateway/execute` 真实主链，bridge 化需要独立的稳定化阶段 |
| Approvals (审批任务) | bridge-later：涉及 `/local-agent/`、`/approvals/`、`/local-operation/` 多路由链，需单独阶段评估 |
| 模型配置页模型列表 | 模型列表读取通过 `loadModelLibrary()` 直接 `requestJson("/model-library")` 调用，未经过 apiClient bridge |

## 为什么 Chat send 继续冻结

1. `/chat-gateway/execute` 是当前唯一真实 NVIDIA 调用主链
2. Chat send 的请求 body 结构复杂（`mode`, `dryRun`, `selectedModel`, `providerId`）
3. Chat send 的响应处理涉及 `completionVerified`、`evidenceId`、`failureCode` 等多字段解析
4. Chat send 的 UI 渲染涉及 `updateChatModeBadge()`、`summarizeFailure()` 等多个辅助函数
5. 任何 bridge 化错误都可能导致 Phase322A 主链回退
6. 因此 Chat send apiClient bridge 应延后到 Phase323D-9 或之后，在独立阶段中做充分评估

## 为什么 approvals 继续 bridge-later

1. 审批链涉及 `/local-agent/patch-proposal` -> `/approvals/create` -> `/approvals/:id/approve` -> `/local-operation/apply-approved` 四步
2. 每步都有不同的请求 body 和不同的安全语义
3. `apply-approved` 涉及实际文件写入（在 allowedFiles 内），必须保持 dryRun 默认逻辑
4. 审批链 bridge 化需单独阶段，不应和当前低风险 bridge 稳定化混合

## 为什么 httpServer.js / routeRegistry 不在本轮接入

1. Phase323E-3 建议单独执行
2. routeRegistry 接入生产会改变路由注册方式，影响全系统
3. UI bridge 稳定化和 routeRegistry 接入不应混合
4. 本轮只稳定 UI 层 bridge，不碰后端路由层

## 必须执行的回归验证

```
cmd /c pnpm run health:phase12a
cmd /c pnpm run doctor:phase13a
cmd /c pnpm run verify:phase321a-workbench-product-recovery
cmd /c pnpm run verify:phase313a-model-usability-matrix
cmd /c pnpm run verify:phase107a-secret-safety
cmd /c pnpm -r --if-present check
```

如果 bridge 改动影响了 Chat 行为，额外执行：
```
cmd /c pnpm run verify:phase322a-workbench-chat-gateway-real-nvidia
```

## 回滚方式

本轮未修改 `httpServer.js`、未修改 `/chat-gateway/execute`、未修改 consolePage.js 的业务逻辑。
如果 bridge 稳定化过程中引入了问题，回滚方式为：

1. 回退 `consolePage.js` 的 bridge zone 修改
2. 回退 `apiClient.js` 的注释修改
3. 重新执行基线验证确认通过

不涉及 `git reset`、不涉及 `git clean`、不涉及 force push。

## 结论

三个低风险 bridge 已稳定化完成。本轮不接入新页面，不接 Chat send，不接 approvals。

diagnostics、providerConfig、fileContext 三个 bridge 行为保持不变。