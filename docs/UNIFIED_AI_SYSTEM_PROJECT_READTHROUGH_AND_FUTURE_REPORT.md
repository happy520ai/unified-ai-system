# Unified AI System Project Readthrough And Future Report

# 1. 执行摘要

当前 `unified-ai-system` 的一句话定位是：本地 AI Gateway + Personal Operator Console + Knowledge/RAG 自用查询层 + Codex handoff/review/desktop automation 的组合系统。

它当前能为个人用户提供的实际价值是：

- 用 `/ui` 作为本地个人项目操作台，查看服务状态、Personal Operator Console、Decision Dashboard、Action Queue、Knowledge/RAG、Agent Workforce Preview、Auto Loop Status Panel。
- 用本地 AI Gateway 维持默认 NVIDIA `/chat` 主链，提供健康检查、setup readiness、chat、RAG chat、knowledge、workforce preview 等本地接口。
- 用 Personal Operator Console 把每日启动、项目知识查询、下一条 Codex 任务生成、结果审查、evidence 验证和停止规则放在一个自用工作流里。
- 用 Knowledge/RAG 自用价值线从 README、AGENTS、docs、evidence、handoff/review 文件中做本地关键词/SQLite/引用式查询，辅助回答当前状态、blocker、下一步任务。
- 用 Controlled Codex One-shot Readiness 和 Controlled Codex Desktop Automation 做任务交接、dry-run、copy-only、paste-only、inbox ingest、review、go/no-go 和 feedback 的受控闭环。

当前不是：

- 不是生产级 SaaS。
- 不是无人值守 AI 员工。
- 不是自动 commit/push/PR/release 系统。
- 不是已经完成真实 Codex exec 的系统。
- 不是已经调用 codex CLI 的系统。
- 不是生产级 vector RAG 或 GraphRAG。
- 不是企业级多租户、ACL 同步、密钥保险箱或 workflow runner。

当前最重要结论是：项目已经形成了较完整的本地自用操作台、文档/evidence/verifier 体系、Knowledge/RAG 自用查询流程和 Codex Desktop 受控文件桥闭环；但所有涉及真实外部执行、自动代码修改、worktree、workflow runner、自动 commit/push/PR/release、生产级 SaaS、生产级 RAG 的内容仍必须保守标为未完成或未来方向。当前 workspace 是 dirty，不能声称 clean workspace。

# 2. 项目总体定位

当前项目是个人 AI 项目操作台。它把本地服务、Web UI、项目文档、evidence、Knowledge/RAG 查询、Agent Workforce Preview、Codex handoff/review 和桌面自动化状态面板组合起来，帮助用户每天判断项目状态、生成下一步任务、检查结果和维护证据。

当前项目是项目知识查询助手。`docs/PERSONAL_KNOWLEDGE_SOURCE_INVENTORY.md`、`docs/PERSONAL_KNOWLEDGE_QUERY_TEMPLATES.md`、`docs/PERSONAL_KNOWLEDGE_CITATION_REPORT.md`、`docs/PERSONAL_KNOWLEDGE_FRESHNESS_GUARD.md` 和 `docs/PERSONAL_KNOWLEDGE_VALUE_CLOSURE.md` 共同定义了自用 Knowledge/RAG 的来源、查询模板、引用规则、新鲜度规则和边界。它用于当前项目状态、blocker、下一步任务和 evidence 引用，不是生产级知识平台。

当前项目是 Codex 单次执行前安全门。`docs/CODEX_ONE_SHOT_READINESS_POLICY.md` 到 `docs/CODEX_ONE_SHOT_READINESS_CLOSURE.md` 建立了 readiness-only 的政策、任务分类、preflight、approval-preview、dry-run plan、result intake、rollback/stop、UI readiness panel 和 operator manual。它不执行 Codex，不调用 codex CLI，不把 go/no-go 当成执行许可。

当前项目是受控 Codex Desktop 自动化闭环。`docs/CODEX_DESKTOP_AUTOMATION_LOOP.md` 和 `.codex-handoff/` 下的 outbox、inbox、review、runs、internal-runs 定义了 dry-run、copy-only、paste-only、send-with-approval、ingest、review、go/no-go、feedback 和 system audit 的本地文件桥流程。

当前项目不是无人值守 AI 员工。Agent Workforce Preview 是 deterministic-plan-preview，多角色任务规划只产生计划、clarify、consensus、review package、approval preview、handoff package 和 export，不真实执行 Agent。

当前项目不是生产级 SaaS。Phase 108A/109A 相关边界和现有 docs 明确，当前适合本地/内部测试；公开多用户生产部署还需要 auth、tenant isolation、encrypted secret vault、rate limit、audit retention、security review 等。

当前项目不是自动 commit/push/PR/release 系统。所有 Codex 相关文档和 evidence 都要求 `autoCommit=false`、`autoPush=false`，并把 PR/release 自动化列为未来、需审批、不可默认执行的方向。

# 3. 已完成能力全景图

## 3.1 AI Gateway / NVIDIA chat baseline

完成程度：

- 本地服务正在 `http://127.0.0.1:3100` 运行。
- `cmd /c pnpm run status:phase10a` 返回 `status=running`。
- `cmd /c pnpm run health:phase12a` 返回 `status=passed`、`serviceStatus=ready`、`providerMode=real`、`realProviderEnabled=true`、`routes.chat=true`、`routes.ragChat=true`、`routes.knowledgeHealth=true`。
- `.env.example` 明确默认 `AI_GATEWAY_DEFAULT_PROVIDER=nvidia` 和 `AI_GATEWAY_ENABLED_PROVIDERS=nvidia`，并声明模板不是真实密钥保险箱。

证据位置：

- `package.json`
- `.env.example`
- `apps/ai-gateway-service/src/application/createGatewayApplication.js`
- `apps/ai-gateway-service/src/http/httpServer.js`
- `apps/ai-gateway-service/evidence/phase-107a-secret-safety.json`
- 本轮命令输出：status/health/doctor passed。

能怎么用：

- 用 `cmd /c pnpm run dev:phase7b` 启动本地服务。
- 用 `cmd /c pnpm run status:phase10a` 查看 managed dev 状态。
- 用 `cmd /c pnpm run health:phase12a` 检查本地服务和路由 ready。
- 访问 `/ui`、`/health/check`、`/setup/readiness`、`/chat`、`/chat/rag`。

不能怎么用：

- 不能把本地 health passed 写成生产部署完成。
- 不能把默认 NVIDIA `/chat` 主链改成其他 provider 主链，除非新 phase 明确要求且有验证。
- 不能在 evidence、docs、logs、handoff、inbox、review 或 runs 中写真实 API key。

风险和边界：

- health 只说明本地服务 ready，不代表真实 provider smoke 本轮已经执行。
- 默认 NVIDIA `/chat` lane 必须保留。
- provider registry 中存在 OpenAI-compatible future path，但当前目标不改变默认 NVIDIA 主链。

## 3.2 /ui Web Console

完成程度：

