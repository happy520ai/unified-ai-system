# Workforce 固定生命周期钩子

生命周期钩子在既有计划、保存、导出及受治理工作流交接中执行固定检查，并返回可核对的回执。它们默认关闭；计划仍是确定性预览，回执不授予 Agent 权限，也不构成模型执行、语义正确或生产可用的证明。

## 服务端启用与实际入口

服务端环境变量 `AI_GATEWAY_WORKFORCE_LIFECYCLE_HOOKS_ENABLED` 只接受精确字符串 `true` 或 `false`；未设置等同于 `false`。空字符串、`1`、大小写变体及其他值会使应用启动失败，错误码为 `WORKFORCE_HOOK_CONFIGURATION_INVALID`。正常重启后通过 `GET /workforce/health` 的 `lifecycleHooks` 查看实际启用状态和固定目录。

| 事件 | 固定处理器 | 实际职责与访问范围 |
| --- | --- | --- |
| `beforePlan` | `goal.guard` | 只读检查计划目标；在生成计划前执行。 |
| `afterPlan` | `plan.audit` | 校验原目标与计划摘要；通过服务内部的记录回调，把计划和两份回执写入已有计划存储。唯一具有 `plan-record` 访问范围的事件。 |
| `beforeExport` | `export.guard` | 只读检查即将导出的已保存计划，返回本次导出的回执。 |
| `beforeWorkflowRun` | `workflow.guard` | 在实际受治理的 Workforce 工作流交接前检查原计划、任务、Agent 和输出根目录绑定。 |

请求不能配置处理器、命令、任意代码或任意事件。`hooks`、`hookHandlers`、`hookRuntime` 以及上传的钩子回执不能启用或替代服务端执行。现有 `hookEventsPreview` 仍是预览说明，不代表这些事件已经执行。

启用后，`POST /workforce/plan` 使用实际的 `planAndSave` 路径，先检查、再生成预览计划、最后保存计划和审计。`POST /workforce/plans/save` 的 `{ "goal": ... }` 形式复用同一个操作。普通库调用 `workforceService.plan(input)` 保持同步预览，不产生真实钩子回执。`save({ plan })` 仍可导入预览计划，但递归移除上传内容中的 `hookAudit`、`hookReceipts` 和 `lifecycleHooks`，不能借导入声称服务执行过钩子。

计划与保存需要当前已认证用户的 `workflow:run` 权限；导出需要 `dashboard:read`。租户、用户与权限由服务端认证上下文提供，不能用请求 JSON 冒充。工作流交接还需要原任务、Agent 和文件发布的既有治理检查。

## 稳定操作 ID 与计划重放

开启钩子的计划请求必须包含客户端生成并保留的 `operationId`。它是 1–128 个字符，首字符为字母或数字，后续可用字母、数字、点、下划线、冒号和连字符；不要放入秘密或认证信息。正常重试必须保留相同 ID 和完整请求内容。

使用现有已认证 HTTP 客户端提交以下请求；请求示例不包含认证材料：

```http
POST /workforce/plan
Content-Type: application/json

{
  "operationId": "release-review-plan-20260910-01",
  "goal": "整理本地发布审阅计划与验收清单"
}
```

也可以把同一 JSON 提交至 `POST /workforce/plans/save`。需要恢复同一次请求时保留原入口和原请求体，不要生成新操作 ID。钩子关闭时，不带 `operationId` 的请求维持既有预览与保存行为；带 ID 的请求只能读取仍存在的原操作，找不到时返回 `WORKFORCE_HOOK_DISABLED`，不会悄悄生成替代计划。

允许使用本地确定性编排入口 `POST /workforce/run-local` 时，其规划与保存阶段也复用这两个钩子和稳定 ID。重试复用原规划回执；模板角色编排仍按该入口执行，不能将计划重放理解为整次角色执行的去重。启用 Agent Governance 时，该旧入口仍要求改用既有受治理执行路径。

服务把操作 ID 与当前用户、租户及完整规划输入的哈希绑定。在原记录仍存在的前提下，相同用户、租户、操作 ID 和输入返回原保存记录，`hookReplayed=true`，不再次运行计划钩子。相同 ID 对应不同输入会拒绝；不能只保留 `goal` 而改变模板、澄清答案或其他规划字段。

成功的 HTTP 计划结果增加 `hookAudit` 和 `hookReplayed`；保存响应的 `taskPackage.hookAudit` 持有同一审计。审计结构为：

```text
hookAudit
  version: 1
  binding: kind, operationId, requestHash, tenantFingerprint, subjectFingerprint
  receipts: [beforePlan receipt, afterPlan receipt]
  auditHash: SHA-256 of the complete audit body
```

回执包括固定事件、处理器、访问范围、操作绑定、经检查的载荷、载荷哈希、结果、时间及回执哈希。内部 `hkop_...` 操作 ID 与客户端提交的 `operationId` 是不同标识。哈希校验用于检查字段一致性；把回执复制成 JSON 不会获得进程内记录权限。

`GET /workforce/plans/{planId}` 读取保存记录；`GET /workforce/plans/{planId}/export` 返回导出。启用钩子时，导出响应另有 `lifecycleHooks: { persisted: false, receipts: [...] }`。该回执属于本次导出，返回后不写回原计划；保存时的 `hookAudit` 继续保留。

