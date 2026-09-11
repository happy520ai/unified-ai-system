# 受控 Agent 长任务

这条路径把一次代码任务保存为一个原始任务 UUID：先准备完整输入，再提出计划，由操作者审批计划，最后按请求执行有限长度的运行片段。后续查询、暂停、取消和继续都使用同一个 UUID 与最新版本号。CLI、SDK 和 HTTP 接口均不自动循环到完成。

功能默认不启用。它使用现有 Agent Governance、网关 Provider、文件工具、独立 Git worktree 和只读容器验证；不改变普通 `/chat`、原生登录或默认 Provider 路由。源码、临时文件和验证输出不是发布、部署或生产就绪证据。

## 服务器配置

由服务器设置 `AI_GATEWAY_AGENT_LONG_TASK_CONFIG_JSON`。其 JSON 顶层必须恰好包含以下五个字段：

```json
{
  "profile": {
    "version": 1,
    "mode": "governed-agent-long-task",
    "profileId": "bounded-source-change",
    "projectId": "owned-project",
    "baselineRevision": "<40-hex-approved-commit>",
    "model": {
      "providerId": "local-fake-provider",
      "modelId": "local-fake-model",
      "maxInputTokens": 32768,
      "maxOutputTokens": 4096
    },
    "limits": {
      "maxPlanSteps": 6,
      "maxIterations": 8,
      "maxModelCalls": 9,
      "maxTotalTokens": 331776,
      "maxRepairAttempts": 2,
      "chunkTimeoutMs": 120000,
      "maxInputBytes": 131072
    },
    "verificationResult": {
      "version": 1,
      "adapter": "node-test",
      "minimumPassed": 1,
      "requiredChecks": [
        { "file": "test/value.test.mjs", "name": "actual value" }
      ]
    },
    "artifact": {
      "readPaths": ["src/value.mjs", "test/value.test.mjs"],
      "writePaths": ["src/value.mjs"],
      "verification": {
        "verificationId": "fixed-node-test",
        "command": "node --test 'test/value.test.mjs'",
        "immutableTests": [
          { "path": "test/value.test.mjs", "sha256": "<64-hex-exact-test-file-digest>" }
        ],
        "image": "node@sha256:<64-hex-pinned-image-digest>",
        "workspaceMode": "ro",
        "networkAccess": false,
        "timeoutMs": 15000,
        "maxMemoryMB": 128,
        "maxOutputBytes": 65536,
        "pidsLimit": 32,
        "cpus": 1
      },
      "artifactLimits": {
        "maxChangedFiles": 1,
        "maxFileBytes": 65536,
        "maxDiffBytes": 262144
      }
    }
  },
  "repoRoot": "E:/approved-project",
  "worktreeRoot": "E:/approved-task-worktrees",
  "scratchRoot": "E:/approved-task-scratch",
  "enginePath": "<absolute-container-engine-path>"
}
```

此示例含占位符，必须替换为审查过的仓库提交、不可变测试文件摘要、已固定的容器镜像摘要和实际绝对路径。`profile` 是原始配置；不要在配置中手填 `profileHash`，服务器校验后生成它。一个运行时仅使用这一份服务器配置，HTTP 请求不能选择或覆盖 profile、模型、仓库路径、镜像、命令或工具权限。

受治理长任务必须明确给出 `verificationResult`。当前仅支持 `adapter:"node-test"`：`minimumPassed` 为 1–10000 的整数，`requiredChecks` 包含 1–64 个不重复的 `(file,name)`；名称保留原样，长度 1–256，不能含凭据或控制字符。所有 `file` 都必须来自不可变测试清单，并且每个不可变测试文件至少对应一个必需检查。该契约随 profile 和完整 review 一起计算哈希，不能在旧批准下更换。

配置阶段还会计算完整验证结果所需的最低输出字节数，包括认证回执、必需具名检查的诊断记录和摘要空间。`maxOutputBytes` 必须容纳这些内容，否则在任何 Provider 调用或快照创建前拒绝配置。名称数量与字符数合法不表示 UTF-8 输出一定放得下；64 个很长的中文名称可能超过 65536 字节上限。不能截断回执、遗漏必需检查或猜测测试数量来继续执行。