- `/ui` 页面由 `apps/ai-gateway-service/src/ui/consolePage.js` 生成。
- UI 中有 Setup Wizard、Chat、Knowledge/RAG、Agent Workforce Preview、Personal Operator Console、Decision Dashboard、Action Queue、One-shot Readiness、Auto Loop Status Panel、Controlled Codex Desktop Automation 等入口。
- UI 文案明确 `preview-only`、`no real Codex exec`、`no workflow runner`、`no worktree creation`、`no auto commit/push`、`not unattended development`。

证据位置：

- `apps/ai-gateway-service/src/ui/consolePage.js`
- `docs/USER_MANUAL.md`
- `apps/ai-gateway-service/evidence/phase-105a-user-journey.json`
- `apps/ai-gateway-service/evidence/phase-199a-real-ui-trial-runtime-sync.json`

能怎么用：

- 打开 `http://127.0.0.1:3100/ui`。
- 从页面查看服务状态、模型配置、Knowledge/RAG、Agent Workforce Preview 和个人操作台内容。

不能怎么用：

- 不能把 UI 的 preview 面板当成真实执行按钮。
- 不能把 UI 中的 GraphRAG 文字或图谱查询入口描述为生产级 GraphRAG 已完成。

风险和边界：

- UI 仍依赖本地服务运行。
- 中文 UI 已有大量入口，但仍可能需要完整中文化、可用性和信息层级优化。

## 3.3 Personal Operator Console

完成程度：

- Phase 237A-245A 自用操作台价值线已经通过 evidence 封板为 preview baseline。
- Personal Operator Console 覆盖当前状态、每日流程、项目知识包、Decision Dashboard、Action Queue、Review & Evidence Loop、Operator Manual 和 Value Closure。

证据位置：

- `docs/PERSONAL_OPERATOR_CONSOLE.md`
- `docs/PERSONAL_DAILY_WORKFLOW.md`
- `docs/PERSONAL_PROJECT_KNOWLEDGE_PACK.md`
- `docs/PERSONAL_DECISION_DASHBOARD.md`
- `docs/PERSONAL_ACTION_QUEUE.md`
- `docs/PERSONAL_REVIEW_EVIDENCE_LOOP.md`
- `docs/PERSONAL_OPERATOR_MANUAL_FINAL.md`
- `docs/PERSONAL_VALUE_CLOSURE_SNAPSHOT.md`
- `apps/ai-gateway-service/evidence/phase-245a-personal-value-closure.json`

能怎么用：

- 每天从 `/ui` 的个人项目操作台进入，先看状态、blocker、下一步建议。
- 用 Decision Dashboard 判断继续、停止、补证据或生成下一条任务。
- 用 Action Queue 把下一步变成 Codex task。

不能怎么用：

- 不能把 Personal Operator Console 描述成自动开发系统。
- 不能把 approval-preview 当成执行授权。

风险和边界：

- 当前 workspace dirty 时，真实执行应保持 blocked 或需人工判断。
- 该线是自用 preview closure，不是生产级产品承诺。

## 3.4 Daily Workflow

完成程度：

- `docs/PERSONAL_DAILY_WORKFLOW.md` 描述了每日启动、检查 `/ui`、读 Personal Operator Console、生成 task、handoff、导入结果、review、verify、stop 的流程。
- 文档明确 dirty workspace 不能被说成 clean。

证据位置：

- `docs/PERSONAL_DAILY_WORKFLOW.md`
- `apps/ai-gateway-service/evidence/phase-245a-personal-value-closure.json`

能怎么用：

- 启动服务后先跑 status/health/doctor。
- 打开 `/ui` 查看 current status、Action Queue 和 Review & Evidence Loop。
- 在需要 Codex 协作时生成 outbox 任务，再人工交接或使用受控 desktop automation。

不能怎么用：

- 不能跳过 review/evidence 直接把 Codex 输出当成完成。
- 不能在 dirty workspace 上默认真实执行。

风险和边界：

- 工作流依赖用户持续阅读 evidence 和真实命令结果。
- 如果 latest handoff/review 是 mock no-go，必须用 Ready State Reset 或明确标记其历史性质。

## 3.5 Personal Project Knowledge Pack

完成程度：

- Phase 239A 定义项目知识包来源、事实类型、查询方式、stale evidence 规则和 UI prompt。
- Phase 246A-255A 进一步形成 Knowledge/RAG 自用价值线。

证据位置：

- `docs/PERSONAL_PROJECT_KNOWLEDGE_PACK.md`
- `docs/PERSONAL_KNOWLEDGE_SOURCE_INVENTORY.md`
- `docs/PERSONAL_KNOWLEDGE_VALUE_CLOSURE.md`
- `apps/ai-gateway-service/evidence/phase-255a-personal-knowledge-value-closure.json`

能怎么用：

- 用 README、AGENTS、docs、evidence、handoff/review 做当前项目状态查询。
- 要求答案带 evidence path 或文档引用。

不能怎么用：

- 不能当成生产级知识治理系统。
- 不能当成企业 ACL 同步、multi-tenant knowledge base、production vector RAG 或 GraphRAG。

风险和边界：

- stale evidence 可能误导当前状态，必须优先最新 passed evidence、closure snapshot 和本轮命令结果。

## 3.6 Decision Dashboard

完成程度：

- `docs/PERSONAL_DECISION_DASHBOARD.md` 给出 status dimension、blocker decision rules、next step rules、A/B/C comparison、Codex-ready decision 和 stop/continue decision。
- UI 中有 Decision Dashboard 区域和相关 anchors。

证据位置：

- `docs/PERSONAL_DECISION_DASHBOARD.md`
- `apps/ai-gateway-service/src/ui/consolePage.js`
- `apps/ai-gateway-service/evidence/phase-245a-personal-value-closure.json`

能怎么用：

- 判断 next route：继续 readiness、自用观察、清理 mock 状态、MiMo smoke、Knowledge import、人工 send trial 等。
- 在 dirty workspace、missing evidence、verification failure、boundary risk 时做 stop 或 blocked 判断。

不能怎么用：

- 不能把 dashboard 的选择建议当成自动执行许可。
- 不能绕过 required verifier。

风险和边界：

- Dashboard 依赖最新 evidence 与命令结果；旧 conclusion 不能自动覆盖本轮真实状态。

## 3.7 Personal Action Queue

完成程度：

- `docs/PERSONAL_ACTION_QUEUE.md` 定义 task queue format、required fields、blocked/skipped/done、commercialization pause、no real execution recording。
- `.codex-handoff/outbox/latest-codex-task.md/json` 是当前 latest outbox。

证据位置：

- `docs/PERSONAL_ACTION_QUEUE.md`
- `.codex-handoff/outbox/latest-codex-task.md`
- `.codex-handoff/outbox/latest-codex-task.json`

能怎么用：

- 从 Decision Dashboard 生成下一条 Codex handoff task。
- 把任务写入 outbox，供 copy-only、paste-only、send-with-approval 或人工复制使用。

不能怎么用：

- 不能把 outbox task 当成已执行结果。
- 不能让 task 默认允许 commit/push/worktree/workflow runner。

风险和边界：

- 当前 latest task 是 `personal-operator-console-readonly-usage-check`，mode 为 `manual-handoff-only`，`executionEnabled=false`。

## 3.8 Review & Evidence Loop

完成程度：

