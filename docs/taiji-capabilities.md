# 太极：候选、执行与反馈

太极的本地运行路径会实际执行固定适配器、核验产物并保存回执。候选评估通过不会自动激活；激活、任务执行以及反馈变更分别绑定完整的单次审批。

## 当前可执行范围

| Profile | 输入和实际行为 | 验证边界 |
| --- | --- | --- |
| `context-jsonl-v1` | 将带名称、值和引用的事实编码成 JSONL | 重新解析产物，逐项核对数量、名称、值类型和引用；不能漏项、添加或改写事实。它没有接入聊天请求压缩，也不声称节省了模型 token。 |
| `risk-classification-v1` | 执行既有确定性风险规则，以及候选中明示的附加关键词 | 固定校准用例覆盖既有规则；若任务提供 `expectedSignals`，实际结果还须与其一致。这是可解释的规则分类，不是安全裁决或权限授予。 |
| `evidence-summary-v1` | 汇总传入的证据记录，保留全部尝试、当前状态和首次失败 | 重新检查原记录、最后一次结果和最早失败。引用的哈希按输入保存，不代表已读取或认证外部证据文件。 |

适配器在具有独立堆、内存限制和可终止生命周期的 Node 工作线程中运行，只接受数据。执行器仅加载自身固定模块，不根据输入读取用户文件、导入模块或执行用户代码。这不是运行任意不可信代码的操作系统沙箱。

当前 profile 不调用模型或外部服务。回执中的 `modelUsage` 明示单位为 `tokens`、总量为零；耗时来自实际执行记录。它们不修改 `/chat`、默认模型选择、原生登录、Base URL 或配额。

`POST /taiji/compile` 和 `uai forge taiji` 继续生成草案。新的执行路径是下面的 `/taiji/capabilities` 接口。旧 `/real-capabilities/activate-five` 只汇集有限检查和已有回执，不再把 dry-run 或 CLI 存在当作五项能力均已执行。

## 启用与权限

1. 使用现有企业认证和 Agent Governance，配置 `TAIJI_BEIDOU_AUTO_RUNTIME_ENABLED=true` 后启动网关。该开关默认关闭。
2. 为专用根 Agent 配置允许这些工具的上层能力上限：`taiji_capability` 必须为 `require_approval`；`taiji_inspect` 可设为 `allow`。原有策略不会被自动扩大。通过现有 `governancePolicies`、`createGovernancePolicy`、`activateGovernancePolicy` SDK 方法管理版本，保留原策略的其他字段和限制；参见 [Agent Governance](./agent-governance.md)。
3. 通过现有入口生成根 Agent，例如：

```text
uai agents generate --name taiji-operator --task "Operate reviewed local capabilities" --tool taiji_capability --tool taiji_inspect --ttl-seconds 3600 --yes
```

下面的 `agt_EXAMPLE` 必须替换为返回的真实 ID。CLI 沿用 `AGENT_CONSOLE_ADMIN_KEY` 等现有认证入口；操作 JSON 中不放凭据。源码工作区也可用 `node apps/agent-console/src/cli.js` 替代 `uai`。

当前状态后端是单进程签名 JSON，并复用治理存储的签名锚点及写前日志。开启此运行路径时，多实例模式或 PostgreSQL 治理部署配置会明确拒绝，不能把这一 profile 当作分布式实现。

## 一个完整任务

保存 `evaluate.json`：

```json
{
  "capabilityId": "facts",
  "expectedLifecycleRevision": 0,
  "profileId": "context-jsonl-v1",
  "request": "Preserve all supplied context facts and references"
}
```

```text
uai taiji evaluate --agent-id agt_EXAMPLE --input evaluate.json
uai taiji evaluate --agent-id agt_EXAMPLE --input evaluate.json --yes
uai agents approvals --agent-id agt_EXAMPLE
uai agents approve --approval-id apr_EXAMPLE --yes
uai taiji evaluate --agent-id agt_EXAMPLE --input evaluate.json --yes
uai taiji status --agent-id agt_EXAMPLE --json
```

第一个命令只显示待提交请求，不访问网关。`--yes` 提交一次请求；服务器仍可能返回审批。审批展示完整参数、目标版本、实现哈希、所有者及本次运行实例标识。更改参数、代码、选择结果或运行实例后，旧审批不能直接使用。

评估会实际运行固定校准用例。只有执行器确实运行、独立验证通过并且工作线程已回收，候选才成为 `evaluated`。检查返回的 `lifecycleRevision`，然后保存 `activate.json`；下面的版本号适用于刚创建的示例，实际操作以状态结果为准：

```json
{
  "capabilityId": "facts",
  "expectedLifecycleRevision": 1,
  "revision": 1,
  "limits": { "ttlSeconds": 300, "maxRequests": 3, "maxRuntimeMs": 30000 }
}
```

