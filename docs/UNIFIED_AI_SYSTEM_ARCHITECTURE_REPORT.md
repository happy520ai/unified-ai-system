# Unified AI System Architecture Report

# 1. 架构执行摘要

当前 `unified-ai-system` 是本地 AI Gateway + Personal Operator Console + Knowledge/RAG 自用层 + Codex handoff/review/desktop automation 的组合系统。它面向单机本地/内部自用，核心目标是让用户能从一个本地 Web Console 看到项目状态、查询项目知识、生成下一步任务、交接给 Codex Desktop、导入结果、审查结果和沉淀 evidence。

当前核心架构由这些层组成：

- User / Operator Layer: 用户、Personal Operator Console、Action Queue、Decision Dashboard、Auto Loop Status Panel。
- UI Layer: `consolePage.js` 生成 `/ui`，承载中文入口、状态展示、任务生成展示、Knowledge/RAG 和 Agent Workforce Preview 面板。
- AI Gateway Service Layer: HTTP server、`/health/check`、`/chat`、`/setup/readiness`、knowledge APIs、workforce APIs、provider registry。
- Agent Workforce / Planning Layer: 多角色 deterministic-plan-preview，clarify/consensus/review package/approval preview/save/history/export。
- Knowledge/RAG Self-use Layer: source inventory、query templates、citation、freshness guard、maintenance loop、本地 keyword/SQLite/file preview。
- Codex Handoff Layer: outbox、inbox、review、feedback、result intake contract。
- Controlled Codex Desktop Automation Layer: status、dry-run、copy-only、paste-only、send-with-approval、ingest、review、go/no-go、internal tests、system audit。
- Evidence / Verification Layer: phase evidence、verifier scripts、secret safety、user journey、health/doctor/check、desktop automation audit。
- Provider / Model Layer: 默认 NVIDIA `/chat` baseline，future OpenAI-compatible/MiMo path，但本轮不改变默认 NVIDIA 主链。

当前最重要的工程边界：

- no real Codex exec。
- no codex CLI。
- no workflow runner。
- no worktree creation。
- no auto commit/push。
- not unattended development。
- no production vector RAG。
- no GraphRAG。
- approval-preview is not execution permission。
- send-with-approval 只是发送任务到 Codex Desktop UI，不代表执行完成，不代表允许 commit/push。
- workspace 当前 dirty，不能声称 clean。

当前架构已经稳定的部分：

- 本地 service startup/status/health/check。
- `/ui` 本地 Web Console 入口。
- Personal Operator Console 文档和 UI baseline。
- Agent Workforce deterministic preview plan/save/history/export。
- Knowledge/RAG self-use docs/query/citation/freshness baseline。
- Codex handoff outbox/inbox/review/feedback 文件桥。
- Codex Desktop Automation status/internal tests/audit/ready-state-reset。
- phase evidence + verifier scripts 作为 completion proof 的工程习惯。

当前架构还没有完成的部分：

- 生产级 SaaS。
- 多用户/多租户权限。
- 企业密钥保险箱。
- 生产级 vector RAG/GraphRAG。
- workflow runner。
- controlled worktree execution。
- real Codex exec。
- codex CLI execution。
- 自动 commit/push/PR/release。
- 自动应用外部 patch。
- public/cloud production deployment。

必须明确：当前系统不是生产级 SaaS，不是无人值守自动开发系统，不是自动 commit/push/PR/release 系统。

# 2. 仓库整体结构

## apps/ai-gateway-service

当前职责：

- 主本地 HTTP 服务。
- 提供 `/ui`、`/health/check`、`/setup/readiness`、`/chat`、`/chat/rag`、knowledge、workflow、workforce、route 等接口。
- 包含 provider registry、NVIDIA/OpenAI/http-llm adapters、knowledge service、workforce planner/store/service、UI 生成、verifier entrypoints、evidence。
- 包含 Codex Desktop Automation entrypoints: status/send/ingest/review/loop/internal tests/audit/reset。

是否属于主运行链路：是，是当前本地服务主链。

是否只做文档/evidence：否，既有运行代码也有 evidence/verifier。

是否只做历史参考：否。

当前能不能修改：可以在明确任务范围内修改；本轮只新增报告/verifier，不新增业务功能。

## apps/agent-console

当前职责：

- 上层 agent console app package。
- 现有 check 脚本验证 service chain、error handling、streaming chain、knowledge service chain 等入口。

是否属于主运行链路：属于上层 interaction/console 方向，但当前 `/ui` 主要由 `apps/ai-gateway-service` 提供。

是否只做文档/evidence：否，有 app 代码和 evidence。

是否只做历史参考：否。

当前能不能修改：可以在明确 app/agent-console 任务范围内修改；本轮未修改。

## packages/shared-contracts

当前职责：

- 公共协议类型。
- 包含 common、gateway、provider、routing、governance、knowledge、modelImport、setup、workflow、workforce contracts。
- `workforce.ts` 包含 Agent Workforce preview fields、review package、approval gate、handoff、execution readiness、runner protocol preview 等类型面。

是否属于主运行链路：是，属于 public protocol/types layer。

是否只做文档/evidence：否。

是否只做历史参考：否。

当前能不能修改：可以在协议变更任务内修改；本轮未修改。

## packages/shared-sdk

当前职责：

- 共享 client/SDK surfaces。
- 连接 service endpoints、contracts 和调用面。