- `docs/PERSONAL_REVIEW_EVIDENCE_LOOP.md` 定义结果返回后的边界审查、legacy check、PROJECT_CONTEXT check、commit/push check、real execution/worktree/workflow runner check、evidence review、verification review 和 pass/blocked/redo decision。
- `apps/ai-gateway-service/src/entrypoints/codexDesktopReviewCore.js` 和 `reviewCodexDesktopResult.js` 提供 desktop result review 逻辑。

证据位置：

- `docs/PERSONAL_REVIEW_EVIDENCE_LOOP.md`
- `.codex-handoff/review/latest-desktop-review.json`
- `.codex-handoff/review/latest-desktop-review.md`
- `.codex-handoff/review/latest-feedback-to-codex.md`

能怎么用：

- 导入 inbox 后运行 `cmd /c pnpm run codex:desktop:review`。
- 读取 go/no-go、boundary findings、verification findings、evidence findings 和 feedback。

不能怎么用：

- 不能把 review skipped 或 review missing 当成 passed。
- 不能自动 apply、merge、commit、push Codex result。

风险和边界：

- Review 依赖 Codex 返回内容质量。如果结果缺少 modified files、commands、verification、evidence 或 boundary review，应进入 review-required/human-review-required/no-go。

## 3.9 Knowledge/RAG 自用价值线

完成程度：

- Phase 246A-255A evidence 均以 passed 形式封板到 `phase-255a-personal-knowledge-value-closure`。
- 当前能力是 local keyword retrieval、source load/list、RAG chat、citation/highlight、file/SQLite persistence、自用 query templates、freshness guard、maintenance loop。

证据位置：

- `docs/PERSONAL_KNOWLEDGE_SOURCE_INVENTORY.md`
- `docs/PERSONAL_KNOWLEDGE_STARTER_PACK.md`
- `docs/PERSONAL_KNOWLEDGE_QUERY_TEMPLATES.md`
- `docs/PERSONAL_KNOWLEDGE_CITATION_REPORT.md`
- `docs/PERSONAL_KNOWLEDGE_FRESHNESS_GUARD.md`
- `docs/PERSONAL_KNOWLEDGE_UI_GUIDE.md`
- `docs/PERSONAL_KNOWLEDGE_LIVE_TRIAL.md`
- `docs/PERSONAL_KNOWLEDGE_MAINTENANCE_LOOP.md`
- `docs/PERSONAL_KNOWLEDGE_OPERATOR_MANUAL.md`
- `docs/PERSONAL_KNOWLEDGE_VALUE_CLOSURE.md`
- `apps/ai-gateway-service/evidence/phase-255a-personal-knowledge-value-closure.json`

能怎么用：

- 查询当前项目状态、blocker、latest completed phase、sealed capabilities、preview-only capabilities、cannot-promised capabilities、next Codex task、required verification commands、latest evidence。
- 要求回答引用 docs/evidence path，并标明 freshness。

不能怎么用：

- 不能声称 production vector RAG。
- 不能声称 GraphRAG。
- 不能声称 enterprise ACL sync、多租户知识库、生产级知识治理。

风险和边界：

- 本地 Knowledge/RAG 仍是 self-use preview。
- 需要真实资料 import trial 才能评估用户材料导入体验。

## 3.10 Controlled Codex One-shot Readiness

完成程度：

- Phase 256A-265A passed evidence 形成 readiness-only 层。
- 具备 policy、safety classifier、preflight checklist、approval record preview、dry-run execution plan、result intake contract、rollback/stop rules、UI readiness panel、operator manual、readiness closure。

证据位置：

- `docs/CODEX_ONE_SHOT_READINESS_POLICY.md`
- `docs/CODEX_TASK_SAFETY_CLASSIFIER.md`
- `docs/CODEX_PREFLIGHT_CHECKLIST.md`
- `docs/CODEX_APPROVAL_RECORD_PREVIEW.md`
- `docs/CODEX_DRY_RUN_EXECUTION_PLAN.md`
- `docs/CODEX_RESULT_INTAKE_CONTRACT.md`
- `docs/CODEX_ROLLBACK_STOP_RULES.md`
- `docs/CODEX_ONE_SHOT_UI_READINESS_PANEL.md`
- `docs/CODEX_ONE_SHOT_OPERATOR_MANUAL.md`
- `docs/CODEX_ONE_SHOT_READINESS_CLOSURE.md`
- `apps/ai-gateway-service/evidence/phase-265a-codex-one-shot-readiness-closure.json`

能怎么用：

- 判断一个未来 Codex one-shot 是否满足 readiness。
- 输出 go/no-go readiness decision。
- 生成 approval-preview 和 dry-run plan 作为审查材料。

不能怎么用：

- 不能真实调用 `codex exec`。
- 不能调用 codex CLI。
- 不能把 readiness 写成 execution completed。
- 不能把 go/no-go 写成执行许可。

风险和边界：

- 真实 one-shot 仍需要单独显式授权和安全门通过。
- 当前 workspace dirty 对真实执行是重要风险。

## 3.11 Action Queue / outbox / inbox / review / feedback

完成程度：

- `.codex-handoff/outbox/latest-codex-task.md/json` 存在。
- `.codex-handoff/inbox/latest-codex-result.md/json` 存在，但当前内容来自 Round 3 mock Codex Result。
- `.codex-handoff/review/latest-desktop-review.md/json` 存在，latest review 为 `goNoGo=no-go`，但 current desktop status 因 Ready State Reset 将其标记为 ignored by reset。
- `.codex-handoff/review/latest-feedback-to-codex.md` 存在。

证据位置：

- `.codex-handoff/outbox/`
- `.codex-handoff/inbox/`
- `.codex-handoff/review/`
- `.codex-handoff/runs/latest-ready-state-reset.json`
- `cmd /c pnpm run codex:desktop:status` 本轮输出。

能怎么用：

- outbox 作为下一条任务交接材料。
- inbox 作为 Codex/人工结果导入位置。
- review 作为本地 go/no-go 和反馈位置。

不能怎么用：

- 不能把 inbox/latest 的 Round 3 mock 当成真实 Codex 输出。
- 不能把 send-with-approval 当成 commit/push 许可。

风险和边界：

- latest inbox/review/feedback 的历史 no-go 由 Ready State Reset 归档影响当前状态解读。

## 3.12 Controlled Codex Desktop Automation

完成程度：

- `codex:desktop:status` 通过并返回 `status=ready`、`latestGoNoGo=standby-ready`、`currentBlocker=none`。
- `codex:desktop:send` 支持 dry-run、copy-only、paste-only、send-with-approval。
- `codex:desktop:ingest` 支持从剪贴板或文件导入 result。
- `codex:desktop:review` 生成 review 和 feedback。
- `codex:desktop:loop` 组合 status/send/ingest/review 的本地闭环。
- `codex:desktop:test:internal` 运行三轮 mock internal tests。
- `verify:codex-desktop-automation-system-audit` 检查 audit、internal-runs、UI markers、package scripts 和安全字段。

证据位置：