运行 `uai taiji activate --agent-id agt_EXAMPLE --input activate.json --yes`，审阅批准返回的审批，再提交相同命令。激活最多持续 300 秒，最多预留 3 次执行，并累计执行器实测耗时。失败、取消和不确定请求不自动退还已预留次数。重新激活需要新的审批；累计历史用量继续保留。

保存 `execute.json`：

```json
{
  "capabilityId": "facts",
  "expectedLifecycleRevision": 2,
  "revision": 1,
  "runId": "facts-run-001",
  "arguments": {
    "facts": [
      { "key": "approved", "value": false },
      { "key": "goal", "value": "保留事实", "reference": "doc:1" }
    ]
  }
}
```

```text
uai taiji execute --agent-id agt_EXAMPLE --input execute.json --yes
uai agents approvals --agent-id agt_EXAMPLE
uai agents approve --approval-id apr_EXAMPLE --yes
uai taiji execute --agent-id agt_EXAMPLE --input execute.json --yes
uai taiji run facts-run-001 --agent-id agt_EXAMPLE --json
```

回执包含候选/实现/参数/输入哈希、版本、激活实例、策略、审批、实际耗时、线程回收状态和产物字节哈希。重复提交同一运行 ID 不会再次执行；目标或输入不同则拒绝。最终成功既要求实际执行与验证，也要求证据提交及终态检查成功。

CLI 退出码：`0` 表示请求预览或已核验结果，`3` 表示待审批，`2` 表示输入错误，`1` 表示失败或需对账。必须同时检查 JSON 的 `status`；预览不是完成。

## 真实反馈、选择与修复

`reweight` 只接受当前所有者、同一候选版本的真实终态回执。成功将权重增加 `0.1`，上限 `0.8`；独立验证失败或已执行的超时将权重减少 `0.25`，下限 `0`。每个回执只应用一次权重变化。取消、未执行和未知结果不会充当质量反馈，达到边界而无变化时也不会声称更新。

```json
{
  "capabilityId": "risk",
  "expectedLifecycleRevision": 2,
  "revision": 1,
  "sourceRunId": "risk-failed-001"
}
```

用该文件执行 `uai taiji reweight --agent-id agt_EXAMPLE --input feedback.json --yes`，审阅并批准后再提交。权重低于 `0.2` 且有真实失败证据时，同样的文件可用于 `taiji prune`。裁剪会停用该版本并保留历史，不删除代码、数据或原失败。

权重进入实际选择：`execute` 可使用以下结构替代手工指定能力。服务器从相同 profile、相同所有者、已验证激活且有剩余容量的候选中，选择最高权重；相同权重按能力 ID 排序。审批中列出实际选择和候选快照。候选可用性或权重改变后，旧选择不能直接执行，也不会悄悄换用其他能力。

```json
{
  "selection": { "profileId": "risk-classification-v1" },
  "runId": "selected-risk-001",
  "arguments": { "text": "ship production", "expectedSignals": ["deploy_release"] }
}
```

`repair` 当前支持对风险分类中的漏报添加有界关键词，不移除既有规则，也不改变原失败期望。示例：原任务实际未识别 `ship production`，而原 `expectedSignals` 已要求 `deploy_release`：

```json
{
  "capabilityId": "risk",
  "expectedLifecycleRevision": 5,
  "revision": 1,
  "sourceRunId": "risk-failed-001",
  "sourceArguments": { "text": "ship production", "expectedSignals": ["deploy_release"] },
  "addRiskKeywords": { "deploy_release": ["ship production"] }
}
```

```text
uai taiji repair --agent-id agt_EXAMPLE --input repair.json --yes
```

完成单次审批后，服务器创建新版本，运行完整校准及**完全相同的原失败输入和期望**。每个失败最多三个不同修复候选；原版本、失败回执和失败修复尝试均保留。新候选通过后仍须单独批准激活，再以新运行 ID 执行原任务。其他 profile 的自动修复不在这个有限实现中；不能用更改断言、伪造反馈或提交任意代码绕过。

## 停用、读取与恢复