是否属于主运行链路：是，属于客户端/adapter surface。

是否只做文档/evidence：否。

是否只做历史参考：否。

当前能不能修改：可以在 SDK/API 任务内修改；本轮未修改。

## packages/shared-config

当前职责：

- 共享配置 contracts/defaults。
- 包含 provider defaults、NVIDIA baseline、OpenAI-compatible/http-llm 配置路径、runtime config。

是否属于主运行链路：是，配置层直接影响 service/provider behavior。

是否只做文档/evidence：否。

是否只做历史参考：否。

当前能不能修改：可以在配置任务内修改；必须避免未经授权改变默认 NVIDIA `/chat` 主链。本轮未修改。

## packages/shared-utils

当前职责：

- 实现中立的共享工具函数。

是否属于主运行链路：间接属于。

是否只做文档/evidence：否。

是否只做历史参考：否。

当前能不能修改：可以在工具层任务内修改；本轮未修改。

## docs

当前职责：

- 项目边界、用户手册、Personal Operator、Knowledge/RAG、Codex readiness、desktop automation、商业报告、readthrough report 等文档。
- 本轮新增 project readthrough/future report 和 architecture report。

是否属于主运行链路：不是 runtime 主链，但属于 verification/documentation 主链。

是否只做文档/evidence：主要是文档。

是否只做历史参考：否，很多 docs 是当前边界和操作事实来源。

当前能不能修改：可以在文档任务内修改；必须保守、可复核、不夸大。

## tools

当前职责：

- 根命令 helper。
- 包含 managed dev、health/help、agent-workforce handoff/import/loop PowerShell 工具等。

是否属于主运行链路：部分属于本地运行/自动化辅助链路。

是否只做文档/evidence：否，有命令脚本。

是否只做历史参考：否。

当前能不能修改：可以在工具任务内修改；本轮未修改。

## .codex-handoff

当前职责：

- 本地 Codex handoff/review/feedback/runs 文件桥。
- 保存 outbox task、inbox result、review、feedback、run summaries、internal mock tests、audit、ready-state-reset。

是否属于主运行链路：属于 Codex handoff/review/desktop automation 主链，但不是业务 service runtime。

是否只做文档/evidence：主要是 handoff/evidence/run state 文件。

是否只做历史参考：否，latest 文件影响 status；但其中部分文件如 Round 3 mock no-go 是历史 mock，需要 Ready State Reset 解释。

当前能不能修改：可以由 handoff/ingest/review/reset/audit 命令生成或人工按规则维护；不能把 mock/internal test 写成真实执行。

## apps/ai-gateway-service/evidence

当前职责：

- phase machine-readable evidence JSON/Markdown。
- 记录 verifier 状态、checked/generated time、safety fields、checks、conclusion。

是否属于主运行链路：属于 verification/evidence layer，不是业务 runtime。

是否只做文档/evidence：是。

是否只做历史参考：既有历史证据，也有最新事实证据。必须按 phase、timestamp、status、closure docs 解释。

当前能不能修改：可以由 verifier 生成或本轮报告 evidence 新增；不能伪造通过，不能写 API key。

## legacy/

当前职责：

- 历史参考和边界参考。
- 包含 `legacy/claudcodesrc-ponponon-master` 和 `legacy/ai-gateway-workspace`。

是否属于主运行链路：否。

是否只做文档/evidence：否，是历史代码参考。

是否只做历史参考：是。

当前能不能修改：不能。本轮不得修改 `legacy/`。legacy/ 不属于当前执行主链，不应作为当前实现能力。

# 3. 当前系统分层架构

## 3.1 User / Operator Layer

组成：

- 用户打开 `/ui`。
- Personal Operator Console。
- Action Queue。
- Decision Dashboard。
- Auto Loop Status Panel。

职责：

- 判断当前系统是否 ready。
- 查看 workspace/evidence/blocker。
- 生成下一条可审查 task。
- 查看 Codex Desktop automation 状态。
- 决定继续、停止、重置、导入结果或生成反馈。

边界：

- 用户层做决策，不自动授予执行权限。
- approval-preview is not execution permission。

## 3.2 UI Layer

组成：

- `apps/ai-gateway-service/src/ui/consolePage.js`
- `/ui` 页面。
- 中文化入口。
- 状态展示。
- 任务生成展示。

职责：

- 呈现 chat、Knowledge/RAG、Agent Workforce、Personal Operator Console、Auto Loop Status、Controlled Codex Desktop Automation。
- 展示 preview-only、安全边界、executionEnabled=false、codexExecInvoked=false 等状态。

边界：

- UI 面板不等于真实执行。
- UI 中的 readiness/go-no-go 不等于执行授权。

## 3.3 AI Gateway Service Layer

组成：

- HTTP server: `apps/ai-gateway-service/src/http/httpServer.js`
- Application wiring: `createGatewayApplication.js`
- `/health/check`
- `/chat`
- `/chat/rag`
- `/setup/readiness`
- `/workforce/*`
- `/knowledge/*`

职责：

- 本地服务入口。
- provider registry 和 chat 路由。
- knowledge load/retrieve/RAG chat。
- workforce plan/save/history/export/review package/approval gate。
- UI page serving。

边界：

- 默认 NVIDIA `/chat` 主链不改变。
- service 不调用 codex CLI，不运行 real Codex exec。