`artifact.verification.command` 必须是规范显示形式：`node --test` 后按不可变测试路径排序，为每条路径加 POSIX 单引号；路径中的单引号按 POSIX 规则转义。不接受未加引号的替代形式、筛选参数或追加 shell 命令。这个字符串描述被审查的固定调用；服务器适配器根据不可变文件清单调用 Node 测试运行器，不把它当作任意 shell 输入执行。

旧 Workforce 的固定脚本、构建验证 profile 保持原语义。受治理长任务不能把普通脚本退出码为 0 或打印“完成”作为测试完成证明；需要构建或其他固定检查时，可在经审查且不可修改的 Node 测试中执行固定检查并断言结果，再把该真实测试名称列入 `requiredChecks`。尚未发布的早期受治理长任务配置如果缺少新契约，会明确拒绝；不会补默认值或悄悄迁移批准、历史和预算。

配置要求本地主机、内存中的执行 claim 和签名持久队列；不支持多实例或分布式 claim 模式。现有 Agent 必须处于有效状态，具备批准路径所需的文件读写和独立快照验证权限。实际使用真实 Provider 仍需要明确、限定的授权。

## HTTP 与 SDK

下表中的 `<agentId>` 是原始 Agent ID，`<taskId>` 是准备步骤返回的原始 UUID。所有请求都使用现有受限网关身份。

| HTTP | 请求体 | SDK 方法 |
| --- | --- | --- |
| `POST /v1/agents/<agentId>/tasks` | `{goal, prompt}` | `prepareGovernedAgentTask(agentId, body)` |
| `GET /v1/agents/<agentId>/tasks/<taskId>` | 无 | `governedAgentTask(agentId, taskId)` |
| `POST …/<taskId>/plan` | `{revision}` | `planGovernedAgentTask(agentId, taskId, body)` |
| `POST …/<taskId>/confirm` | `{revision, reviewHash, planHash, approvalId}` | `confirmGovernedAgentTask(agentId, taskId, body)` |
| `POST …/<taskId>/run` | `{revision, maxIterations?}` | `runGovernedAgentTask(agentId, taskId, body)` |
| `POST …/<taskId>/pause` | `{revision}` | `pauseGovernedAgentTask(agentId, taskId, body)` |
| `POST …/<taskId>/cancel` | `{revision}` | `cancelGovernedAgentTask(agentId, taskId, body)` |

`revision` 必须来自任务当前响应；初始版本可以是 `0`。每次 `run` 默认最多执行 4 次迭代，客户端接受 1–10 的显式片段上限，同时仍受原 profile 的总迭代、模型调用、Token 和修复次数限制。SDK 的 `plan` 和 `run` 沿用现有 Provider-Dispatch-Key 请求头机制；该值不会进入任务 JSON，且不是 Provider 凭据。可用 SDK 的 `providerDispatchKey` 选项绑定一个已有请求，但不能据此假设未知结果可以重试。七个新接口都拒绝 HTTP 重定向，不转发原任务材料或自动重试。

```ts
import { createGatewayClient } from "@unified-ai-system/shared-sdk";

const client = createGatewayClient({
  baseUrl: gatewayUrl,
  headers: scopedGatewayHeaders,
  timeoutMs: 150000,
});

// taskId 和 revision 来自先前响应，继续原任务。
const status = await client.governedAgentTask(agentId, taskId);
const chunk = await client.runGovernedAgentTask(agentId, taskId, {
  revision: status.data.revision,
  maxIterations: 2,
});
// 到此停止。展示 chunk，再由操作者明确选择下一次动作。
```

## CLI 操作

沿用现有 `agents` 命令与 `AGENT_CONSOLE_ADMIN_KEY` 身份入口。请求内容从 `--input` JSON 文件读取；配置和凭据文件不能作为输入。现有读取器限制输入文件为 1 MiB、单个字符串为 256 KiB；超限会明确失败，不截断输入。所有改变任务状态的命令都使用现有显式 `--yes` 约定。

准备文件 `prepare.json`：

```json
{
  "goal": "修复已批准源文件中的计算错误",
  "prompt": "这里保留完整原始请求。\n只修改已批准的源文件，按固定测试验证。"
}
```

```powershell
pnpm gateway agents task prepare --agent-id agt_<id> --input prepare.json --yes
pnpm gateway agents task status <original-task-uuid> --agent-id agt_<id> --json
```

