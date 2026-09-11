# Workforce 任务交给本地工作流

在受治理的 Workforce 执行中，为一个实际角色指定 `workflowHandoff`，该角色完成分析后会运行现有的本地知识报告工作流。工作流检索本地知识、整理 Markdown，并把报告写入既有管理目录。只有工作流记录、当前文件及 SHA-256 核对成功后，该角色才回传完成结果。

这条路径复用实际任务队列、Agent 治理、工作流记录和文件发布机制。保存的 Workforce 计划、`forge workforce` 预览、独立 claim 字符串都不授予执行权限。未提供 `workflowHandoff` 的请求保持原有行为。

## 执行前审阅

服务须已启用 `WORKFORCE_EXECUTION_ENABLED=true` 和 Agent Governance，并使用企业身份认证。根 Agent 必须获准使用 `workforce_execute`、`file_write`，且当前策略允许写入对应的工作流范围。配置、策略或审批不满足时会拒绝操作。服务仍然默认使用 fake Provider；是否执行真实角色模型由已有服务端角色配置决定。

下面是提交给 `/workforce/execute/approve` 和 `/workforce/execute` 的同一任务意图。`agentId` 换成当前操作者拥有的根 Agent。所选角色须存在于服务实际执行计划中。

```json
{
  "planId": "release-report-001",
  "agentId": "agt_replace_with_your_agent",
  "goal": "整理当前版本的发布验证报告",
  "autonomyMode": "controlled-execution",
  "workflowHandoff": {
    "roleId": "ceo",
    "query": "发布验证与恢复步骤",
    "topK": 3,
    "sourceIds": []
  }
}
```

交接只支持 `controlled-execution`；`dry-run` 可以生成描述，不能批准实际执行。查询默认为计划目标，`topK` 为 1–5，来源最多 32 个。每个计划只选择一个交接角色。不能指定任意文件路径、命令、工作流 ID 或伪造的任务权限。

1. 使用现有认证的 HTTP 客户端向 `/workforce/execute/approve` 提交上面的任务，再加 `"approvedScopes":["workforce:execute"]`，审核并批准整个计划。
2. 向 `/workforce/execute` 提交原任务。当前策略要求审批时会返回 HTTP 202 和 `approvalId`。使用 `pnpm gateway agents approvals --agent-id <agent-id>` 查看完整审批，再通过现有 `agents approve` 命令决定。
3. 批准后向 `/workforce/execute` 提交同一任务。此时才会开始角色任务。角色的模型请求仍遵守既有策略和预算。
4. 若 `file_write` 还要求审批，父任务会失败并保留子工作流及待审批报告。审批界面展示完整 Markdown、目标文件身份和内容哈希。批准这份报告后使用下面的原工作流恢复入口，保留最初的三个 ID。

整个交接意图的角色、目标、查询、来源、数量、输出根目录哈希和 `reviewHash` 都进入计划摘要及 Agent 审批。CLI 会完整展示这些字段并检查审批选项哈希。改变任一字段或服务配置后，旧审批不能批准新的意图。完整报告的写入审批另外绑定实际准备好的内容与目标文件。

## 查看与恢复

父响应含 `executionId` 和 `workflowHandoff`。先记录父执行 ID，再查询：

```text
pnpm gateway workforce status <execution-id> --json
```

客户端使用当前安全管理认证入口；不要把管理令牌写入任务 JSON。也可以调用 SDK `workforceExecutionStatus(executionId)`，或 `POST /workforce/execute/status`，请求体仅为 `{"executionId":"..."}`。

恢复文件 `recovery.json` 只包含从同一条状态响应取得的三个 ID：

```json
{
  "executionId": "原父执行ID",
  "taskId": "workflowHandoff.taskId",
  "workflowId": "workflowHandoff.workflowId"
}
```

```text
pnpm gateway workforce handoff-recover --input recovery.json --yes --json
```

对应 SDK 是 `recoverWorkforceWorkflow({executionId, taskId, workflowId})`；HTTP 是 `POST /workforce/execute/handoff/recover`。此操作需要当前操作者身份、原 Agent 的新执行授权和当前文件治理。它只恢复记录中的子工作流，不重跑 Workforce 角色；禁止额外查询、目标、Agent 或路径参数。