## 3.4 Agent Workforce / Planning Layer

组成：

- `apps/ai-gateway-service/src/workforce/workforcePlanner.js`
- `apps/ai-gateway-service/src/workforce/workforceService.js`
- `apps/ai-gateway-service/src/workforce/workforcePlanStore.js`
- `packages/shared-contracts/src/contracts/workforce.ts`

职责：

- 多角色任务规划。
- clarify questions。
- role tiers。
- consensus preview。
- review package。
- approval gate preview。
- plan state/HUD。
- save/history/export。
- Codex handoff package。

当前状态：

- deterministic-plan-preview。
- preview-only。
- 不真实执行 Agent。
- 不执行代码。
- 不创建 worktree。
- 不接 workflow runner。

## 3.5 Knowledge/RAG Self-use Layer

组成：

- source inventory。
- starter pack。
- query templates。
- citation report。
- freshness guard。
- UI guide。
- live trial。
- maintenance loop。
- operator manual。
- local knowledge service / SQLite/file persistence。

职责：

- 从 docs/evidence/handoff 等项目资料回答当前状态、blocker、下一步任务。
- 提供引用和 freshness guard。

当前状态：

- local/self-use preview。
- local keyword retrieval、source load/list、RAG chat、citation/highlight、file/SQLite persistence。

边界：

- 非生产级 vector RAG。
- no production vector RAG。
- no GraphRAG。
- no enterprise ACL sync。
- no multi-tenant knowledge base。

## 3.6 Codex Handoff Layer

组成：

- outbox。
- inbox。
- review。
- feedback。
- result intake contract。

职责：

- 把 Action Queue 的 task 写入 outbox。
- 接收 Codex/人工 result 到 inbox。
- review result 并生成 go/no-go。
- feedback-to-Codex 形成下一轮输入。

边界：

- 文件桥不自动 apply patch。
- 文件桥不自动 commit/push。
- inbox result 不等于 passed。

## 3.7 Controlled Codex Desktop Automation Layer

组成：

- `codex:desktop:status`
- `codex:desktop:send`
- `codex:desktop:ingest`
- `codex:desktop:review`
- `codex:desktop:loop`
- `codex:desktop:test:internal`
- `verify:codex-desktop-automation-system-audit`

职责：

- status: 只读状态。
- dry-run: 只检查 outbox 和安全字段。
- copy-only: 复制 task。
- paste-only: 粘贴到 Codex Desktop 但不发送。
- send-with-approval: 显式确认后发送到 Codex Desktop UI。
- ingest: 导入 result。
- review: 生成 go/no-go 和 feedback。
- internal tests: 本地 mock 测试。
- system audit: 检查闭环和安全边界。

边界：

- send-with-approval 不等于 commit/push 许可。
- send-with-approval 不等于 execution completed。
- internal tests 是 mock/internal test，不是真实 Codex 执行。

## 3.8 Evidence / Verification Layer

组成：

- phase evidence JSON/Markdown。
- verifier entrypoints。
- secret safety。
- user journey。
- health/doctor/check。
- desktop automation audit。
- project readthrough/future report evidence。
- architecture report evidence。

职责：

- 把完成状态变成 machine-readable proof。
- 检查关键文档章节、边界、safety fields、scripts、UI markers、no secrets。

边界：

- verifier passed 不等于生产 readiness，除非 phase 明确。
- stale evidence 不能覆盖本轮真实命令结果。

## 3.9 Provider / Model Layer

组成：

- 默认 NVIDIA `/chat` baseline。
- OpenAI adapter。
- HTTP LLM/OpenAI-compatible adapter。
- MiMo Token Plan future smoke path。
- runtime credential store。

职责：

- 提供 chat provider adapters。
- 支持 runtime credential/provider discovery。
- 支持未来 provider smoke。

边界：

- 本轮不改变默认 NVIDIA `/chat` 主链。
- provider smoke 不能记录 plaintext API keys。
- MiMo/OpenAI-compatible 仍是 future smoke/adaptation path。

# 4. 核心运行链路图

## 4.1 普通 UI 使用链路

```text
User
  -> /ui
  -> Personal Operator Console
  -> Decision Dashboard
  -> Action Queue
  -> Review & Evidence Loop
```

解释：

- 用户先打开 `/ui`，从 Personal Operator Console 看当前状态。
- Decision Dashboard 用 evidence、dirty workspace、blocker 和 boundary 判断下一步。
- Action Queue 把下一步变成可交接 task。
- Review & Evidence Loop 防止未经验证的结果进入完成状态。

## 4.2 Agent Workforce planning 链路

```text
User goal
  -> Agent Workforce Preview
  -> clarify / role tiers / consensus / review package
  -> save / history / export
  -> Codex handoff package
  -> manual review
```

明确边界：

- 不执行代码。
- 不创建 worktree。
- 不接 workflow runner。
- 不真实执行 Agent。
- approval-preview 只是 review metadata，不是 execution permission。

## 4.3 Knowledge/RAG 查询链路

```text
Project docs / evidence
  -> Knowledge source inventory
  -> query templates
  -> citation / freshness
  -> answer current state / blocker / next task
```

明确边界：

- 当前不是生产级 vector RAG。
- 当前不是 GraphRAG。
- 当前是 local/self-use preview。
- 需要 citation 和 freshness guard 才能避免 stale evidence 误判。

## 4.4 Codex Desktop Automation 链路

