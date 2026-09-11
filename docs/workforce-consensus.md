# 三角色共识审查

提交一份明确的计划、验收问题和材料，三个实际员工会分别给出独立意见。系统保留原文引用、角色与模型来源、调用回执和分歧，生成一份可复核的计划建议。每一份意见都使用同一版材料，且不接收其他角色的回答。

审查通过已有 `/workforce/execute` 执行。普通 `/workforce/plan` 仍是模板预览；预览中的 `consensus.ready=false`，`previewComplete` 只表示示例角色齐全。保存、导出或记录一次预览审批不会形成真实共识。

## 准备三个实际绑定

使用[既有员工模型配置](agent-governance.md#explicit-employee-model-contributions)，配置恰好三个角色和三个不同的 `employeeId`：

| 实际角色 | 审阅视角 | 关注点 |
| --- | --- | --- |
| `ceo` | Critic | 未证实的主张、风险和证据缺口 |
| `pm` | Planner | 计划可行性、依赖和验收动作 |
| `architect` | Architect | 技术一致性、接口和验证方案 |

这个组合保留既有角色依赖关系。三个角色可以配置不同模型；即使使用同一模型，也必须是三个独立的网关操作。不同请求不自动证明模型具有不同偏差。

服务端配置 `AI_GATEWAY_WORKFORCE_ROLE_EXECUTION_PROFILE_JSON` 的示例如下。示例只引用已有本地 fake Provider；模型配置里不存凭据。

```json
{
  "version": 1,
  "mode": "gateway-llm-required",
  "profileId": "three-role-review",
  "maxTotalRequests": 3,
  "maxConcurrentRoles": 1,
  "bindings": [
    {"roleId":"ceo","employeeId":"review-critic","providerId":"local-fake-provider","modelId":"local-fake-model","maxRequests":1,"maxInputTokens":16000,"maxOutputTokens":2048,"timeoutMs":30000},
    {"roleId":"pm","employeeId":"review-planner","providerId":"local-fake-provider","modelId":"local-fake-model","maxRequests":1,"maxInputTokens":16000,"maxOutputTokens":2048,"timeoutMs":30000},
    {"roleId":"architect","employeeId":"review-architect","providerId":"local-fake-provider","modelId":"local-fake-model","maxRequests":1,"maxInputTokens":16000,"maxOutputTokens":2048,"timeoutMs":30000}
  ]
}
```

还需要原执行开关、企业身份、有效根 Agent、`workforce_execute` 工具权限及两层现有审批。该工具被既有目录归为写操作，因为执行会创建隔离工作树和记录，因此策略还须允许 `canWrite`。本次审查可以保持 `file_write`、`shell_exec` 和 `code_run` 为 deny。

普通 fake Provider 不保证返回符合意见格式的文本，运行后可能得到 `incomplete`。自动测试使用专门返回结构化意见的合成 Provider 验证链路；真实意见质量要在明确选定模型、材料和预算后另外验收。

## 提交同一份审阅材料

将以下意图交给已有认证的 HTTP 客户端。`agentId` 换成操作者拥有的根 Agent；材料应来自你希望审阅的版本。目标只取顶层 `goal`。

```json
{
  "planId": "review-plan-001",
  "agentId": "agt_replace_with_your_agent",
  "goal": "审查任务身份验证的实施计划",
  "autonomyMode": "controlled-execution",
  "consensusReview": {
    "proposal": [{"id":"binding-check","title":"核对任务身份验证","verification":"检查所有者和计划编号的负面测试。"}],
    "criteria": [{"id":"owner-and-plan","question":"当前方案是否同时检查所有者与计划编号？","verification":"把实现片段和两项负面测试逐一对应。"}],
    "evidence": [{"id":"implementation","title":"拟审阅版本的实现摘录","content":"请替换为实际代码片段或验证记录，保留必要上下文。"}]
  }
}
```

`proposal` 支持 1–12 步，`criteria` 支持 1–6 个可证伪问题，`evidence` 支持 1–12 份材料。单份内容最多 4000 UTF-8 字节，内容总计最多 16000 字节；多行代码和普通摘要哈希可以保留。材料中不要放凭据、原始敏感日志或受保护文件。每份源文、全部材料和完整角色绑定均生成哈希并进入审批。

先向 `/workforce/execute/approve` 提交原意图，加 `"approvedScopes":["workforce:execute"]`。再向 `/workforce/execute` 提交原意图。策略要求工具审批时返回 HTTP 202；用现有命令阅读完整材料与模型预算，再决定：

```text
pnpm gateway agents approvals --agent-id <agent-id>
pnpm gateway agents approve --approval-id <approval-id> --yes
```

批准后向 `/workforce/execute` 提交同一意图，最多取得三份意见。材料、模型、员工或预算变化后，原审批不能批准新请求。本审查与 `codeDelivery`、`workflowHandoff` 分开提交，建议中涉及的实施仍要单独审阅和批准。

## 读取结论和原始依据

保存响应中的 `executionId`，使用：

```text
pnpm gateway workforce status <execution-id> --json
```

对应 SDK 为 `workforceExecutionStatus(executionId)`，HTTP 为 `POST /workforce/execute/status`。客户端核对执行 ID、材料和报告哈希，完整显示 `consensusReport`。默认凭据入口沿用 `AGENT_CONSOLE_ADMIN_KEY` 或显式管理认证参数，凭据不进入材料文件。

| 报告结论 | 意义及下一步 |
| --- | --- |
| `complete` + `recommend-proceed` | 三份有效意见对每项标准都表示支持；这是模型建议，实施仍需新审批。 |
| `complete` + `revise` | 至少一方反对或认为证据不足；查看 `requiredRevisions` 和每项标准的全部判断，修订方案或补充材料。 |
| `incomplete` | 有角色未取得有效意见，或原执行失败、取消、强制停止；不能算作完整共识。 |
| `not-recorded-no-automatic-redispatch` | 当前生命周期没有完整报告。保留执行 ID；已发生的模型调用不能被假定为零。 |

冲突规则固定为 `any-objection-holds-plan-v1`：保留每一份意见，任何反对或证据不足都会产生与原标准关联的修订要求。原目标和原计划步骤保持可追溯，新增要求出现在 `decision.proposedPlan.requiredRevisions`。系统不通过多数投票消除异议，也不静默把建议应用到项目。新方案用新计划 ID 和新的审批重新审查。

意见必须覆盖全部标准，单份原始模型响应最多 64 KiB。支持或反对必须引用输入材料中的精确原文；缺少标准、重复键、虚构引用、空答案、工具调用、失败或超时均不能变成模板成功。引用匹配只证明原文存在；材料真实性、结论含义和实施效果仍须操作者或独立检查确认，报告的 `semanticTruthVerified` 始终为 false。

每份有效意见保留角色、员工、实际模型和请求 ID，以及消息哈希和网关输入证明。该路径使用现有 Context Codec 的 off 配置，核对完整输入并固定模型；服务端验证发送材料，CLI 验证报告的自包含一致性。`inputTokens/outputTokens/totalTokens` 只保留上游明确上报的数值，缺失为 null；成本为 null，网关操作数也不等于底层网络重试次数或账单。

## 取消、丢回执和恢复

取消沿用原 `POST /workforce/execute/cancel`，请求体含 `executionId` 和 `reason`。已发起的调用可能为 `outcome_unknown`，不会因取消被改成“未调用”。完成的意见、失败信息和已观察用量写入原生命周期，父任务的取消或失败历史保留。

请求断开或末尾回执失败后，先查询原执行 ID。报告已持久化时，重启后仍可读取和核对，无需再次询问模型。报告的 `complete` 表示意见收集完整；它不代替原 HTTP 请求的最终治理或其他执行权限。报告写入前发生中断时，查询可能没有完整报告；系统不会自动重发未知模型调用。篡改后的记录被拒绝读取，不会被覆盖成新的“成功”。

## 范围、回退与 Language Selection

审查对象是明确提交并批准的文本材料，材料哈希标识其版本。代码摘录、测试结果和时间信息由操作者准备，系统不把材料标题当成当前仓库或外部事实的证明。报告属于现有可信服务状态，不是第三方签名或生产质量认证。

停止新增审查时不再提交 `consensusReview`。源代码回退前先结束活动任务，保留原生命周期、治理记录、原目录及支持当前字段的读取版本；旧二进制无法解释新报告时，不要用重新运行模型代替历史恢复。没有新增依赖、数据库表或常驻服务；既有生命周期增加冻结审阅材料和一次写入的报告。

- **Workload:** 在原角色执行和审批边界内收集独立意见，核对完整文本输入、真实操作回执、引用与分歧，并恢复原报告。
- **Primary path:** `workforceConsensusReview.ts`、`workforceConsensusRuntime.ts`、`workforceConsensusReport.ts`，以及既有 Workforce、Provider、治理和 CLI 所有者。
- **Alternatives:** TypeScript 保留现有运行时与共享合同；JavaScript 易于复用但弱化新审阅结构的静态检查；Rust 需要新构建和跨进程授权接口，当前没有测得的收益。
- **Scorecard:** 领域/维护/运维/安全/迁移/生态各 1–5 分，TypeScript 5/5/5/5/5/5=30，JavaScript 5/4/5/3/5/5=27，Rust 3/3/2/5/1/2=16。新逻辑使用 TypeScript，原 JS 接线保留所属模块。
- **Scope review:** 跨过 8 文件和 500 行复核线是因为同一审阅必须覆盖完整审批、三次实际调用、输入证明、持久记录、输出治理和客户端；还要修正旧预览仅凭角色名宣称就绪的路径。复用原 DAG 和存储，不建立另一套调度器或任意工具执行入口。
- **Risk closure:** 实际本地 HTTP/CLI 测试覆盖同意、分歧、无效意见、审批材料变化、取消、末尾回执丢失、重启和记录篡改；计数输出测试保留策略明确禁止时的拒绝，字符串不能冒充 token 数值。完整本地门禁与真实模型质量、公开克隆、跨主机和生产证据分开记录。