| 状态或字段 | 操作者应该如何理解 |
| --- | --- |
| 父任务 `pending/running/paused` | 原任务尚未结束，恢复接口拒绝开始第二次工作。需要时使用原取消入口。 |
| `error.approvalId` | 原报告等待审批。先阅读并决定这份审批，再恢复同一个子工作流。 |
| `canResume=true`、`run-safe-remaining-stages` | 在原输入下继续剩余步骤；已保存的草稿复用，尚未准备完成的检索可重新运行。发布仍需当前治理。 |
| `outcomeUnknown=true` | 文件可能已经写入。恢复先核对原发布记录；仍无法确定时停止，不重新发布。 |
| `recheck-governance-only` | 已核实原发布，只补回执治理，不再次写文件或消费新的文件审批。 |
| `status=completed` 且 `artifactVerified=true` | 本次状态查询确认了原记录和当前文件。可使用返回的报告及哈希。 |
| `artifactVerified=false` | 文件丢失或发生变化；结果被隐藏，恢复拒绝覆盖或重建。 |
| `not_observed` | 当前主机和操作者范围未观察到子记录；不能据此断言它从未执行，也不能据此创建新子任务。 |

恢复后的 `parentExecutionStatus` 保留原父状态；`parentExecutionResumed=false` 和 `employeeRolesRerun=false` 明确说明恢复范围。随后查询父状态，会从同一个工作流记录读取最新结果。父任务过去的失败或取消记录仍然保留。

请求超时、断线或回执丢失后，保留三个 ID，先查询状态。CLI 和 SDK 不自动重试或跟随重定向。重新批准并提交整个 Workforce 计划会形成新的父执行，不能把它当作旧任务恢复。

## 持久化、限制与回退

父生命周期保存冻结的 Agent、计划、意图引用；原工作流 SQLite 记录保存任务来源、输入、阶段、审批 ID、发布和结果。任务原始令牌不进入交接记录。交接绑定一次性实际 DAG 权限，并在发布前再次检查任务有效期和 Agent 状态。

当前本地工作流记录仍为单主机 SQLite。即使父生命周期使用 PostgreSQL，状态和恢复也需要回到拥有原工作流目录的主机。本地测试不证明跨主机故障转移、真实模型产物质量或生产稳定性。

停止新增交接时，客户端不再发送 `workflowHandoff`；要暂停整个 Workforce 执行，可关闭原执行开关并正常重启。保留父生命周期目录、原工作流目录、治理记录以及原目录身份；不要搬移、删除或改写文件来“修复”未知状态。恢复现有任务需要保留支持此字段的服务版本。

本改动不新增数据库表或独立后台服务，但会在既有记录中增加交接来源及审批字段。旧版本没有这些语义：回退二进制前先停止新增交接、处理活动任务，并保留可读取当前记录的版本与完整数据。不要用旧的直接 `/workflow/run` 请求替代交接恢复，它缺少原来源绑定。普通工作流和未选择交接的 Workforce 请求兼容原行为。

## 验证与 Language Selection

- **Workload:** 在现有异步任务、授权和 SQLite 工作流之间传递有期限的任务权限，确认产物，再提供可核对的状态和恢复入口。
- **Primary path:** `workforceWorkflowHandoffProfile.ts`、`workforceWorkflowHandoffBinding.ts`、`workflowHandoffContext.ts`、`workforceWorkflowHandoffRuntime.ts`；既有应用工厂、路由、生命周期、审批及客户端负责接线。
- **Alternatives:** TypeScript 与当前网关/契约保持同一运行时；Node ESM JavaScript 能复用运行时但缺少新边界的静态约束；Rust 需要新增语言、构建与跨进程授权接口，没有测得的必要收益。
- **Scorecard:** 按领域/维护/运维/安全/迁移/生态各 1–5 分评估，TypeScript 为 5/5/5/5/5/5=30；JavaScript 为 5/4/5/3/5/5=27；Rust 为 3/3/2/5/1/2=16。新增运行行为使用 TypeScript，现有 JS 文件只修改原拥有行为的接线。
- **Scope review:** 超过 8 文件和 500 行是因为同一授权链必须覆盖计划与 Agent 审批、实际任务权限、工作流发布、持久恢复、HTTP 与 CLI/SDK。复用既有记录与服务，不创建第二套交接执行器；原不受共同治理的独立实现改为拒绝无权限请求。
- **Policy impact:** 不新增依赖或真实 Provider 默认调用，不扩大文件写入目录，不加入部署或发布行为。契约新增可选审阅/恢复字段和客户端方法。
- **Quantified risk mitigation:** 直接测试覆盖真实本地 DAG/文件/SQLite、单次权限、过期、审批等待、取消、未知回执、文件篡改和重启；实际 HTTP 测试覆盖双审批、完成回填、取消和原任务恢复。CLI/SDK 测试核对完整审批、精确 ID、确认及错误/重定向处理。完整检查与测试属于本地门禁，外部环境证据单独验收。