```text
Action Queue
  -> outbox latest-codex-task
  -> desktop send dry-run / copy-only / paste-only / send-with-approval
  -> Codex Desktop UI
  -> user/Codex result
  -> inbox
  -> review
  -> go/no-go
  -> feedback
  -> next action
```

明确边界：

- send-with-approval 只是发送任务到 Codex Desktop UI。
- send-with-approval 不等于允许 commit/push。
- send-with-approval 不等于 execution completed。
- 真实结果必须进入 inbox/review/go-no-go。
- 本轮没有真实发送 Codex。

# 5. 数据与文件流

## .codex-handoff/outbox/latest-codex-task.md

- 谁生成：Action Queue/handoff next task 逻辑或人工生成。
- 什么时候生成：当用户决定下一条 Codex handoff task 时。
- 谁读取：desktop send、人工复制、status、review 上下文。
- 是否允许人工修改：允许，但必须保留边界、scope、verification、evidence expectation。
- 是否代表真实执行：否。
- 是否只是 mock/internal test：当前 latest task 不是 internal run result；它是 manual handoff task。

## .codex-handoff/outbox/latest-codex-task.json

- 谁生成：handoff next task/Action Queue。
- 什么时候生成：与 latest task markdown 同步生成。
- 谁读取：codex desktop status/send/review preflight。
- 是否允许人工修改：谨慎允许；不得把 `executionEnabled`、`codexExecInvoked` 等安全字段改为 true。
- 是否代表真实执行：否。
- 是否只是 mock/internal test：否，是 task metadata；但不是 execution result。

## .codex-handoff/inbox/latest-codex-result.md

- 谁生成：codex desktop ingest，或 internal test fixture 写入。
- 什么时候生成：收到 Codex/人工 result 或运行 internal mock tests 后。
- 谁读取：review、status、audit。
- 是否允许人工修改：允许作为手动 result intake，但必须标明来源和边界。
- 是否代表真实执行：当前不代表。本轮读取到的是 Round 3 Mock Codex Result。
- 是否只是 mock/internal test：当前 latest 内容是 mock/internal test 历史产物，被 Ready State Reset 归档解释。

## .codex-handoff/inbox/latest-codex-result.json

- 谁生成：ingest 脚本或 internal tests。
- 什么时候生成：result markdown 被导入时。
- 谁读取：review/status/audit。
- 是否允许人工修改：谨慎允许；安全字段不得伪造。
- 是否代表真实执行：当前不代表。
- 是否只是 mock/internal test：当前对应 Round 3 mock result。

## .codex-handoff/review/latest-desktop-review.json

- 谁生成：`codex:desktop:review` 或 internal tests。
- 什么时候生成：inbox result 被审查后。
- 谁读取：status、loop、audit、operator。
- 是否允许人工修改：不建议人工改；应由 review 命令生成。
- 是否代表真实执行：否，代表本地审查结论。
- 是否只是 mock/internal test：当前 latest review 是 Round 3 no-go mock review，Ready State Reset 标记 ignored。

## .codex-handoff/review/latest-desktop-review.md

- 谁生成：`codex:desktop:review`。
- 什么时候生成：review JSON 生成时。
- 谁读取：用户和报告。
- 是否允许人工修改：不建议；应保留 generated review。
- 是否代表真实执行：否。
- 是否只是 mock/internal test：当前 latest review 来源于 mock no-go 历史。

## .codex-handoff/review/latest-feedback-to-codex.md

- 谁生成：review 逻辑。
- 什么时候生成：review 发现缺口或需要下一轮反馈时。
- 谁读取：用户、下一轮 handoff、Codex Desktop。
- 是否允许人工修改：允许作为人工反馈调整，但不能删除安全边界。
- 是否代表真实执行：否。
- 是否只是 mock/internal test：当前 latest feedback 对应 Round 3/no-go review 历史。

## .codex-handoff/runs/latest-run-summary.json

- 谁生成：controlled codex exec runner script dry-run/loop。
- 什么时候生成：codex loop/run 脚本运行时。
- 谁读取：status、audit、docs。
- 是否允许人工修改：不建议。
- 是否代表真实执行：当前不代表；status 为 dry-run-complete。
- 是否只是 mock/internal test：不是 internal run summary，但记录 dry-run，不是 real exec。

## .codex-handoff/runs/safety-gate-summary.json

- 谁生成：codex loop safety gate。
- 什么时候生成：safety gate 运行时。
- 谁读取：loop/run/audit/report。
- 是否允许人工修改：不建议。
- 是否代表真实执行：否，代表 safety gate summary。
- 是否只是 mock/internal test：不是 mock result，但不是 real exec。

## .codex-handoff/runs/desktop-automation-system-audit.json

- 谁生成：desktop automation system audit。
- 什么时候生成：运行 audit/verifier 时。
- 谁读取：`verify:codex-desktop-automation-system-audit`、报告、operator。
- 是否允许人工修改：不建议。
- 是否代表真实执行：否。
- 是否只是 mock/internal test：它审查 internal mock tests 和本地文件桥；不代表真实 Codex 执行。

## .codex-handoff/internal-runs/internal-run-summary.json

- 谁生成：`codex:desktop:test:internal`。
- 什么时候生成：三轮内部测试结束时。
- 谁读取：audit、verifier、报告。
- 是否允许人工修改：不建议。
- 是否代表真实执行：否。
- 是否只是 mock/internal test：是，明确是 internal mock tests。

