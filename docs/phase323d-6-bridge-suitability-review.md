# Phase323D-6 Bridge Suitability Review

## 范围

- 本轮只评估 `approvals` 与 `fileContext` 是否适合未来采用 diagnostics / providerConfig 同样的局部 bridge 模式。
- 本轮不修改 [consolePage.js](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/src/ui/consolePage.js)。
- 本轮不接入 approvals 或 fileContext 到生产 UI。
- 本轮不修改 `/chat-gateway/execute`、`httpServer.js`、Chat send 或 5 个 Workbench 主模块。

## 已核对对象

- [consolePage.js](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/src/ui/consolePage.js)
- [apiClient.js](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/src/ui/workbench/apiClient.js)
- [phase319LocalOperationService.js](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/src/local-operation/phase319LocalOperationService.js)
- [approvalStore.js](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/src/approval/approvalStore.js)
- [fileContextStore.js](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/src/file-context/fileContextStore.js)

## Suitability Matrix

| 评估项 | approvals | fileContext |
| --- | --- | --- |
| 是否涉及本地文件路径 | 是，审批记录包含 `allowedFiles` / `forbiddenPaths` | 是，但当前只登记传入的文件元数据 |
| 是否涉及审批 / 执行 / apply 操作 | 是，包含 `approve` / `reject` / `apply-approved` | 否，当前仅 `POST /file-context/select` |
| 是否存在 forbiddenPaths 保护链 | 是，审批链路直接依赖 forbiddenPaths | 有敏感命名拦截，但不是 apply 链 |
| 是否可能误触发真实文件写入 | 是，`apply-approved` 最终进入本地操作执行器 | 否，当前 store 仅记录 selection |
| 是否可能误触发 embedding / paid API | 当前链路未见 paid API，但 apply 链风险高 | 当前返回 `providerCalled=false`，未见 embedding / paid API |
| 是否可能暴露 secret 文件名 / 路径 | 中等风险，审批记录可能带路径元数据 | 低到中等风险，仍会携带文件名/路径，需要继续限制展示 |
| 是否为只读或预览类请求 | 部分是，如 `GET /approvals`、`POST /local-agent/intent-preview`、`POST /local-agent/patch-proposal` | 是，当前更接近登记/预览 |
| 是否已有稳定 request body | 部分稳定，但 approvals 页面混合 create / approve / reject / apply | 是，当前 body 只包含 files 元数据列表 |
| 是否有清晰错误处理 | 有基础错误语义，但审批动作分支较多 | 有，且语义简单 |
| 是否适合局部 bridge | 整体暂不适合 | 相对适合 |
| 是否需要额外验证命令 | 需要，至少拆出 approvals list/preview 与 apply 链回归 | 需要，主要是 product recovery 与 secret safety |
| 是否建议下一阶段接入 | 不建议整页直接接入 | 可作为下一阶段低风险候选 |

## Approvals 结论

- 结论：`bridge-later`
- 原因：
  - 当前 approvals 页面不是单一只读列表，而是直接串联 `POST /local-agent/patch-proposal`、`POST /approvals/create`、`POST /approvals/:id/approve`、`POST /approvals/:id/reject`、`POST /local-operation/apply-approved`。
  - 其中 `apply-approved` 会进入 [localOperationLoop.js](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/src/agent-runner/localOperationLoop.js) 的执行门禁链，虽然默认受 `dryRun`、`allowedFiles`、`forbiddenPaths`、approval gate 限制，但它已经不再是 diagnostics / providerConfig 那种纯状态或配置类 bridge。
  - 即使只 bridge `GET /approvals`，当前页面交互仍与 approve / reject / apply 混在一起，若不先拆分 UI 风险边界，后续很容易被误扩成“顺手把 apply 也桥接了”。
- 建议：
  - 下一阶段如要继续推进，先单独做“approvals list / preview 与 apply-approved 风险边界文档”。
  - 若未来确需补 API client 方法，优先考虑 `listApprovals()`、`previewLocalAgentIntent(payload)`、`createPatchProposal(payload)` 这类 read-only / preview-only 入口。
  - 不建议在 bridge 清晰前补 `approveApproval(id)`、`rejectApproval(id)`、`applyApprovedOperation(payload)` 并接入 UI。

## FileContext 结论

- 结论：`safe-to-bridge`
- 原因：
  - 当前 `POST /file-context/select` 走 [fileContextStore.js](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/src/file-context/fileContextStore.js)，只做文件元数据标准化与受限登记。
  - 该链路已有 `BLOCKED_FILE_PATTERN`，会拦截 `.env`、`secret`、`token`、`credential` 等敏感命名。
  - 当前服务响应明确包含 `approvalRequired: true`、`providerCalled: false`、`localExecutionTriggered: false`、`secretContentStored: false`，没有发现 embedding 或 paid API 调用迹象。
  - [apiClient.js](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/src/ui/workbench/apiClient.js) 已有 `selectFileContext(body)`，说明客户端语义面已经具备低风险 bridge 的基础。
- 风险提醒：
  - 即使是低风险入口，也仍包含文件名 / 路径元数据，后续 bridge 时应继续避免在 UI 中扩大展示敏感路径。
  - 如果未来 fileContext 引入真实文件内容读取、知识入库、embedding 或训练入口，则不再属于本报告的低风险结论。

## API Client 评估

- 本轮未修改 [apiClient.js](/E:/AI-Data/AI网关系统/unified-ai-system/apps/ai-gateway-service/src/ui/workbench/apiClient.js)。
- 原因：
  - `selectFileContext(body)` 与 `listApprovals()` 已存在。
  - 本轮目标是 suitability review，不是提前补一批未来可能不用的方法。
  - 保持 API client 无额外变化，可以把风险收敛在文档与静态规划层。

## 下一阶段建议

- `fileContext` 可优先进入 Phase323D-7 候选，但应保持“只 bridge 文件选择登记，不接知识训练、不读真实内容、不动 Chat send”。
- `approvals` 不建议在下一轮直接生产接入。应先拆出 list / preview 与 apply 链边界，再判断是否能独立 bridge。
- Chat send apiClient 接入继续延后。