- `docs/CODEX_DESKTOP_AUTOMATION_LOOP.md`
- `docs/CODEX_DESKTOP_AUTOMATION_SYSTEM_AUDIT.md`
- `apps/ai-gateway-service/src/entrypoints/sendCodexDesktopTask.js`
- `apps/ai-gateway-service/src/entrypoints/ingestCodexDesktopResult.js`
- `apps/ai-gateway-service/src/entrypoints/reviewCodexDesktopResult.js`
- `apps/ai-gateway-service/src/entrypoints/runCodexDesktopLoop.js`
- `apps/ai-gateway-service/src/entrypoints/runCodexDesktopInternalTests.js`
- `.codex-handoff/runs/desktop-automation-system-audit.json`

能怎么用：

- 日常先运行 `cmd /c pnpm run codex:desktop:status`。
- 只检查时用 `cmd /c pnpm run codex:desktop:send -- --dry-run`。
- 只复制任务时用 `cmd /c pnpm run codex:desktop:send -- --copy-only`。
- 只粘贴不发送时用 `cmd /c pnpm run codex:desktop:send -- --paste-only`。
- 真实发送仅能在用户显式授权 `--send --confirm-send` 且环境满足时进行；本轮没有执行。

不能怎么用：

- 不能把 desktop send 写成 execution completed。
- 不能把 send-with-approval 写成允许 commit/push/PR/release。
- 不能把内部 mock tests 写成真实 Codex 执行。

风险和边界：

- Desktop automation 依赖窗口焦点、剪贴板、Windows UI 环境和 Codex Desktop 窗口。
- 本轮未真实授权运行 send-with-approval。

## 3.13 Three internal run tests

完成程度：

- `.codex-handoff/internal-runs/internal-run-summary.json` 显示 `allExpectationsMet=true`。
- Round 1: `goNoGo=go`。
- Round 2: `goNoGo=review-required`。
- Round 3: `goNoGo=no-go`。

证据位置：

- `.codex-handoff/internal-runs/internal-run-summary.json`
- `.codex-handoff/internal-runs/round-1/run-summary.json`
- `.codex-handoff/internal-runs/round-2/run-summary.json`
- `.codex-handoff/internal-runs/round-3/run-summary.json`
- `.codex-handoff/runs/desktop-automation-system-audit.json`

能怎么用：

- 验证本地 review/go-no-go/feedback 逻辑能区分合规结果、缺验证/evidence 结果、边界违规结果。

不能怎么用：

- 不能证明真实 Codex 被发送或执行。
- 不能证明 Codex Desktop UI 粘贴/发送环境真实可用。

风险和边界：

- internal tests 使用 mock result/fixture，不调用 codex CLI，不运行 codex exec，不创建 worktree，不连接 workflow runner。

## 3.14 System audit & repair

完成程度：

- `.codex-handoff/runs/desktop-automation-system-audit.json` 显示 `status=passed`，并记录 internal runs allExpectationsMet=true、UI markers found、安全字段 false。
- `docs/CODEX_DESKTOP_READY_STATE_RESET.md` 和 `phase-267a-desktop-automation-ready-state-reset` 记录 Ready State Reset，将 Round 3 mock no-go 从当前可操作状态移开。
- 本轮 `codex:desktop:status` 显示 `readyStateResetActive=true`、`latestGoNoGo=standby-ready`、`currentBlocker=none`。

证据位置：

- `.codex-handoff/runs/desktop-automation-system-audit.json`
- `.codex-handoff/runs/desktop-automation-system-audit.md`
- `.codex-handoff/runs/latest-ready-state-reset.json`
- `apps/ai-gateway-service/evidence/phase-267a-desktop-automation-ready-state-reset.json`

能怎么用：

- 用 audit 判断桌面自动化文件桥、internal tests、UI markers、安全字段是否仍符合预期。
- 用 Ready State Reset 区分历史 mock no-go 与当前 standby-ready。

不能怎么用：

- 不能把 audit passed 写成真实发送 passed。
- 不能把 reset 写成修复真实 Codex 失败。

风险和边界：

- audit 证明的是本地文件/状态/内部 mock 流程，不是外部 Codex Desktop 真实执行。

# 4. 当前实际使用方式

## 4.1 每天怎么启动

1. 在项目根目录运行 `cmd /c pnpm run dev:phase7b` 启动本地服务。
2. 运行 `cmd /c pnpm run status:phase10a` 确认 managed dev 是否 running。
3. 运行 `cmd /c pnpm run health:phase12a` 确认 `/health/check` 是否 ready。
4. 运行 `cmd /c pnpm run doctor:phase13a` 做状态和 workspace check。

本轮真实结果：

- status: running。
- health: passed。
- doctor: passed。

## 4.2 打开 /ui 看哪里

打开 `http://127.0.0.1:3100/ui`。先看：

- Setup Wizard / readiness。
- Personal Operator Console quick entry。
- 当前状态卡。
- Decision Dashboard。
- Action Queue。
- Review & Evidence Loop。
- Knowledge/RAG 区域。
- Auto Loop Status Panel。
- Controlled Codex Desktop Automation。

## 4.3 怎么看 Personal Operator Console

Personal Operator Console 是当前个人自用主入口。看它时先确认：

- 是否仍是 preview-only。
- 当前服务是否 ready。
- 当前 workspace 是否 dirty。
- 是否存在 current blocker。
- 下一步是否只是文档/报告/verifier，还是跨入真实执行。
- 是否保留 no real Codex exec、no codex CLI、no workflow runner、no worktree creation、no auto commit/push。

## 4.4 怎么看 Action Queue

Action Queue 用于把 Decision Dashboard 输出变成下一条任务。读取：

- task title。
- scope。
- allowed files。
- blocked files。
- required commands。
- expected evidence。
- stop conditions。

当前 outbox latest task：

- path: `.codex-handoff/outbox/latest-codex-task.md`
- metadata: `.codex-handoff/outbox/latest-codex-task.json`
- mode: `manual-handoff-only`
- executionEnabled: false
- codexExecInvoked: false

## 4.5 怎么生成下一条 Codex 任务

从 Decision Dashboard 选择一个小范围、可验证、可回滚的下一步，把它写成 Action Queue task。任务应包含：

- task id/title。
- context。
- allowed files。
- blocked scope。
- hard boundaries。
- verification commands。
- evidence expectations。
- expected final answer format。

生成后写入 `.codex-handoff/outbox/latest-codex-task.md/json`，但这仍只是 handoff，不代表执行。

## 4.6 怎么发送/复制给 Codex Desktop

可选方式：

- dry-run: `cmd /c pnpm run codex:desktop:send -- --dry-run`
- copy-only: `cmd /c pnpm run codex:desktop:send -- --copy-only`
- paste-only: `cmd /c pnpm run codex:desktop:send -- --paste-only`
- send-with-approval: `cmd /c pnpm run codex:desktop:send -- --send --confirm-send`

本轮未执行真实 send-with-approval。send-with-approval 只是把任务发送到 Codex Desktop UI，不等于允许 commit/push，不等于 execution completed，不等于 Codex 已完成任务。

## 4.7 怎么导入 Codex 返回结果

如果有真实 Codex/人工结果，应导入 inbox：

- 从剪贴板导入：`cmd /c pnpm run codex:desktop:ingest -- --from-clipboard`
- 从文件导入：`cmd /c pnpm run codex:desktop:ingest -- --from-file .codex-handoff/inbox/latest-codex-result.md`

导入会写：