# 6. 主要命令架构

## 6.1 基础运行命令

### dev:phase7b

- 作用：启动 managed dev 本地服务。
- 是否只读：否，会启动进程并写 managed state。
- 是否会生成文件：可能写 temp state/log。
- 是否会刷新 evidence：否。
- 是否可能触发真实发送：否。
- 是否允许日常使用：允许，是日常启动命令。

### stop:phase9c

- 作用：停止 managed dev 服务。
- 是否只读：否，会停止本地进程。
- 是否会生成文件：可能更新 temp state。
- 是否会刷新 evidence：否。
- 是否可能触发真实发送：否。
- 是否允许日常使用：允许。

### status:phase10a

- 作用：查看 managed dev 状态。
- 是否只读：是。
- 是否会生成文件：通常不会。
- 是否会刷新 evidence：否。
- 是否可能触发真实发送：否。
- 是否允许日常使用：允许。

### health:phase12a

- 作用：检查本地服务 `/health/check` ready 状态。
- 是否只读：是。
- 是否会生成文件：否。
- 是否会刷新 evidence：否。
- 是否可能触发真实发送：否。
- 是否允许日常使用：允许。

### doctor:phase13a

- 作用：运行 status 和 `pnpm -r --if-present check`。
- 是否只读：主要是读/语法检查；check 可能读取大量文件。
- 是否会生成文件：通常不会。
- 是否会刷新 evidence：否。
- 是否可能触发真实发送：否。
- 是否允许日常使用：允许。

## 6.2 自用价值线验证

### verify:phase245a-personal-value-closure

- 作用：验证 Personal Operator Console 自用价值线 closure。
- 是否只读：会读取 docs/UI/scripts，并可能刷新 phase evidence。
- 是否会生成文件：会写/刷新 `phase-245a-personal-value-closure.json/.md`。
- 是否会刷新 evidence：是。
- 是否可能触发真实发送：否。
- 是否允许日常使用：允许作为回归验证。

### verify:phase255a-personal-knowledge-value-closure

- 作用：验证 Knowledge/RAG 自用价值线 closure。
- 是否只读：会读取 docs/UI/scripts，并可能刷新 evidence。
- 是否会生成文件：会写/刷新 `phase-255a-personal-knowledge-value-closure.json/.md`。
- 是否会刷新 evidence：是。
- 是否可能触发真实发送：否。
- 是否允许日常使用：允许。

### verify:phase265a-codex-one-shot-readiness-closure

- 作用：验证 Codex one-shot readiness closure。
- 是否只读：会读取 docs/UI/scripts，并可能刷新 evidence。
- 是否会生成文件：会写/刷新 `phase-265a-codex-one-shot-readiness-closure.json/.md`。
- 是否会刷新 evidence：是。
- 是否可能触发真实发送：否。
- 是否允许日常使用：允许。

## 6.3 Codex Desktop Automation

### codex:desktop:status

- 作用：读取 outbox/inbox/review/feedback/reset 状态并输出当前 desktop automation 状态。
- 是否只读：是。
- 是否会生成文件：否。
- 是否会刷新 evidence：否。
- 是否可能触发真实发送：否。
- 是否允许日常使用：允许。

### codex:desktop:send

- 作用：按参数 dry-run/copy-only/paste-only/send-with-approval 处理 latest outbox task。
- 是否只读：dry-run 只读；copy-only 写剪贴板；paste-only 操作桌面窗口；send 写 send record。
- 是否会生成文件：send-with-approval 成功时写 `.codex-handoff/runs/latest-desktop-send-record.json/.md`。
- 是否会刷新 evidence：否，写 run record。
- 是否可能触发真实发送：只有 `--send --confirm-send` 会发送到 Codex Desktop UI。
- 是否允许日常使用：dry-run/copy-only 允许；paste-only/send-with-approval 需确认环境；真实 send 必须显式人工授权。

### codex:desktop:ingest

- 作用：从 clipboard/file 导入 Codex/人工 result 到 inbox。
- 是否只读：否，会写 inbox files。
- 是否会生成文件：会写 `.codex-handoff/inbox/latest-codex-result.md/json`。
- 是否会刷新 evidence：否。
- 是否可能触发真实发送：否。
- 是否允许日常使用：允许，但导入后必须 review。

### codex:desktop:review

- 作用：读取 inbox/outbox，生成 desktop review 和 feedback。
- 是否只读：否，会写 review/feedback。
- 是否会生成文件：会写 `.codex-handoff/review/latest-desktop-review.json/.md` 和 `latest-feedback-to-codex.md`。
- 是否会刷新 evidence：否。
- 是否可能触发真实发送：否。
- 是否允许日常使用：允许。

### codex:desktop:loop

- 作用：组合 desktop status/send/ingest/review 的 loop helper。
- 是否只读：取决于参数；默认应保持 dry-run/受控。
- 是否会生成文件：可能写 run summary、inbox、review、feedback。
- 是否会刷新 evidence：否。
- 是否可能触发真实发送：只有显式 send 参数才可能。
- 是否允许日常使用：允许 dry-run/manual；真实发送必须单独授权。

### codex:desktop:test:internal