准备响应完整展示 profile、目标、原提示词、源文件内容和哈希。保存返回的 UUID，然后把当前版本写入 `revision.json`：

```json
{ "revision": 0 }
```

```powershell
pnpm gateway agents task plan <original-task-uuid> --agent-id agt_<id> --input revision.json --yes
pnpm gateway agents approvals --agent-id agt_<id>
```

计划包含按顺序排列的 `inspect`、`implement`、`verify` 步骤。CLI 对完整 review、profile、plan 和源文件重新核对内容哈希；JSON 与普通输出都保留完整计划和原提示词，不经过旧摘要显示上限。哈希检查只验证材料一致性，不产生执行权限。

操作者审查完整材料后，使用已有审批入口：

```powershell
pnpm gateway agents approve --approval-id <returned-approval-id> --yes
```

将当前任务响应中的版本号、两个哈希和批准 ID 原样写入 `confirmation.json`：

```json
{
  "revision": 3,
  "reviewHash": "sha256:<exact-returned-review-hash>",
  "planHash": "sha256:<exact-returned-plan-hash>",
  "approvalId": "<returned-approval-id>"
}
```

示例版本号 `3` 仅用于说明；必须使用本次任务实际返回值。

```powershell
pnpm gateway agents task confirm <original-task-uuid> --agent-id agt_<id> --input confirmation.json --yes
```

`confirm` 只消费已经获准的完整原计划，不自动批准。然后使用最新版本建立 `chunk.json`：

```json
{ "revision": 5, "maxIterations": 2 }
```

```powershell
pnpm gateway agents task run <original-task-uuid> --agent-id agt_<id> --input chunk.json --yes
pnpm gateway agents task status <original-task-uuid> --agent-id agt_<id> --json
```

`plan`、`run` 在提交前读取一次当前任务，核对版本与固定 Provider；非 `local-fake-provider` 请求还必须显式提供 `--allow-real-provider`。这个开关只授权使用已审查的服务器模型，不允许选择另一个模型。成功返回 `paused` 表示这个片段结束，并不等于任务完成。只有再次明确调用 `run` 才会继续原任务。

暂停和取消也使用最新的 `{ "revision": n }` 文件：

```powershell
pnpm gateway agents task pause <original-task-uuid> --agent-id agt_<id> --input revision.json --yes
pnpm gateway agents task cancel <original-task-uuid> --agent-id agt_<id> --input revision.json --yes
```

暂停请求可能先显示 `controlRequested`，等待当前片段进入安全边界。超时、取消或未知结果后应查询原 UUID；不得自动新建替代任务来重放操作。

## 页面消费与证据含义

界面应显示原始 `taskId`、`agentRunId`、`revision`、`phase` 和 `controlRequested`，并直接使用服务器的 `resumable` 与 `recovery` 提示。不得把按钮点击、HTTP 成功、模型回答或检查点存在推断为任务完成。

当 `phase` 为 `paused`，同时 `resumable:false`、`workspaceReconciliationRequired:true` 时，应提示“对原任务显式运行，先核验并恢复原工作区”。这不是新建任务或重新规划的入口；CLI 的 `run` 仍可按原 UUID 和当前版本请求这项核验。状态查询与服务启动都不会自动发送运行请求。

| 响应字段 | 应表达的含义 |
| --- | --- |
| `review`、`sourceFiles`、`plan` | 完整原始意图、批准范围、不可变测试与计划；确认页面不可截断或替换 |
| `approvalId`、`confirmedApprovalId` | 待决定批准与已经消费的原批准；两者不是自动授权 |
| `counters` | 持久累计的迭代、模型调用、预留 Token、修复次数 |
| `modelReceipts` | 网关 Provider 操作回执；缺少报告的 usage 保留 `null` |
| `stepReceipts` | 完整读取或文件操作的观察回执；`changed:false` 表示无内容变化，不是测试通过 |
| `verificationAttempts` | 独立固定测试的历次结果及 `checkResult` 执行判定，包含第一次失败；后续通过不得覆盖首次失败 |
| `workspaceReceipt`、`sourceFilesHash` | 当前任务的工作区记录与现场文件摘要，不是重新创建所有权的凭证 |
| `finalAnswer` | 模型最终说明；不能替代差异和验证回执 |