- `.codex-handoff/inbox/latest-codex-result.md`
- `.codex-handoff/inbox/latest-codex-result.json`

当前 latest inbox 是 Round 3 mock Codex Result，不是真实 Codex 执行结果。

## 4.8 怎么 review

运行：

```powershell
cmd /c pnpm run codex:desktop:review
```

读取：

- `.codex-handoff/review/latest-desktop-review.json`
- `.codex-handoff/review/latest-desktop-review.md`
- `.codex-handoff/review/latest-feedback-to-codex.md`

Review 重点：

- 是否修改 legacy。
- 是否创建 PROJECT_CONTEXT.md。
- 是否声称调用 codex CLI/codex exec。
- 是否创建 worktree。
- 是否连接 workflow runner。
- 是否 commit/push/PR/release。
- 是否泄漏 API key。
- 是否把 preview-only 写成 production-ready。
- 是否补齐 executed commands、verification result、evidence path、blocker、A-M summary。

## 4.9 怎么看 go/no-go

先看 `codex:desktop:status`：

- `latestGoNoGo`
- `currentBlocker`
- `recommendedNextAction`
- `readyStateResetActive`
- `latestReview.ignoredByReadyStateReset`

本轮真实 status 显示：

- latestGoNoGo: standby-ready
- currentBlocker: none
- readyStateResetActive: true
- latest historical review: no-go, ignoredByReadyStateReset=true

因此当前 blocker 可以写 none，但必须同时说明 workspace dirty 和 latest inbox/review 的 mock no-go 历史被 reset 归档；不能把 workspace 写成 clean。

## 4.10 怎么停止

停止本地服务：

```powershell
cmd /c pnpm run stop:phase9c
```

必须停止或暂停的情况：

- 任务要求修改 `legacy/`。
- 任务要求创建 `PROJECT_CONTEXT.md`。
- 任务要求真实 `codex exec` 或 codex CLI。
- 任务要求 worktree/workflow runner。
- 任务要求自动 commit/push/PR/release。
- 任务把 readiness 写成 execution completed。
- 任务把 mock/internal test 写成真实执行。
- 任务要求生产级 vector RAG/GraphRAG 但没有新 mainline 和验证。
- evidence 缺失或 verifier 失败。

# 5. 当前自动化程度评估

建议分层：

- Level 0: 手工。
- Level 1: 任务模板。
- Level 2: 任务生成 + handoff。
- Level 3: 受控桌面自动化。
- Level 4: 人工批准 one-shot。
- Level 5: 无人值守自动开发。

当前整体处于 Level 3: 受控桌面自动化 readiness/preview baseline。部分能力已经具备 Level 2/3 的本地自动化，但没有进入 Level 4 的真实人工授权 one-shot 执行，也没有进入 Level 5。

已自动化或半自动化：

- task generation: Agent Workforce Preview 和 handoffNextTask 支持任务包/下一条任务生成。
- outbox: `.codex-handoff/outbox/latest-codex-task.md/json`。
- copy-only: `codex:desktop:send -- --copy-only`。
- paste-only: `codex:desktop:send -- --paste-only`，依赖 Codex Desktop 窗口。
- ingest: `codex:desktop:ingest`。
- review: `codex:desktop:review`。
- go/no-go: review core 生成本地判断。
- feedback: `latest-feedback-to-codex.md`。
- internal tests: `codex:desktop:test:internal`。
- audit: `verify:codex-desktop-automation-system-audit`。
- Ready State Reset: reset historical mock no-go to standby-ready。

未自动化：

- real Codex exec。
- codex CLI。
- worktree。
- workflow runner。
- auto commit/push/PR/release。
- unattended multi-step execution。
- 自动应用外部 patch。
- 自动 release。

保守判断：

- 当前不是 Level 4，因为本轮没有执行 send-with-approval 的真实授权发送。
- 当前不是 Level 5，因为系统没有无人值守自动开发、自动改代码、自动 commit/push/PR/release。

# 6. 受控 Codex Desktop 自动化现状

## 6.1 codex:desktop:status

命令：

```powershell
cmd /c pnpm run codex:desktop:status
```

本轮真实结果：

- status: ready。
- mode: read-only-desktop-automation-status。
- outboxTaskExists: true。
- outboxTaskJsonExists: true。
- inboxResultExists: false，因为 Ready State Reset active。
- latestGoNoGo: standby-ready。
- currentBlocker: none。
- currentMode: dry-run / copy-only / paste-only / send-with-approval / inbox review。
- executionEnabled=false。
- codexExecInvoked=false。
- codexCliInvoked=false。
- workflowRunnerEnabled=false。
- worktreeCreated=false。
- autoCommit=false。
- autoPush=false。
- readyStateResetActive=true。

注意：首次在 sandbox 内运行时因 pnpm 访问用户 temp path 出现 EPERM，随后按权限规则用 escalated rerun，取得真实状态。这不是 Codex 执行授权，也不是业务能力扩大。

## 6.2 dry-run

命令：

```powershell
cmd /c pnpm run codex:desktop:send -- --dry-run
```

作用：

- 只检查 outbox markdown/json 是否存在。
- 检查任务 JSON 是否保留 `executionEnabled=false`、`codexExecInvoked=false`、no auto commit/push、no workflow runner、no worktree creation。

边界：

- 不复制剪贴板。
- 不聚焦 Codex Desktop。
- 不粘贴。
- 不发送。
- 不调用 codex CLI。

## 6.3 copy-only

命令：

```powershell
cmd /c pnpm run codex:desktop:send -- --copy-only
```

作用：

- 读取 latest outbox task。
- 通过剪贴板复制任务文本。

边界：

- 不粘贴到 Codex Desktop。
- 不发送。
- 不代表 Codex 执行。

## 6.4 paste-only

命令：

```powershell
cmd /c pnpm run codex:desktop:send -- --paste-only
```

作用：

- 复制 task。
- 尝试寻找 Codex Desktop 窗口。
- 聚焦窗口并粘贴，但不按 Enter 发送。

边界：

- 如果窗口不存在，应返回 blocker `codex_desktop_window_not_found`。
- 不应误报发送成功。

## 6.5 send-with-approval

命令形态：

```powershell
cmd /c pnpm run codex:desktop:send -- --send --confirm-send
```

作用：

- 显式双确认后把 latest outbox task 发送到 Codex Desktop UI。
- 写 desktop send record。

本轮状态：

- 是否真实发送过 Codex：否。
- 是否调用 codex CLI：否。
- codexExecInvoked=false。
- workflowRunnerEnabled=false。
- worktreeCreated=false。
- autoCommit=false。
- autoPush=false。

边界：

- send-with-approval 只是发送任务到 Codex Desktop UI。
- 不等于允许 commit/push。
- 不等于 execution completed。
- 不等于 Codex 已返回合格结果。
- 发送后仍必须等待结果进入 inbox，再 review/go-no-go。

## 6.6 ingest

作用：

- 从 clipboard 或 file 导入 Codex/人工结果。
- 写 `.codex-handoff/inbox/latest-codex-result.md/json`。

边界：

- 导入不自动判定 passed。
- 导入后必须 review。

## 6.7 review

作用：

- 读取 inbox result、metadata 和 outbox task JSON。
- 输出 review JSON/Markdown 和 feedback。
- 给出 go/no-go。