- 作用：运行三轮本地 mock internal tests。
- 是否只读：否，会写 `.codex-handoff/internal-runs/`。
- 是否会生成文件：会写 round summaries、mock result、review、feedback。
- 是否会刷新 evidence：否，写 internal run files。
- 是否可能触发真实发送：否。
- 是否允许日常使用：允许作为本地回归；必须标注 mock/internal test。

## 6.4 系统级审查

### verify:codex-desktop-automation-system-audit

- 作用：验证 desktop automation audit、internal runs、UI markers、scripts 和安全边界。
- 是否只读：读取 audit/internal/UI/package；audit 文件由独立 audit 生成。
- 是否会生成文件：该 verifier 本身主要输出结果；audit 脚本生成 audit files。
- 是否会刷新 evidence：不写 apps evidence；检查 `.codex-handoff/runs/desktop-automation-system-audit.json`。
- 是否可能触发真实发送：否。
- 是否允许日常使用：允许。

### verify:phase267a-project-readthrough-future-report

- 作用：验证本轮项目通读与未来方向报告、machine-readable evidence、关键边界和禁止性夸大。
- 是否只读：会读取报告/evidence/package/project files，并刷新本 phase evidence checkedAt。
- 是否会生成文件：会刷新 `phase-267a-project-readthrough-future-report.json/.md`。
- 是否会刷新 evidence：是。
- 是否可能触发真实发送：否。
- 是否允许日常使用：允许作为报告回归验证。

### verify:phase267a-architecture-report

- 作用：验证整体架构报告、machine-readable architecture evidence、关键边界和 safety false。
- 是否只读：会读取报告/evidence/package/project files，并刷新 architecture evidence checkedAt。
- 是否会生成文件：会刷新 `phase-267a-architecture-report.json/.md`。
- 是否会刷新 evidence：是。
- 是否可能触发真实发送：否。
- 是否允许日常使用：允许作为架构报告回归验证。

# 7. 安全架构

当前安全边界：

- `executionEnabled=false`
- `codexExecInvoked=false`
- `codexCliInvoked=false`
- `workflowRunnerEnabled=false`
- `worktreeCreated=false`
- `autoCommit=false`
- `autoPush=false`
- approval-preview is not execution permission
- no real Codex exec
- no workflow runner
- no worktree creation
- no auto commit/push
- no production vector RAG
- no GraphRAG
- no enterprise ACL sync
- no multi-tenant knowledge base

这些边界由多层共同约束：

- UI 文案：`consolePage.js` 中有 preview-only、no real Codex exec、no workflow runner、no worktree、no auto commit/push 等 markers。
- docs：AGENTS、USER_MANUAL、Personal docs、Codex readiness docs、Desktop Automation docs 都重复写明边界。
- verifier：phase verifiers 检查 required sections、boundary markers、forbidden claims、safety fields。
- evidence：phase evidence JSON/Markdown 记录 safety false。
- audit report：desktop automation system audit 检查 internal runs、UI markers、scripts、安全字段和 mock/not-real-execution 边界。

安全架构的实际含义：

- 即便 outbox task 已生成，也只是 handoff。
- 即便 approval-preview 已记录，也不是执行授权。
- 即便 go/no-go 是 go，也只是 readiness/review judgment，不自动执行。
- 即便 send-with-approval 真实发送，也只是任务进入 Codex Desktop UI，不自动应用结果，不自动 commit/push。
- 即便 internal tests allExpectationsMet=true，也只是 mock test passed。

# 8. 当前架构成熟度评估

| 模块 | 成熟度等级 | 判断 |
| --- | --- | --- |
| AI Gateway baseline | Stable preview baseline | 本地 status/health/doctor 通过，默认 NVIDIA `/chat` 主链清楚。 |
| `/ui` console | Operational preview | UI 可用，入口完整，但中文化/状态层级仍可打磨。 |
| Personal Operator Console | Stable preview baseline | Phase 237A-245A closure passed，日常自用流程完整。 |
| Knowledge/RAG self-use layer | Operational preview | Phase 246A-255A closure passed，可做本地自用查询/引用/freshness；非生产级。 |
| Agent Workforce Preview | Stable preview baseline | deterministic-plan-preview、save/history/export、review package/approval preview 已形成；不执行 Agent。 |
| Codex handoff/review loop | Operational preview | outbox/inbox/review/feedback/result intake 可用；依赖人工和 result 质量。 |
| Codex Desktop Automation | Readiness-only / Operational preview | status/internal tests/audit/ready reset 可用；真实 send-with-approval 本轮未执行。 |
| Evidence/verifier system | Stable preview baseline | 大量 phase evidence/verifier；仍需注意 stale evidence。 |
| Provider management | Readiness-only | NVIDIA baseline 稳定；OpenAI-compatible/MiMo 是 future smoke path。 |
| Production RAG | Not implemented | no production vector RAG。 |
| Multi-user SaaS | Not implemented | 无生产级 auth/tenant/key vault/security review。 |
| Workflow runner | Not implemented | no workflow runner。 |
| Real Codex execution | Not implemented | no real Codex exec。 |
| Worktree execution | Not implemented | no worktree creation。 |

# 9. 当前架构风险

