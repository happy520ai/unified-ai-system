# Phase323D-7 FileContext Bridge Report

## 范围

- 本轮只接入 `fileContext / 添加文件` 页面对应的 `POST /file-context/select`。
- 本轮不接入 approvals，不接 `approve / reject / apply-approved`。
- 本轮不接入 Chat send，不修改 `/chat-gateway/execute`，不修改 `httpServer.js`。

## 接入方式

- 延续 Phase323D-5 的局部 bridge 结构。
- 在 [consolePage.js](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/src/ui/consolePage.js) 的 `createWorkbenchApiBridge()` 中补充：
  - `selectFileContext(body)`
- 在 `handleFilesSelected(event)` 中将原有直接 `requestJson("/file-context/select", ...)` 替换为：
  - `workbenchApiClient.selectFileContext(payload)`

## 保持不变

- `method` 保持 `POST`
- `path` 保持 `/file-context/select`
- `body` 结构保持不变：
  - `files[].name`
  - `files[].path`
  - `files[].size`
  - `files[].type`
- `/ui` 入口不变
- 5 个 Workbench 主模块不变
- Chat 请求 body 不变
- `selectedModel` localStorage 不变
- diagnostics bridge 不变
- providerConfig bridge 不变
- approvals 区域不变

## 安全收口

- 继续保持 fileContext 仅做登记 / 预览，不读取真实文件内容。
- 本轮未引入 embedding、知识训练、paid API 或本地文件写入。
- 在 fileContext 展示层新增最小前端遮罩：
  - 对命中 `.env / secret / token / credential` 模式的 `name` 显示 `[blocked-sensitive-file]`
  - 对命中相同模式的 `path` 显示 `[blocked-sensitive-path]`
- 这样即便后端返回 blocked 元数据，前端也不会把敏感文件名或路径原样回显。

## 风险说明

- 本轮没有改后端路由与数据结构，因此 bridge 风险集中在前端局部调用替换。
- fileContext `safe-to-bridge` 的前提仍成立：
  - 不读真实内容
  - 不训练知识库
  - 不 embedding
  - 不调用 paid API
- 如果未来 fileContext 扩展为真实内容采集或知识训练入口，必须重新评估，不得沿用本轮低风险结论。