边界：

- review 不自动改代码。
- review 不自动 commit/push。
- review 不把 missing evidence 当成 passed。

## 6.8 go/no-go

当前：

- active status: standby-ready。
- historical latest review: no-go, ignoredByReadyStateReset=true。

含义：

- 当前可生成/复制下一条任务或等待新的 Codex result inbox。
- 不能把历史 mock no-go 当成真实 Codex 失败。
- 不能把 reset 当成真实修复或真实执行完成。

## 6.9 loop dry-run

`codex:desktop:loop` 用于组合 status/send/ingest/review 的本地闭环。它应保持 dry-run/manual 语义，不应默认真实发送或执行。

## 6.10 internal tests

`codex:desktop:test:internal` 使用本地 mock result/fixture 运行三轮测试。它验证本地审查闭环识别：

- 合规结果。
- 缺验证/evidence 结果。
- 边界违规结果。

它不发送给 Codex Desktop，不调用 codex CLI，不运行 codex exec。

## 6.11 system audit

`verify:codex-desktop-automation-system-audit` 检查：

- audit JSON/Markdown。
- internal run summary。
- round 1/2/3 summary。
- UI markers。
- root/service package scripts。
- 安全字段。
- 文档是否没有把 mock/internal test 写成真实执行。

# 7. 三轮内部测试结果

## 7.1 Round 1

输入：

- `.codex-handoff/internal-runs/round-1/input-task.md`
- `.codex-handoff/internal-runs/round-1/mock-codex-result.md`
- 模拟正常合规结果：只读检查、modified files none、完整命令列表、验证结果、evidence 说明、blocker none、边界否定项完整。

预期：

- goNoGo=go。
- boundaryViolationCount=0。
- verificationGapCount=0。
- evidenceGapCount=0。

实际结果：

- `.codex-handoff/internal-runs/round-1/run-summary.json` 显示 `goNoGo=go`。
- `codexExecInvoked=false`。
- `codexCliInvoked=false`。
- `workflowRunnerEnabled=false`。
- `worktreeCreated=false`。
- `autoCommit=false`。
- `autoPush=false`。

## 7.2 Round 2

输入：

- `.codex-handoff/internal-runs/round-2/input-task.md`
- `.codex-handoff/internal-runs/round-2/mock-codex-result.md`
- 模拟缺少 verification/evidence 的结果，不含严重越界行为。

预期：

- goNoGo=review-required 或 human-review-required。
- verificationGapCount > 0 或 evidenceGapCount > 0。
- recommendedNextAction 要求 Codex 补齐验证命令/evidence 说明。

实际结果：

- `.codex-handoff/internal-runs/round-2/run-summary.json` 显示 `goNoGo=review-required`。
- recommendedNextAction 要求补齐验证命令、修改文件列表、验证结果、evidence 说明或 A-M 总结。
- 安全字段仍为 false。

## 7.3 Round 3

输入：

- `.codex-handoff/internal-runs/round-3/input-task.md`
- `.codex-handoff/internal-runs/round-3/mock-codex-result.md`
- 模拟边界违规：例如声称修改 legacy、调用 codex CLI 或 codex exec。

预期：

- goNoGo=no-go。
- boundaryViolationCount > 0。
- recommendedNextAction 要求 stop/reject/fix boundary violation。
- feedback-to-codex 明确指出违规原因。

实际结果：

- `.codex-handoff/internal-runs/round-3/run-summary.json` 显示 `goNoGo=no-go`。
- recommendedNextAction: stop and reject。
- `codexExecInvoked=false`、`codexCliInvoked=false` 等安全字段在本地系统摘要中仍为 false。

## 7.4 allExpectationsMet

`.codex-handoff/internal-runs/internal-run-summary.json` 显示：

- `allExpectationsMet=true`。
- `codexExecInvoked=false`。
- `codexCliInvoked=false`。
- `workflowRunnerEnabled=false`。
- `worktreeCreated=false`。
- `autoCommit=false`。
- `autoPush=false`。

三轮为什么重要：

- Round 1 证明本地 review 能接受完整合规结果。
- Round 2 证明本地 review 能识别缺验证/evidence 的不完整结果。
- Round 3 证明本地 review 能识别边界违规并给出 no-go。

为什么这不等于真实 Codex 执行：

- 输入是本地 mock result/fixture。
- 没有发送到 Codex Desktop。
- 没有读取真实 Codex 输出。
- 没有调用 codex CLI。
- 没有执行 codex exec。
- 没有创建 worktree。
- 没有连接 workflow runner。
- 没有 commit/push/PR/release。

# 8. 当前 evidence / verifier 体系

Evidence 存在位置：

- `apps/ai-gateway-service/evidence/`: phase evidence JSON/Markdown。
- `.codex-handoff/runs/`: bridge/loop/audit/run summary。
- `.codex-handoff/internal-runs/`: mock internal test summaries。
- `.codex-handoff/outbox/`: latest handoff task。
- `.codex-handoff/inbox/`: latest result intake。
- `.codex-handoff/review/`: latest review/feedback。

Verifier 如何证明完成：

- 每个 phase verifier 通常检查 docs、UI markers、scripts、required boundaries、safety fields、no plaintext secrets 等。
- 本轮新增 verifier 会检查报告存在、evidence 存在、JSON status=passed、章节完整、关键边界存在、禁止性夸大不存在、JSON safety 全部 false。

本轮已知关键命令结果：

- `cmd /c pnpm run status:phase10a`: passed/running。
- `cmd /c pnpm run health:phase12a`: passed/ready。
- `cmd /c pnpm run doctor:phase13a`: passed。
- `cmd /c pnpm run codex:desktop:status`: passed after sandbox EPERM rerun with approval; status ready。

需要回归验证的关键命令：

- `cmd /c pnpm run verify:phase267a-project-readthrough-future-report`
- `cmd /c pnpm run verify:phase267a-architecture-report`
- `cmd /c pnpm run verify:codex-desktop-automation-system-audit`
- `cmd /c pnpm run verify:phase245a-personal-value-closure`
- `cmd /c pnpm run verify:phase255a-personal-knowledge-value-closure`
- `cmd /c pnpm run verify:phase265a-codex-one-shot-readiness-closure`
- `cmd /c pnpm run verify:phase107a-secret-safety`
- `cmd /c pnpm -r --if-present check`

哪些 evidence 是最新事实：

- Phase 245A personal value closure: passed, generated 2026-04-30T04:06:04.213Z。
- Phase 255A personal knowledge value closure: passed, generated 2026-04-30T04:06:03.865Z。
- Phase 265A one-shot readiness closure: passed, generated 2026-04-30T04:06:03.830Z。
- Phase 267A desktop automation ready state reset: passed, generated 2026-04-30T04:05:05.493Z。
- `.codex-handoff/runs/desktop-automation-system-audit.json`: passed, checked 2026-04-30T04:05:24.358Z。
- 本轮 `codex:desktop:status`: ready, generated 2026-04-30T04:21:20.884Z。

如何避免 stale evidence 误判：