- workspace dirty，不能声称 clean。
- UI 仍依赖本地服务，服务停止时 `/ui` 不可用。
- Desktop automation 依赖窗口焦点、剪贴板、Codex Desktop 窗口标题和用户环境。
- send-with-approval 还未真实授权运行。
- internal tests 是 mock，不是真实 Codex 执行。
- review 依赖 Codex 返回内容质量。
- RAG 仍是 self-use preview。
- 没有企业权限系统。
- 没有生产级密钥保险箱。
- 没有真正的 workflow runner。
- 没有真实 worktree execution。
- 没有自动 PR/release。
- provider 扩展若处理不慎可能误改默认 NVIDIA `/chat` 主链。
- `.codex-handoff` latest 文件可能因 mock/internal test 和 reset 状态造成误读，必须看 readyStateResetActive 和 evidence。

# 10. 未来架构演进方向

## 10.1 短期架构方向

### Ready State Reset

- 架构价值：把历史 mock no-go 从 current operational state 中分离。
- 依赖前置：reset record、archived files、status correctly marks ignored review。
- 风险：误读为真实执行修复。
- 为什么现在不一定应该立即做：已完成基础 reset，继续扩展收益有限。
- 推荐优先级：高。

### 中文 UI 完整优化

- 架构价值：降低 operator layer 的理解成本。
- 依赖前置：明确 UI sections 和状态词汇。
- 风险：大文件修改风险和 copy 过度承诺风险。
- 为什么现在不一定应该立即做：本轮只做报告/验证。
- 推荐优先级：高。

### Auto Loop Status Panel 打磨

- 架构价值：让 latestGoNoGo、currentBlocker、readyStateResetActive、nextAction 更可读。
- 依赖前置：status JSON 字段稳定。
- 风险：状态文案误把 readiness 写成执行。
- 为什么现在不一定应该立即做：先完成报告和 verifier。
- 推荐优先级：高。

### Action Queue 一键复制/一键生成 outbox

- 架构价值：减少手动复制和格式错误。
- 依赖前置：task schema、blocked scope、verification commands。
- 风险：复制/生成被误解为发送/执行。
- 为什么现在不一定应该立即做：本轮禁止新增业务功能。
- 推荐优先级：中高。

### MiMo OpenAI-compatible provider smoke

- 架构价值：验证 provider layer 扩展能力。
- 依赖前置：masked key、OpenAI-compatible config、smoke evidence。
- 风险：泄露 key、误改默认 NVIDIA 主链。
- 为什么现在不一定应该立即做：需要单独明确 provider smoke phase。
- 推荐优先级：中高。

### Knowledge source real import trial

- 架构价值：验证 self-use knowledge lifecycle 的真实输入价值。
- 依赖前置：非敏感 source、source inventory、query template、citation check。
- 风险：资料噪声和 stale citation。
- 为什么现在不一定应该立即做：需要单独 trial 和验收。
- 推荐优先级：中高。

## 10.2 中期架构方向

### 人工批准 real send-with-approval trial

- 架构价值：验证 desktop automation 从 outbox 到 Codex Desktop UI 的真实 send path。
- 依赖前置：explicit user approval、safe task、desktop window、dirty workspace risk review。
- 风险：误发送、窗口焦点、结果不可控。
- 为什么现在不一定应该立即做：本轮明确不真实发送 Codex。
- 推荐优先级：中。

### desktop send result archive

- 架构价值：减少 latest 文件覆盖造成的状态误读。
- 依赖前置：archive naming、metadata、latest pointer。
- 风险：归档膨胀、旧结果误读。
- 为什么现在不一定应该立即做：先验证真实 send path。
- 推荐优先级：中。

### allowed files policy

- 架构价值：未来真实执行/PR/worktree 的安全基础。
- 依赖前置：任务级 schema、blocked paths、verifier enforcement。
- 风险：策略过宽或过窄。
- 为什么现在不一定应该立即做：当前没有真实执行。
- 推荐优先级：高。

### task diff preview

- 架构价值：让用户在应用前查看修改差异。
- 依赖前置：result intake changed-files schema、diff generator、workspace state。
- 风险：dirty workspace 下 diff 不可靠。
- 为什么现在不一定应该立即做：尚无真实修改链路。
- 推荐优先级：中。

### evidence dashboard

- 架构价值：集中展示 phase status、audit、secret safety、go/no-go。
- 依赖前置：evidence schema 和 freshness ordering。
- 风险：旧 evidence 误导。
- 为什么现在不一定应该立即做：报告先固化架构口径。
- 推荐优先级：中。

### provider registry UI

- 架构价值：让 provider 状态、runtime key presence、smoke 结果可见。
- 依赖前置：secret masking、provider descriptors、model list probe。
- 风险：泄密、误改默认 provider。
- 为什么现在不一定应该立即做：先做 MiMo smoke。
- 推荐优先级：中。

### MiMo / OpenAI-compatible adapter

- 架构价值：扩展 provider/model layer。
- 依赖前置：OpenAI-compatible endpoint、headers、models/list、smoke verifier。
- 风险：兼容性和默认主链漂移。
- 为什么现在不一定应该立即做：需要独立 phase。
- 推荐优先级：中高。

### local knowledge lifecycle

- 架构价值：从 source import 到 citation/freshness/maintenance 的闭环。
- 依赖前置：source metadata、cleanup、refresh policy。
- 风险：知识库噪声。
- 为什么现在不一定应该立即做：先做 real import trial。
- 推荐优先级：中高。

## 10.3 长期架构方向

### controlled worktree execution