现有 SDK 的 `workforcePlan(request)`、`workforcePlanSave(request)` 原样发送请求 JSON；`workforcePlanGet(planId)` 和 `workforcePlanExport(planId)` 返回相应结果。此次没有新增 CLI 命令，也不把既有终端计划预览改造成实际执行。

## 取消、截止时间与结果未知

记录回调开始前的取消或过期不会调用保存回调。回调开始后，即使请求取消、到达截止时间或回调报错，也不能断言存储没有发生变更：服务返回 `WORKFORCE_HOOK_RECORD_UNKNOWN`、`details.outcomeUnknown=true`、`retryable=false`，并保留原操作绑定及 `outcome="unknown"` 回执。`details.effectMayHaveCommitted=true` 明确表示可能已提交，`details.requestedOperationId` 用于找回客户端原 ID。

等待中的回调会继续被观察，迟到的成功或失败都不会触发第二次保存。原回调尚未结束时，当前进程保留活动操作；相同请求仍取得原来的未知结果，不能启动新的回调。失败句柄不能再次执行。

重复请求可以独立取消等待或到达自己的截止时间；响应中的 `details.originalOperationMayBeActive=true` 表示原操作可能仍在进行。停止等待不会取消原请求或释放它的操作占用。

保留原请求 JSON、客户端 `operationId`、返回的内部操作 ID 和已知 `planId`。先核对既有计划记录；回调结束后，可在同一用户、租户和存储范围，用原请求恢复读取。不要把结果未知当作“没有写入”，也不要换新 ID 来绕过它。若原保存记录已被删除，依附该记录的历史也已丢失；再次提交不能证明恢复了原操作。

工作流交接的恢复使用另一组标识：原 `executionId`、`taskId`、`workflowId`。通过已有状态与 `POST /workforce/execute/handoff/recover` 入口恢复，详见[工作流交接与恢复](workforce-workflow-handoff.md)。启用钩子的新交接把原 `beforeWorkflowRun` 回执放入版本 2 的来源记录；恢复读取并核对原回执，不重新运行该事件，也不以客户端上传回执替换它。计划操作 ID 不能代替这三个工作流 ID。

## 存储边界与回退

规划钩子输入上限为 128 KiB，每个服务实例最多保留 64 个活动规划操作。JSON 计划存储在同一进程内按存储路径串行修改；SQLite 使用既有表的原子插入来处理同一计划 ID 的竞争。活动回调的等待状态只存在于当前进程，重启后的核对依赖保留下来的计划记录。

这些是本地主机存储和回执一致性边界。它们不证明跨主机故障转移、所有进程都只执行一次处理器、历史永不丢失，或全局 exactly-once。默认 JSON 文件也没有跨进程写入锁。没有新增数据库表、第三方依赖、独立服务或调度器。

本次变更超过 8 个文件和 500 行的复核线：四个已承诺事件分别属于规划、存储、导出和工作流模块，需要贯通实际 HTTP 入口、共享结果类型、原记录恢复及对应测试。新逻辑集中在两个 TypeScript 模块，其他文件以接线、兼容读取和验证为主；没有另建通用事件总线。计划存储由原应用资源所有者关闭，启动失败和正常关闭沿用既有资源清理路径。

停止新增钩子时，设为 `false` 并正常重启；先处理或确认当前活动操作，保留计划存储与原工作流记录。当前读取器继续支持已有计划审计和版本 1/2 工作流来源。回退旧二进制前，须确认它能读取现有审计与版本 2 来源；不能为兼容旧版而删掉回执、改成版本 1，或重建未知结果。普通关闭模式保留既有预览行为，现有受治理执行仍遵循原审批条件。

## 验证状态与 Language Selection

源码中的直接测试验证事件顺序、私有句柄、回执绑定和取消；集成测试经过实际 HTTP、SDK、SQLite 计划读回，以及真实本地工作流与审批恢复。每次交付的最终门禁和源码版本绑定结果保存在忽略的运行证据目录；这些本地测试不等于真实 Provider 或生产验证。

- **Workload:** 在现有异步计划保存与工作流交接边界执行固定检查，关联不可变回执，并安全处理等待中的取消与未知结果。
- **Primary path:** `workforceLifecycleHooks.ts`、`workforceHookOperations.ts`、既有工作流来源与上下文模块；原服务、HTTP 路由和计划存储仅负责已有行为的接线。
- **Alternatives:** TypeScript 保留共享契约与异步结果的静态检查；Node ESM JavaScript 复用同一运行时但缺少这些静态约束。新增语言没有可量化的当前收益，且会增加构建与跨进程边界。
- **Scorecard:** 按领域/维护/运维/安全/迁移/生态各 1–5 分作工程判断，新增核心模块的 TypeScript 为 5/5/5/5/5/5=30，JavaScript 为 5/4/5/3/5/5=27。这不是性能测量；现有 JS 接线做最小修改，避免无关语言迁移。
- **Compatibility/rollback boundary:** DTO 仅增加可选请求和结果字段；严格开关默认关闭。回退保留当前审计读取和版本 2 工作流来源语义，不迁移存储或删除历史。
- **Policy impact:** 固定目录没有用户可注入处理器；不改变真实 Provider、审批或部署授权，不添加数据库表、依赖或长期进程。
- **Risk closure:** 直接测试覆盖顺序、一次性句柄、取消/截止时间、迟到回调及回执校验；集成测试核对 HTTP 与 SDK 的稳定 ID、计划读回、输入冲突、导出不持久化和原工作流恢复。最终门禁以交付时绑定的实际运行结果为准。