每次模型请求先按 `maxInputTokens + maxOutputTokens` 保守预留原任务预算。预留数不是服务商实际扣费数；没有上游 usage 时，不能显示为零消耗，也不能据估算声明实际节省。文件工具仅限当前计划步骤和批准路径；读完文件与写出候选修改分开记录。固定测试只在由批准文件形成的不可变快照中运行，挂载只读且禁网。

受治理长任务的每次验证还必须返回结构化 `checkResult`：契约与运行器哈希、快照哈希、`verdict`、原因、测试计数、`executedPassed` 和每个必需具名检查的状态。只有实际执行且通过的叶子测试计入门槛；单纯文件进程成功、普通输出或模型完成文本不能充当检查结果。所有必需检查都通过、实际通过数达到门槛、没有失败或取消，并满足快照一致性、正常退出和清理要求，才允许完成任务。

零个实际检查、全部跳过、只有 TODO、缺少必需检查、重复或含糊的必需检查结果，以及不完整报告都不能成功。日志中自行打印类似 TAP 或 JSON 的“通过”内容不能代替运行器产生的结构化回执。全跳过可能仍返回真实 `exitCode:0`，此时 `checkResult.verdict` 必须为 `failed`；保留这个 0、原始输出和首次失败原因，不能伪造非零退出码。CLI 会拒绝没有该判定或与已审批契约不符的完成状态。

验证监督器通过一次运行专用的管道接收临时认证材料；该材料不放进命令行、环境变量、持久状态或模型上下文，测试子进程不继承这项权限。主机核验认证回执后移除传输认证帧，普通 stdout/stderr 只作为诊断文本。这个边界证明结果来自固定运行器，不能扩大为“业务语义完全正确”或生产质量保证：验证结论仍限于已审批且实际执行的必需检查。

签名队列在 claim、保存和重新加载时检查完整性；修改 JSON 后仅重算普通内容哈希不能恢复权限或预算。它仍是单写者、本地主机设计，不能把签名完整性宣传为整个数据目录的防回滚能力。进程重启后，服务不会自动执行任务。对暂停的原任务显式调用 `run` 时，服务器先进行只读恢复检查；它不新建 worktree、不重新规划，也不重置任何计数。

恢复前后都必须重新核验当前签名队列、当前任务 claim、当前 Agent、已消费的完整原批准和稳定的 continuation 哈希。v2 工作区回执以十进制 BigInt 字符串保存仓库目录、worktree 根目录、原 worktree 目录及其 `.git` 文件的设备和文件身份。恢复还比对 Git 注册、分支、批准基线、完整当前文件哈希、成对且无待执行操作的检查点、累计 usage 与限制、步骤回执和首次失败测试历史。所有检查一致后才恢复原工作区所有权，并允许这次显式请求继续有限片段。

普通 JSON 回执本身不能恢复权限。目录身份、配置、策略、源文件或历史发生变化，以及可信恢复回调结果不确定时，任务不能继续；这些情况不得通过替换 UUID、复制工作树文件、删除历史或重新计数来绕过。`workspaceReconciliationRequired` 是待核验提示，不是核验通过的声明。

运行器实现哈希也是恢复条件。代码更新使运行器哈希改变后，旧检查回执不能自动按新运行器规则恢复；保留旧历史并明确停止，不重新签名旧结果或用新结果覆盖首次失败。

## 验证层级

SDK/CLI 测试使用本地模拟 HTTP 服务，证明路由、原 ID 与版本传递、完整显示、输入拒绝、重定向拒绝和不自动重试。工作区单元测试使用真实临时 Git 与文件，但模拟容器结果；这些测试不证明真实 Provider 或真实容器已经运行。

```powershell
node --test packages/shared-sdk/src/index.test.js apps/agent-console/src/agentTaskCommands.test.ts
pnpm exec vitest run apps/ai-gateway-service/src/agentic/governedAgentTaskWorkspace.test.ts apps/ai-gateway-service/src/workforce/workforceCodeDeliveryRuntime.test.ts --maxWorkers=1
```