- 架构价值：隔离真实代码变更。
- 依赖前置：clean baseline、allowed files、diff preview、secret scan、human approval。
- 风险：冲突、误删、工作区污染。
- 为什么现在不一定应该立即做：当前硬边界 no worktree creation。
- 推荐优先级：低到中。

### workflow runner

- 架构价值：把 planning、execution、verification、evidence 串成可审计流程。
- 依赖前置：runner protocol、cancellation、approval、audit。
- 风险：无人值守风险和错误扩大。
- 为什么现在不一定应该立即做：当前 no workflow runner。
- 推荐优先级：低。

### PR creation with approval

- 架构价值：把变更进入可审查远程协作流程。
- 依赖前置：branch policy、CI、GitHub auth、explicit approval。
- 风险：误推、敏感文件、未审查代码进入远程。
- 为什么现在不一定应该立即做：当前 no auto commit/push/PR。
- 推荐优先级：低到中。

### multi-user/team permission

- 架构价值：支持团队操作。
- 依赖前置：auth、tenant isolation、ACL、audit retention。
- 风险：权限和数据隔离。
- 为什么现在不一定应该立即做：当前不是生产级 SaaS。
- 推荐优先级：低。

### enterprise key vault

- 架构价值：生产级 secret management。
- 依赖前置：encryption、rotation、access control、audit。
- 风险：安全责任高。
- 为什么现在不一定应该立即做：当前本地 `.env`/runtime masking 不是 vault。
- 推荐优先级：中长期高。

### vector RAG / GraphRAG

- 架构价值：支持大规模语义检索和图谱关系查询。
- 依赖前置：embedding provider、vector store、index lifecycle、permission-aware retrieval、eval。
- 风险：成本、幻觉、权限泄漏、过度承诺。
- 为什么现在不一定应该立即做：当前 no production vector RAG、no GraphRAG。
- 推荐优先级：中长期。

### audit dashboard

- 架构价值：统一呈现运行证据、审批、审查、风险。
- 依赖前置：统一 evidence schema、retention policy、masking。
- 风险：敏感信息展示和旧状态误读。
- 为什么现在不一定应该立即做：先稳定 evidence sources。
- 推荐优先级：中。

### private deployment / SaaS

- 架构价值：支持私有部署或未来 SaaS。
- 依赖前置：auth、tenant、key vault、rate limit、audit、security review、deployment automation。
- 风险：生产责任、合规、安全。
- 为什么现在不一定应该立即做：当前本地/内部测试边界明确。
- 推荐优先级：低。

### commercial pilot package

- 架构价值：把本地能力保守包装为可演示试点。
- 依赖前置：技术边界报告、demo scripts、known limits。
- 风险：宣传夸大 preview-only。
- 为什么现在不一定应该立即做：先完成真实 trial 和 UI polish。
- 推荐优先级：中低。

# 11. 推荐架构路线

## A. 继续停在 readiness，自用观察

- 价值：最低风险。
- 依赖：继续跑 status/health/doctor 和核心 verifiers。
- 风险：不验证真实 send/provider/knowledge import。
- 优先级：中。

## B. Ready State Reset，清理 mock no-go latest 状态

- 价值：保持 operational state 清楚。
- 依赖：ready-state-reset evidence passed。
- 风险：误读 reset。
- 优先级：高。

## C. MiMo OpenAI-compatible provider smoke

- 价值：验证 future provider path。
- 依赖：安全 key handling 和不改 NVIDIA 主链。
- 风险：配置/网络/key 泄漏。
- 优先级：中高。

## D. 人工批准 Codex Desktop send-with-approval 首次真实发送

- 价值：验证 desktop UI send path。
- 依赖：明确用户授权、safe task、窗口环境、dirty workspace 风险确认。
- 风险：误发送和结果不确定。
- 优先级：中。

## E. Knowledge source real import trial

- 价值：验证自用 Knowledge/RAG 的真实资料价值。
- 依赖：非敏感 source、citation/freshness check。
- 风险：资料噪声和 stale answer。
- 优先级：中高。

## F. 架构清理和模块边界整理

- 价值：降低长期维护成本。
- 依赖：报告结论、module ownership、script inventory。
- 风险：重构范围扩大。
- 优先级：中。

推荐最稳路线：

B -> E -> C -> F -> D。

原因：

- B 已完成且风险最低，可以保持当前状态可解释。
- E 直接提升个人自用价值，不触碰真实代码执行。
- C 验证 provider 扩展，但必须不改默认 NVIDIA `/chat`。
- F 在报告之后整理边界，降低后续真实 trial 风险。
- D 需要显式授权和桌面环境，风险高于前几项，应放到准备充分之后。

不推荐现在直接进入 controlled worktree execution、workflow runner、PR creation 或 real Codex exec。

# 12. 架构结论

当前架构已经达到本地自用操作台和受控 handoff/review/desktop automation readiness 的程度。当前最强能力是：用 docs/evidence/verifier/UI/handoff 文件桥把项目状态、下一步任务、Codex 协作边界和审查结果形成可复核闭环。当前最大短板是：真实执行链路仍未完成，尤其是 no real Codex exec、no codex CLI、no workflow runner、no worktree creation、no auto commit/push，以及 Knowledge/RAG 仍非生产级。下一步最稳架构动作是保持 readiness 边界，先完成状态卫生、真实 Knowledge import trial 和 MiMo/OpenAI-compatible smoke，再在用户显式授权后单独试验 Codex Desktop send-with-approval。