- `taiji revoke` 接受 `capabilityId`、当前 `expectedLifecycleRevision`、`revision` 和可选 `reason`。提交需 `--yes`；停止本人能力不再申请一个执行审批。撤销会中止该版本的进行中任务，旧版本不能重新激活。
- Agent 撤销、请求取消、超时或关停不能产生迟到成功。运行器等待工作线程退出；终态不确定时保存原声明并要求对账。
- 若回执已提交但响应丢失，先用 `taiji run <run-id>` 读取原结果。不要自动重试。若记录仍为 `running` 或 `unknown`，先确认进程状态并完成恢复；新尝试需要新的授权和运行 ID。
- `taiji status` 默认分别返回最多 10 个能力和运行摘要，可用 `--limit`、`--offset` 分页。列表不返回产物正文，历史事件显示最近 20 条并标明总数；原记录仍在签名存储中。单条 `taiji run` 返回完整、经过校验的产物。
- 读取接口使用当前企业身份、`workflow:run` 权限和创建者/租户/Agent 归属读取本人已保存的材料。它不会恢复已过期或撤销的 Agent，也不会借用其旧执行策略。新执行仍须通过当前 Agent 授权及单次审批。
- 网关重启后，未完成运行记为 `unknown`，旧激活暂停，需要重新审阅批准；累计用量及永久撤销状态不会清零。Agent 本身已过期或撤销时，可读取旧回执，新任务须使用有效且获授权的根 Agent 创建自己的候选。
- 状态容量有明确上限：100 个能力、每个最多 20 个版本、1000 个运行、8 MiB 总状态。满额会拒绝新增，不静默清理用户记录。

恢复应使用既有受保护的完整治理备份流程。不能单独用旧 `taiji-capabilities.json` 覆盖当前存储；其哈希与当前签名锚点不一致时会拒绝。整个治理信任根连同签名材料一起回滚，超出本地锚点的防回滚保证，不能据此宣称跨主机恢复或生产灾难恢复已验证。签名材料不得进入聊天、共享目录或普通证据文件。

## API 与 SDK

所有以下路径都使用既有企业认证和 `workflow:run` 权限；变更路径还需当前根 Agent 归属与治理检查。

| HTTP | SDK | 作用 |
| --- | --- | --- |
| `GET /taiji/capabilities?agentId=...&limit=...&offset=...` | `taijiCapabilities` | 有界状态与摘要 |
| `GET /taiji/capabilities/runs/:runId?agentId=...` | `taijiCapabilityRun` | 读取本人完整回执 |
| `POST /taiji/capabilities/evaluate` | `evaluateTaijiCapability` | 实际评估新候选 |
| `POST /taiji/capabilities/activate` | `activateTaijiCapability` | 批准后激活准确版本与预算 |
| `POST /taiji/capabilities/execute` | `executeTaijiCapability` | 指定或按已审选择执行 |
| `POST /taiji/capabilities/revoke` | `revokeTaijiCapability` | 停用准确版本 |
| `POST /taiji/capabilities/repair` | `repairTaijiCapability` | 用原失败验收增量修复候选 |
| `POST /taiji/capabilities/reweight` | `reweightTaijiCapability` | 基于真实反馈更新实际选择权重 |
| `POST /taiji/capabilities/prune` | `pruneTaijiCapability` | 有证据的软停用 |

SDK 拒绝重定向；变更错误不建议自动重试。`202` 表示待审批，`422` 表示已记录的任务失败，带 `TAIJI_OUTCOME_UNKNOWN` 的 `503` 要求读取状态对账。CLI 在请求前预览，服务器审批才绑定其解析后的候选、预算和选择。

## Language Selection 与回滚

工作负载是固定数据变换、候选状态、单次审批、准确版本调用及回执读取。新引擎、状态、路由和合同使用 TypeScript；既有 JavaScript factory、入口及 SDK 保持局部接线。

| 方案 | 领域 | 维护 | 运维 | 安全 | 迁移 | 生态 | 合计 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| TypeScript / Node | 5 | 5 | 5 | 5 | 5 | 5 | 30 |
| 全部使用 JavaScript | 5 | 4 | 5 | 3 | 5 | 5 | 27 |
| 另建 Go/Rust 服务 | 3 | 3 | 2 | 4 | 2 | 3 | 17 |

跨越引擎、状态、治理、HTTP、共享合同/SDK及 CLI，是使同一动作可审阅、可执行和可恢复的必要链。新增一个专用状态文件复用既有签名锚点；没有新增第三方依赖、数据库或常驻服务。固定工作线程是每次调用的短期执行资源，不是新的调度平台。

默认回退方式是关闭 `TAIJI_BEIDOU_AUTO_RUNTIME_ENABLED` 并重启，保留签名状态、审批及失败历史。程序回退仅针对入口、SDK 与 CLI 的接线提交；必须保留前置核心提交中的执行器、状态所有者注册、审批兼容读取及旧摘要修正。已写入新状态或审批后，不能回退到不认识这些记录的二进制，也不能删除锚点或记录来制造干净启动。`executeSandboxAutoRuntime` 现为异步且要求应用提供实际执行上下文；旧的预演输入会被拒绝。这一兼容性变化是修正错误成功声明所必需的。

验证覆盖实际线程/产物、原失败、变更审批、租户/创建者隔离、预算、取消、重复运行、响应丢失、版本恢复、真实反馈选择及增量修复。源文件与完整门禁结果必须绑定到最终候选；局部测试不等于全部产品、任意生成能力、分布式部署或生产证明。