- 优先看最新 passed evidence 和本轮命令结果。
- handoff/inbox/review 文件不能单独代表 sealed completion。
- failed/skipped/mock/no-go 文件必须标注为历史或当前 blocker，不能当作 passed。
- 旧商业报告只能作为商业判断参考，不能覆盖当前技术状态。

dirty workspace 如何处理：

- 本轮 `git status --short` 显示大量 pre-existing modified/untracked files。
- 报告必须写 workspace dirty。
- 不允许写工作区为 clean 状态。
- 不自动 rollback。
- 不碰 unrelated dirty changes。

# 9. 当前风险和限制

- Workspace dirty，不能声称 clean。
- 当前 `/ui` 仍依赖本地服务运行。
- Desktop automation 依赖窗口焦点、剪贴板、Codex Desktop 窗口、Windows UI 环境和用户当前桌面状态。
- send-with-approval 还未在本轮真实授权运行。
- internal tests 是 mock，不是真实 Codex 执行。
- review 依赖 Codex 返回内容质量；缺命令、缺 evidence、缺 modified files、缺 boundary review 都会影响 go/no-go。
- Knowledge/RAG 仍是 self-use preview。
- 没有生产级 vector RAG。
- 没有 GraphRAG。
- 没有企业 ACL / 权限同步。
- 没有多租户 SaaS。
- 没有企业级密钥保险箱。
- 没有真正的 workflow runner。
- 没有 real Codex exec。
- 没有 codex CLI 调用。
- 没有 worktree 执行。
- 没有 auto commit/push/PR/release。
- UI 仍可能需要继续中文化和可用性优化。
- Ready State Reset 只是把历史 mock no-go 从当前状态中移开，不等于真实执行成功。
- MiMo/OpenAI-compatible provider path 是未来 smoke 方向，本轮没有改变默认 NVIDIA `/chat` 主链。

# 10. 未来还可以做到的方向

## 10.1 短期方向

### Ready State Reset：清理 Round 3 mock no-go latest 状态

- 价值：让 Auto Loop Status Panel 从历史 mock no-go 中恢复为 standby-ready，避免误判当前 blocker。
- 前置条件：确认 reset 不删除 evidence、不把 failed evidence 写成 passed、不触发真实 send。
- 风险：如果报告不说明历史 no-go 来源，用户可能误读 reset 为真实修复。
- 不应该现在扩大做的原因：reset 已基本完成；下一步应避免继续围绕 mock 状态无限扩展。
- 推荐优先级：高，作为日常状态卫生。

### 中文 UI 完整优化

- 价值：降低个人日常使用成本，减少 preview/execution 边界误解。
- 前置条件：梳理 `/ui` 信息层级和中文 copy，不改变业务逻辑。
- 风险：改 UI 时容易碰到大文件 `consolePage.js`，需要小范围 patch 和截图验证。
- 不应该现在扩大做的原因：当前任务只做报告和验证，不新增 UI 功能。
- 推荐优先级：高。

### Action Queue 一键复制优化

- 价值：减少手动复制 outbox 的操作成本。
- 前置条件：确认 copy-only 行为不发送、不粘贴、不写 execution success。
- 风险：剪贴板依赖用户环境。
- 不应该现在做的原因：本轮不新增业务功能。
- 推荐优先级：中高。

### Auto Loop Status Panel 更清楚

- 价值：把 standby-ready、historical no-go ignored by reset、current blocker、next action 更清楚地呈现。
- 前置条件：保留 no real Codex exec、no codex CLI、no workflow runner、no worktree creation、no auto commit/push 文案。
- 风险：状态说明如果写得过强会夸大自动化成熟度。
- 不应该现在做的原因：本轮报告可先确认架构和方向。
- 推荐优先级：高。

### Codex Desktop send-with-approval 首次人工授权试验

- 价值：验证任务能否真实送到 Codex Desktop UI。
- 前置条件：用户显式授权；当前 task 安全；窗口存在；allowed files 明确；workspace dirty 风险已判断；send 只是发送，不是执行完成。
- 风险：窗口焦点/剪贴板/误发送；结果质量不确定；仍需 inbox/review/go-no-go。
- 不应该默认现在做的原因：本轮明确禁止真实发送 Codex。
- 推荐优先级：中，仅在下一轮明确授权后。

### MiMo OpenAI-compatible provider smoke

- 价值：验证未来 OpenAI-compatible provider path，不改变默认 NVIDIA `/chat` 主链。
- 前置条件：安全环境变量、无明文 key 写入、smoke 命令与 evidence 边界明确。
- 风险：provider 配置、网络、模型列表兼容性、误改默认主链。
- 不应该现在做的原因：本轮只做文档通读、报告、验证。
- 推荐优先级：中高。

### Knowledge source import 真实资料体验

- 价值：验证用户真实资料导入、引用和 freshness 的自用价值。
- 前置条件：选定非敏感资料；定义 source inventory；避免导入大规模噪声。
- 风险：资料过时、引用缺失、误把 self-use preview 写成 production RAG。
- 不应该现在扩大做的原因：需要单独设计 trial 和验收。
- 推荐优先级：中高。

## 10.2 中期方向

### 真实 one-shot execution trial，必须人工批准

- 价值：验证受控单次执行闭环能否从 task 到 result 到 review 完成。
- 前置条件：explicit approval、clean 或可解释 dirty workspace、allowed files policy、rollback/stop、secret scan、evidence plan。
- 风险：代码修改风险、上下文偏差、结果不完整、dirty overlap。
- 不应该立即做的原因：当前还没有首次真实 send-with-approval 试验和 allowed files policy。
- 推荐优先级：中。

### desktop send result 自动归档

- 价值：避免 latest 文件覆盖造成状态误读。
- 前置条件：设计 archive path、metadata、latest pointer 和 reset 规则。
- 风险：归档噪声、stale evidence confusion。
- 不应该立即做的原因：先完成首次真实 send trial 更能暴露真实需要。
- 推荐优先级：中。

### 更严格 secret scan

- 价值：降低 evidence/docs/handoff 中泄漏 key 的风险。
- 前置条件：扩展 secret patterns、明确 false positive 处理、保持 `.env` 不输出。
- 风险：误报导致阻塞；漏报导致安全风险。
- 不应该立即做的原因：当前 Phase 107A secret safety passed，但真实 provider smoke 前应加强。
- 推荐优先级：高。

### allowed files policy

- 价值：为未来真实 Codex one-shot、worktree 或 PR flow 提供文件范围约束。
- 前置条件：定义可写目录、禁止目录、任务级例外、review enforcement。
- 风险：策略过宽会放大自动改代码风险；过窄会影响效率。
- 不应该立即做的原因：本轮不进入真实执行。
- 推荐优先级：高。

### task diff preview

- 价值：真实应用前让用户看到 planned/actual diff。
- 前置条件：有统一 result intake 和 changed files schema。
- 风险：diff 与真实工作区状态不一致。
- 不应该立即做的原因：尚未开启真实修改。
- 推荐优先级：中。

### evidence dashboard

- 价值：把 phase evidence、latest status、audit、secret safety、user journey 汇总为可视面板。
- 前置条件：定义 evidence manifest 和 freshness ordering。
- 风险：UI 复杂度增加；旧 evidence 误导。
- 不应该立即做的原因：先稳定报告和架构边界。
- 推荐优先级：中。

### model provider management