`governedAgentTaskWorkspace.local.test.ts` 是单独的真实容器专项，需明确配置 `AI_GATEWAY_CODE_DELIVERY_CONTAINER_TEST=1`、`AI_GATEWAY_CODE_DELIVERY_TEST_ENGINE` 和 `AI_GATEWAY_CODE_DELIVERY_TEST_IMAGE`，使用已固定镜像。它不调用真实 Provider。未执行时应报告“未执行”，不能用其文件存在或跳过结果作为通过证据。真实 Provider、完整 HTTP 流程、全仓门禁、托管 CI 和生产验证须分别记录实际执行结果；本文不声明这些层级已经通过。

v2 恢复的单元与运行时集成通过，只能证明这些测试中的恢复检查和原任务延续。真正的跨进程恢复还需要记录两个独立进程的配对见证：第一进程保存暂停状态并退出，第二进程校验同一原任务、原工作区与累计预算后继续。单侧进程成功、等待超时或未完成的配对都不能写成跨进程通过；本文不预先声明该见证已经完成。

## Language Selection

- **Workload:** 在现有 Agent 治理与网关中实现有界长任务；为现有 CLI、SDK 和页面消费者暴露同一个原任务的生命周期。
- **Primary path:** `apps/ai-gateway-service/src/agentic/governedAgentTask*.ts`、对应 HTTP 路由及 `src/workforce/workforceNodeTestVerification.ts`；`packages/forge-core/src/sandbox-executor/container-backend.js`；`apps/agent-console/src/agentTaskCommands.ts`；`packages/shared-sdk/src/index.ts` 与已有 `index.js`；已有 CLI 入口 `cli-core.js`。
- **Alternative A — 全部 TypeScript:** 新运行时和新 CLI 模块的类型边界、状态与回执最适合 TypeScript。把 SDK 已有 JS 入口和整个 CLI 同时迁移会扩大兼容与构建范围。
- **Alternative B — 全部 Node.js ESM JavaScript:** 与旧入口兼容，但新任务状态、确认参数及验证结果失去直接类型检查。
- **Chosen language:** 新应用运行时、状态适配、验证契约与结果核验、CLI 模块使用 TypeScript；SDK 类型继续在 TypeScript 声明，现有 ESM JS 入口只追加必要方法与薄分发。固定 Node ESM 监督器直接运行在既有只读禁网容器内，不增加编译步骤；已有 JavaScript 容器后端仅增加可选标准输入管道，传送一次运行的认证材料。继续使用已有 Node 运行时，没有引入新运行时语言、服务或依赖。

| 选择 | Domain fit | Maintenance | Operability | Safety | Migration debt | Ecosystem fit | 合计 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 新逻辑 TypeScript，已有入口保留 ESM JS | 5 | 5 | 5 | 5 | 5 | 5 | 30 |
| 连同全部旧入口立即迁移 TypeScript | 5 | 3 | 4 | 5 | 2 | 5 | 24 |
| 新逻辑全部 ESM JavaScript | 4 | 3 | 5 | 3 | 5 | 5 | 25 |

- **Compatibility/rollback boundary:** 新任务端点与七个 SDK 方法是增量能力；普通 Agent 命令、默认工具备份行为、旧 Workforce profile 和未提供标准输入的后端调用保留。受治理长任务的必填验证结果契约产生新的 profile 与审批哈希，缺少契约的未发布早期配置明确拒绝，不在旧批准下补值。当前运行器哈希不匹配时，旧检查回执也不能恢复，不自动迁移、重新签名或重放。删除服务器启用配置可停止新任务入口。回退代码前必须等待运行片段停稳，保留签名队列、原批准、worktree 和失败回执，不删除或重置旧状态来伪造可重试条件。新版本保存的任务不由旧代码自动消费。
- **Policy impact:** 默认仍使用 fake Provider；真实调用有单独授权。模型不能改变 profile、工具权限、路径、不可变测试或发布边界。新 SDK 方法仅发送受限请求，拒绝重定向；CLI 不自动审批或循环执行。
- **Quantified risk mitigation:** SDK/CLI 精确路由和请求体测试、完整材料超过旧显示上限的测试、未知 usage 为 `null` 的测试、错误 ID/版本/覆盖字段/重复 JSON 拒绝测试，以及工作区、签名恢复、首次失败和容器异常边界测试分别提供证据。发布前仍必须按仓库要求执行 `pnpm check`、`pnpm test`、`pnpm check:public`、`pnpm verify:public-clone`，不能以局部测试替代。

语言选择依据见 [Language Selection Playbook](language-selection-playbook.md)。