- 价值：让 NVIDIA、OpenAI-compatible、MiMo 等 provider 的配置、smoke、可用性更清楚。
- 前置条件：provider registry UI、runtime secret masking、smoke evidence。
- 风险：泄漏 key、误改默认主链、真实 provider 成本。
- 不应该立即做的原因：本轮不能改默认 NVIDIA `/chat`。
- 推荐优先级：中。

### MiMo / OpenAI-compatible provider adapter

- 价值：未来可扩展非 NVIDIA provider。
- 前置条件：OpenAI-compatible config、model list/probe、masked key handling。
- 风险：兼容差异、失败恢复、默认 provider 混乱。
- 不应该立即做的原因：应先跑独立 smoke，不改主链。
- 推荐优先级：中高。

### local knowledge import lifecycle

- 价值：让真实资料导入、更新、废弃、引用、freshness 形成闭环。
- 前置条件：source inventory、metadata、stale rule、manual cleanup。
- 风险：知识库噪声、引用错误。
- 不应该立即做的原因：当前 self-use preview 足够支持报告，需要单独 trial。
- 推荐优先级：中高。

## 10.3 长期方向

### controlled worktree execution

- 价值：隔离真实代码修改，降低主工作区污染。
- 前置条件：clean baseline、allowed files policy、secret scan、diff preview、review gate。
- 风险：worktree 同步、冲突、误删、权限。
- 不应该现在做的原因：当前硬边界明确 no worktree creation。
- 推荐优先级：低到中，长期。

### workflow runner integration

- 价值：把规划、执行、验证和证据自动串联。
- 前置条件：runner protocol、安全 gate、cancellation、audit log、human approval。
- 风险：无人值守风险、错误扩大、环境依赖。
- 不应该现在做的原因：当前硬边界 no workflow runner。
- 推荐优先级：低，长期。

### PR creation with approval

- 价值：让受控修改进入可审查协作流程。
- 前置条件：git remote、branch policy、diff review、CI gate、explicit approval。
- 风险：误推送、敏感文件、未审查代码进入远程。
- 不应该现在做的原因：当前禁止 auto commit/push/PR。
- 推荐优先级：低到中，长期。

### team/multi-user permissions

- 价值：支持团队使用和角色权限。
- 前置条件：auth、tenant model、ACL、audit retention、安全评审。
- 风险：数据隔离和权限绕过。
- 不应该现在做的原因：当前不是生产级 SaaS。
- 推荐优先级：低，长期。

### enterprise key vault

- 价值：生产级密钥存储和轮换。
- 前置条件：加密存储、访问控制、audit、rotation。
- 风险：实现复杂、安全责任高。
- 不应该现在做的原因：当前 `.env.example` 只是 placeholder template。
- 推荐优先级：中长期高。

### vector RAG / GraphRAG

- 价值：增强大规模知识检索、结构化关系查询。
- 前置条件：embedding provider、vector store、index lifecycle、permission-aware retrieval、evaluation。
- 风险：成本、幻觉、权限泄漏、过度承诺。
- 不应该现在做的原因：当前明确 no production vector RAG、no GraphRAG。
- 推荐优先级：中长期。

### audit dashboard

- 价值：可视化 phase evidence、runner logs、secret safety、approval records、go/no-go。
- 前置条件：统一 evidence schema 和 retention。
- 风险：旧数据误读、敏感信息展示。
- 不应该现在做的原因：先保证 evidence schema 稳定。
- 推荐优先级：中。

### SaaS / private deployment

- 价值：支持多人或客户环境部署。
- 前置条件：auth、tenant isolation、secret vault、rate limit、audit retention、安全评审、deployment automation。
- 风险：生产责任、合规、安全。
- 不应该现在做的原因：当前本地/内部测试定位明确。
- 推荐优先级：低，长期。

### commercial pilot package

- 价值：以保守方式展示本地工作台和 AI 项目协作能力。
- 前置条件：demo boundary、pricing/offer、support plan、known limits。
- 风险：商业宣传夸大 preview 能力。
- 不应该立即做的原因：先完成真实 send trial、Knowledge import trial 和 UI polish 更稳。
- 推荐优先级：中低。

# 11. 下一步推荐路线

## A. 停在 readiness，继续自用观察

- 优点：风险最低，适合继续验证 daily workflow。
- 风险：不推进真实桌面发送或 provider smoke，实际闭环价值增长有限。
- 适用：用户只想稳定使用和整理状态。

## B. Ready State Reset，清理 mock no-go latest 状态

- 优点：已经完成基础封板，能让 current blocker 回到 none/standby-ready。
- 风险：需要持续说明历史 mock no-go 不是被“修复成 passed”。
- 适用：作为当前最稳的状态整理路线。

## C. 人工授权一次 Codex Desktop send-with-approval

- 优点：验证真实任务送达 Codex Desktop UI。
- 前置条件：用户显式授权；任务只读或安全；allowed files 明确；workspace dirty 风险说明；Codex Desktop 窗口可控。
- 风险：窗口焦点/剪贴板/误发送；结果质量不确定；send 不等于执行完成。
- 适用：下一轮明确要求真实发送时。

## D. MiMo OpenAI-compatible provider 接入 smoke

- 优点：验证未来 provider 扩展，不改变默认 NVIDIA 主链。
- 前置条件：安全 key handling、OpenAI-compatible endpoint、smoke evidence。
- 风险：泄密、误改默认 provider、网络失败。
- 适用：需要扩展模型供应商时。

## E. Knowledge source real import trial

- 优点：验证真实资料导入、引用和 freshness 的自用价值。
- 前置条件：非敏感资料、source inventory、query template、citation report。
- 风险：资料噪声、引用错误、误写成生产级 RAG。
- 适用：想增强每日知识助手价值时。

## F. 商业化 demo pack

- 优点：能整理演示材料和销售口径。
- 前置条件：严格区分 verified demo、preview、design-only、not implemented。
- 风险：容易夸大 SaaS、自动开发、RAG 成熟度。
- 适用：技术边界报告稳定后。

推荐路线：

最稳路线是 B -> E -> D -> C。理由：

- B 已经把 Round 3 mock no-go 从当前状态中移开，且不扩大能力。
- E 能提升个人自用价值，风险低于真实发送。
- D 能验证 MiMo/OpenAI-compatible provider path，但必须不改默认 NVIDIA `/chat`。
- C 是真实桌面发送试验，价值高但环境和边界风险更大，应在明确授权后做。

本报告不推荐现在直接进入真实 Codex execution、worktree、workflow runner 或 auto commit/push/PR/release。

# 12. 结论

当前项目已经达到本地 AI Gateway + 个人操作台 + 自用 Knowledge/RAG + Codex handoff/review + 受控桌面自动化 readiness/audit 的阶段；还没有达到生产级 SaaS、无人值守自动开发、真实 Codex exec、codex CLI、workflow runner、worktree execution、自动 commit/push/PR/release、生产级 vector RAG 或 GraphRAG 的阶段。下一步最稳行动是继续保持 readiness 边界，先完成 Ready State Reset 后的状态卫生、Knowledge source real import trial 和 MiMo/OpenAI-compatible smoke，再由用户显式授权评估首次真实 Codex Desktop send-with-approval。
