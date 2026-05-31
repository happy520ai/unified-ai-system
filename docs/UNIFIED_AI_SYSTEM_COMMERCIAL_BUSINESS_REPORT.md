# Unified AI System Commercial Business Report

Generated for Phase 236A: Unified AI System Commercial Readthrough / Business Report.

Scope: this report reads the current `unified-ai-system` repository as a commercial product candidate. It is based on current code, docs, scripts, and evidence. It does not add product capability, does not enable execution, and does not change runtime behavior.

Commercial status legend used throughout this report:

- A. 已验证可演示: code/evidence supports this today and it can be shown to customers as a demo.
- B. 已实现但需要谨慎说明: code exists, but it is preview/local/manual/gated and must be described carefully.
- C. 设计中 / 半自动: docs or scripts describe a future/semi-automated path, but it is not a product promise.
- D. 未完成 / 不能承诺: do not sell or promise this as completed.

Phase 236A hard boundaries for this commercial report:

- 不修改 `legacy/`。
- 不创建 `PROJECT_CONTEXT.md`。
- 不修改默认 NVIDIA `/chat` 主链。
- 不调用 Codex 自动执行开发任务。
- 不调用 oh-my-codex / OMX / team / ralph。
- 不创建 worktree。
- 不接 workflow run。
- 不自动 commit / push。
- 不写入明文 API Key。
- 不夸大未完成能力。
- 不把 preview / design-only 写成 production-ready。
- 不把 approval-preview 写成真实执行授权。
- 不把 controlled bridge 写成无人值守自动执行系统。

## 1. Executive Summary / 商业摘要

一句话定位:

> `unified-ai-system` 是一个本地 AI Gateway + Agent Workforce + Codex handoff/feedback bridge 的 AI 开发工作台，面向需要把 AI 任务规划、代码协作、结果审查和内部工具自动化串起来的小团队/企业。

这个系统不是普通聊天机器人。它更像一个本地 AI 开发指挥台: 用户输入一个业务目标，系统把目标拆成产品、架构、前端、后端、测试、审查等角色视角的计划，生成可导出的任务包，再通过本地 `.codex-handoff` 文件桥把任务交给 Codex 或人工代码助手，最后把结果导回系统做审查和反馈。

它要卖的不是“AI 替你全自动写完系统”。当前最真实的可销售价值是:

- 把业务需求变成结构化开发任务包。
- 把企业内部资料变成可检索、可引用、可注入 AI 对话的本地知识库。
- 让非技术负责人更容易和 AI coding agent / Codex 协作。
- 让 AI 参与研发的过程有计划、有交接、有审查、有证据。
- 让本地团队用更安全的方式试点 AI 自动化。
- 给企业内部 AI 工具建设提供一个可控、本地、可验证的起点。

为什么有商业价值:

- 小团队缺产品经理、架构师、测试、文档人员时，需要一个“AI 任务拆解器”。
- 企业内部 AI 使用通常散在 ChatGPT、Claude、Codex、脚本、文档里，缺少统一控制台。
- 企业内部知识通常散在制度文档、项目说明、交付记录、客服/运营资料里，无法被 AI 稳定引用。
- AI coding agent 的最大风险不是不会写代码，而是无边界、无审查、无留痕。
- 这个项目已经把 planning、handoff、result import、feedback、evidence、verification 这些链路做成了一个可演示的本地闭环。

当前做到什么程度:

- A. 已验证可演示: 本地服务、`/ui`、`/health/check`、Knowledge/RAG local retrieval、RAG chat、Agent Workforce Preview、模板、角色计划、保存历史、JSON/Markdown 导出、Codex handoff 文件生成、result inbox import、feedback 生成、dry-run/controlled evidence。
- B. 已实现但需要谨慎说明: Codex bridge、desktop BAT、continuous loop、explicit gated Codex one-shot scripts、workflow endpoints、knowledge/RAG、enterprise docs/checks。这些存在，但多为本地、预览、人工确认或显式安全门模式。
- C. 设计中 / 半自动: external runner、OMX-compatible handoff、approval record、runner queue、execution readiness、one-shot real Codex readiness、bridge status panel、task queue UI、safety dashboard。
- D. 未完成 / 不能承诺: 多用户 SaaS、生产级权限/租户隔离、企业密钥保险箱、无人值守自动执行、自动 commit/push、自动 PR、真实多 Agent 执行、生产级多 provider 调度、完整合规认证。

当前最适合卖给:

- 想试点 AI 研发流程的小型软件团队。
- 企业内部 IT / 自动化团队。
- AI 咨询和交付团队。
- 有频繁内部工具需求的电商/运营团队。
- 个人开发者或独立产品团队。

当前还不能怎么卖:

- 不适合直接卖成完整 SaaS。
- 不适合承诺无人值守自动开发。
- 不适合承诺生产级多租户和合规。
- 不适合承诺默认真实 Codex 执行。
- 不适合承诺不用人工审查。

## 2. Product Positioning / 产品定位

当前产品定位应该是:

> 本地 AI 开发与协作工作台。

它包含多个产品层:

1. AI Gateway  
   统一本地 AI 服务入口，当前默认 NVIDIA `/chat` 主链。它有健康检查、配置、provider runtime、knowledge/RAG 和 chat route，但当前不应被包装成生产级多 provider 调度平台。

2. AI 工作台  
   `/ui` 是客户演示入口，覆盖 setup readiness、Chat、Knowledge/RAG、Agent Workforce、保存/导出、边界提示。它是最容易让客户理解价值的产品面。

3. Knowledge Base / RAG 知识库工作台  
   这是另一个强商业支柱。当前系统已经有本地知识加载、知识源列表、keyword retrieve、RAG chat、citation、highlight、file/SQLite persistence，以及 vector/pgvector readiness boundary。它能把客户自己的制度、项目文档、产品资料、交付记录变成 AI 可检索的上下文资产。

4. Agent Workforce 任务规划器  
   当前最核心的差异化能力。它不是执行器，而是把业务目标拆成角色计划、clarification、consensus、review package、approval preview、handoff package。

5. Codex 协作中枢  
   通过 `.codex-handoff/outbox`、`.codex-handoff/inbox`、review、feedback 文件，把 Codex 从一个外部聊天/代码工具变成可交接、可审查、可反馈的协作对象。

6. 本地开发自动化控制台  
   `tools/phase9c`、`tools/agent-workforce`、desktop BAT、dry-run loop、status/health/doctor 让本地运营可重复。

7. 企业内部 AI 工具编排平台雏形  
   代码和文档已经有 enterprise、governance、setup readiness、audit export、verification matrix、evidence manifest 等线索，但当前只能说是雏形和本地/内部测试基线，不是完整企业平台。

必须明确:

- 当前更像“本地 AI 开发与协作工作台”。
- 当前不是成熟 SaaS 多租户平台。
- 当前不是无人值守 Agent 执行系统。
- 当前不是 production-ready 的外部 runner。
- 当前不是自动化 CI/CD 发布平台。

最合适的产品包装:

> AI Development Command Center - Local Pilot Edition  
> AI 开发指挥台本地试点版

## 3. Target Customers / 目标客户

### 3.1 小型软件团队

典型痛点:

- 需求多、开发人少。
- 老板/产品直接丢需求给程序员，缺少结构化拆解。
- 测试、文档、验收经常滞后。
- 团队用 AI 工具但缺少统一流程。
- Codex 或代码助手输出后，没有标准审查和反馈格式。

购买动机:

- 用一个本地工具把“想法”变成“可交付任务包”。
- 降低团队沟通成本。
- 让 AI 辅助开发更可控。
- 让老板看到 AI 流程不是黑盒聊天，而是有计划、有证据。

可演示场景:

- 输入“做一个商品评论分析功能”。
- 选择 Feature Development 模板。
- 展示 CEO/PM/Architect/Frontend/Backend/QA/Reviewer 七角色计划。
- 导出 Codex handoff。
- 模拟 Codex result import，再生成 feedback。

付费意愿:

- 中等。小团队预算有限，但如果能节省产品拆解、测试和文档时间，愿意为试点包付费。
- 更适合项目制或低价团队订阅，不适合一上来卖高价企业版。

销售难点:

- 小团队可能更倾向直接用 ChatGPT/Codex/Cursor。
- 需要强调“流程控制、交接、审查、留痕”，而不是和代码补全工具比写代码速度。

状态判断:

- A. 已验证可演示: 任务规划、模板、导出、handoff、feedback demo。
- B. 已实现但需要谨慎说明: 本地 plan history 和 Codex bridge。
- D. 未完成 / 不能承诺: 团队多人协作、自动 PR、完整权限管理。

### 3.2 企业内部 IT / 自动化团队

典型痛点:

- 内部工具多，需求来自 HR、财务、运营、客服、销售。
- AI 接入分散，无法统一治理。
- 安全团队担心 API key、日志、文件外泄。
- 内部 IT 需要证明 AI 使用过程可审查。

购买动机:

- 本地部署和本地文件桥更容易进入内网试点。
- AI Gateway 可以作为统一入口雏形。
- Agent Workforce 可以把业务部门需求转成 IT 可审查任务。
- evidence/verification 可以支持内部验收。

可演示场景:

- 输入“为运营部门规划一个报表自动化工具”。
- 展示 setup readiness、health、Agent Workforce plan、review package。
- 展示 no auto commit/push、no secrets、approval-preview not execution approval。

付费意愿:

- 较高。企业内部 IT 愿意为部署、培训、定制模板、安全边界和验收报告付费。
- 更适合 Pilot + 私有化交付 + 年度维护。

销售难点:

- 会问权限、审计、SSO、租户隔离、密钥保险箱。
- 当前这些还不能完整承诺，只能作为路线图和定制方向。

状态判断:

- A. 已验证可演示: 本地服务、UI、health/doctor、evidence、secret-safety、Agent Workforce planning。
- B. 已实现但需要谨慎说明: enterprise docs/checks、audit/export 相关基础、local deployment docs。
- D. 未完成 / 不能承诺: production auth、tenant isolation、enterprise secret vault、rate limit、long-term audit retention。

### 3.3 电商 / 运营团队

典型痛点:

- 运营需求频繁，例如评论分析、商品文案、活动页、报表、客服知识库。
- 业务人员不会把目标拆成技术任务。
- 小功能依赖技术排期，响应慢。
- AI 能写方案，但不容易变成开发任务包。

购买动机:

- 业务负责人可以输入目标，得到可交给技术/Codex 的任务包。
- 可把“运营语言”翻译成“产品/前端/后端/测试/验收语言”。
- 可沉淀常见运营需求模板。

可演示场景:

- 商品评论分析功能规划。
- 活动落地页生成流程规划。
- 客服 FAQ 导入和知识/RAG 问答演示。
- 导出 Markdown 给 Codex 或技术人员。

付费意愿:

- 中等到较高，取决于是否能做行业模板。
- 运营团队本身未必买单，通常需要老板或技术负责人批准。

销售难点:

- 运营团队可能以为这是“直接生成完整系统”的工具。
- 必须解释当前是规划和交接工作台，不是自动开发外包机器人。

状态判断:

- A. 已验证可演示: 业务目标到开发任务包。
- B. 已实现但需要谨慎说明: Knowledge/RAG 本地文件能力、Codex bridge。
- C. 设计中 / 半自动: 行业模板库、结果审查面板。
- D. 未完成 / 不能承诺: 直接自动上线电商功能、直接连接所有平台数据。

### 3.4 AI 咨询 / 交付团队

典型痛点:

- 客户需求不清楚，AI 项目交付前期沟通成本高。
- 交付过程依赖个人经验，难标准化。
- 每个客户都要写方案、任务拆解、验收清单。
- AI 生成内容难留痕，客户不容易信任。

购买动机:

- 把系统作为咨询交付的“AI 项目规划和验收底座”。
- 用 Agent Workforce 生成标准交付包。
- 用 evidence/verification 形成可审查交付记录。
- 为客户定制模板，形成可复用资产。

可演示场景:

- 对一个客户需求生成完整任务包。
- 展示 Review Package、Approval Preview、Handoff Package。
- 展示 Evidence Inventory 和 verification commands。

付费意愿:

- 较高。咨询/交付团队会为能重复卖项目的工具付费。
- 更适合“软件授权 + 定制模板 + 培训”组合。

销售难点:

- 他们会要求白标、模板编辑、多项目空间、报告导出、客户权限。
- 当前需要作为路线图，不要承诺已完成。

状态判断:

- A. 已验证可演示: planning、handoff、evidence。
- B. 已实现但需要谨慎说明: local file bridge、manual loop、desktop BAT。
- C. 设计中 / 半自动: 定制行业模板、项目空间、报告中心。
- D. 未完成 / 不能承诺: 多客户 SaaS portal、白标权限体系、自动交付执行。

### 3.5 个人开发者 / 独立产品团队

典型痛点:

- 一个人要同时做产品、架构、前后端、测试、文档。
- 容易直接让 AI 写代码，但缺少计划和验收。
- 项目推进容易散，没有稳定工作流。

购买动机:

- 把系统当 AI 项目经理。
- 用模板快速拆任务。
- 用 Codex handoff 和 feedback 循环减少上下文丢失。

可演示场景:

- 输入一个独立产品 idea。
- 生成 MVP 任务包。
- 导出给 Codex。
- 导入结果，再继续反馈。

付费意愿:

- 较低到中等。
- 适合 Solo 低价版或买断试用包，不适合高价服务。

销售难点:

- 个人开发者可能更喜欢直接用 Cursor/Codex。
- 需要强调它不是替代 coding IDE，而是补足规划、交接、审查和留痕。

状态判断:

- A. 已验证可演示: 单人本地工作台。
- B. 已实现但需要谨慎说明: desktop automation、manual loop。
- D. 未完成 / 不能承诺: 云同步、多设备、多项目团队协同。

## 4. Core Value Proposition / 核心价值主张

### 4.1 把一句业务目标变成结构化执行计划

商业语言:

> 用户不需要先写完整 PRD。输入一个目标，系统会自动生成角色分工、澄清问题、任务拆解、验收标准和风险提示。

项目依据:

- `apps/ai-gateway-service/src/workforce/workforcePlanner.js` 创建 goal summary、task breakdown、role plan、role tiers、clarification、consensus、acceptance、risks。
- `apps/ai-gateway-service/src/ui/consolePage.js` 提供 template -> goal -> Generate Plan -> Save -> History -> Export 路径。
- Phase 199A real UI trial evidence 证明浏览器路径可演示。

状态:

- A. 已验证可演示。

### 4.2 把 AI 代码助手从“聊天工具”变成“可审查的开发闭环”

商业语言:

> Codex 不再只是一个聊天框。系统先生成 handoff，再要求 Codex 结果按结构返回，最后系统导入结果、审查边界、生成反馈。

项目依据:

- `.codex-handoff/outbox/latest-codex-handoff.md`
- `.codex-handoff/inbox/latest-codex-result.md`
- `tools/agent-workforce/import-codex-result.ps1`
- `docs/AGENT_WORKFORCE_CODEX_RESULT_INBOX_CONTRACT.md`
- `docs/AGENT_WORKFORCE_CODEX_FEEDBACK_LOOP_CLOSURE.md`
- Phase 214A feedback loop evidence。

状态:

- A. 已验证可演示 for manual bridge and import/review/feedback.
- B. 已实现但需要谨慎说明 for controlled loop scripts.
- C. 设计中 / 半自动 for real one-shot Codex readiness.

### 4.3 降低非技术人员与 Codex / AI coding agent 协作门槛

商业语言:

> 业务人员不需要知道怎么写 prompt 给 coding agent。系统把业务目标转成规范任务包，列出允许文件、禁止动作、验证命令、证据要求。

项目依据:

- Agent Workforce product templates.
- Codex Desktop Handoff Pack.
- Markdown/JSON export.
- `docs/AGENT_WORKFORCE_USER_HANDOFF_PACKAGE.md`.

状态:

- A. 已验证可演示 for task package generation.
- B. 已实现但需要谨慎说明 for desktop clipboard and local file handoff.

### 4.4 让 AI 开发过程有记录、有证据、有反馈

商业语言:

> 每次规划、交接、导入、审查都可以留下文件证据，便于复盘和验收。

项目依据:

- `apps/ai-gateway-service/evidence/` phase evidence.
- `docs/AGENT_WORKFORCE_VERIFICATION_MATRIX.md`.
- `docs/AGENT_WORKFORCE_EVIDENCE_MANIFEST_FINAL.md`.
- Phase 235A full readthrough evidence.

状态:

- A. 已验证可演示 for evidence and verification.
- B. 已实现但需要谨慎说明 because evidence is repo-local and not a full audit platform.

### 4.5 让本地团队用更安全方式引入 AI 自动化

商业语言:

> 默认不自动执行、不自动提交、不改 worktree、不接 workflow run，把风险先锁住，再逐步开放。

项目依据:

- AGENTS hard boundaries.
- `workforcePlanner.js` and contracts keep `executionEnabled=false`, `runnerEnabled=false`.
- Phase 218A records real Codex exec skipped when not explicitly enabled.
- Phase 107A secret safety passes.

状态:

- A. 已验证可演示 for safety wording/evidence.
- B. 已实现但需要谨慎说明 for secret scanning and local redaction.
- D. 未完成 / 不能承诺 for enterprise-grade compliance.

### 4.6 把企业知识变成 AI 可用资产

商业语言:

> 客户不只是缺 AI 模型，客户更缺“能被 AI 稳定引用的公司知识”。这个系统可以把项目文档、制度说明、产品资料、交付记录、运营材料加载成本地知识源，再通过检索、引用和 RAG chat 进入回答流程。

项目依据:

- `apps/ai-gateway-service/src/knowledge/localKnowledgeService.js` 提供 default documents、source list、document load、keyword retrieve、ranking、snippet、highlight、citation。
- `packages/shared-contracts/src/contracts/knowledge.ts` 定义 `KnowledgeLoadRequest`、`KnowledgeRetrieveRequest`、`KnowledgeChunk`、`KnowledgeCitation`、`RagChatRequest`、`RagChatResponse`。
- `apps/ai-gateway-service/src/knowledge/knowledgePersistence.js` 支持 memory、file、SQLite、file-sqlite 持久化模式。
- `apps/ai-gateway-service/src/knowledge/knowledgeInfra.js` 明确 local-keyword 默认模式，并把 vector/pgvector 标成显式配置和 production readiness blocker。
- `verify:phase21a`、`verify:phase21b`、`verify:phase22`、`verify:phase23`、`verify:phase27`、`verify:phase29a` 等脚本覆盖知识入口、source load、质量基础设施、生产 readiness 边界、持久化和 RAG chat。

状态:

- A. 已验证可演示 for local keyword knowledge retrieval, source loading, citations, highlights, RAG chat contract, and health/readiness routes.
- B. 已实现但需要谨慎说明 for file/SQLite persistence and UI knowledge entry, because customer data lifecycle and admin UX still need packaging.
- C. 设计中 / 半自动 for vector/pgvector production mode, embedding provider integration, advanced knowledge governance, and enterprise knowledge lifecycle.
- D. 未完成 / 不能承诺 for production-grade vector RAG, GraphRAG index, cross-tenant knowledge isolation, enterprise secret vault, and audited document permission sync.

## 5. Current Product Capabilities / 当前产品能力

### 5.1 AI Gateway

当前能力:

- A. 已验证可演示: 本地 HTTP service 可运行。
- A. 已验证可演示: `/health` 和 `/health/check` 返回 readiness。
- A. 已验证可演示: `health:phase12a` 通过，service URL 为 `http://127.0.0.1:3100`。
- A. 已验证可演示: `/chat` route 存在，默认 NVIDIA 主链边界在 README/AGENTS/Phase 235A 报告中被确认。
- B. 已实现但需要谨慎说明: provider registry 和 runtime credential 能力存在，但当前不应包装成生产级多 provider 路由。
- B. 已实现但需要谨慎说明: Knowledge/RAG 和 local keyword retrieval 可演示，但不是完整生产 RAG/GraphRAG 平台。
- D. 未完成 / 不能承诺: production-grade fallback/governance/multi-provider SLA。

商业卖点:

- “本地服务可启动、可检查、可被 UI 和工具调用。”
- “默认 AI 主链清晰，不把规划工具混入 chat 主链。”
- “适合作为企业内部 AI 工具入口的雏形。”
- “Knowledge/RAG 让这个入口不只是聊天网关，而是能接客户内部知识的工作台。”

谨慎说法:

- 当前默认不是多 provider 生产路由。
- 当前不应夸大 fallback / governance。
- 当前 health check 不等于真实 provider smoke。

### 5.2 Web UI

当前能力:

- A. 已验证可演示: `/ui` 可打开。
- A. 已验证可演示: setup readiness 指引存在。
- A. 已验证可演示: Agent Workforce 页面存在。
- A. 已验证可演示: Phase 199A real browser UI trial passed。
- A. 已验证可演示: UI 明确显示 Execution Disabled、External Runner Disabled、No oh-my-codex call。
- B. 已实现但需要谨慎说明: UI 有 enterprise、knowledge、chat、workflow 等入口，但不是完整商业 SaaS 控制台。

商业卖点:

- 销售演示不需要命令行就能展示核心价值。
- 能用一个页面解释目标 -> 计划 -> 保存 -> 导出 -> handoff。
- UI 已有很多安全边界提示，适合对企业客户解释“可控”。

谨慎说法:

- UI 仍偏开发/试点风格。
- 还需要 Bridge Status Panel、Run History、Safety Dashboard 才更像可销售产品。

### 5.3 Knowledge Base / RAG

当前能力:

- A. 已验证可演示: `/knowledge/health` 可检查本地知识库状态。
- A. 已验证可演示: `/knowledge/sources` 可列出知识源和文档。
- A. 已验证可演示: `/knowledge/load` 可加载客户/项目文档到 source。
- A. 已验证可演示: `/knowledge/retrieve` 支持 local keyword retrieval。
- A. 已验证可演示: 检索结果包含 score、scoreBreakdown、snippet、highlights、matchedTerms、document ref、citations。
- A. 已验证可演示: RAG chat contract 支持 knowledge query、topK、sourceIds、minScore、citations、knowledgeInjected。
- A. 已验证可演示: 默认 knowledge documents 覆盖命令集、NVIDIA single-provider boundary、managed startup/logs、defect standby template。
- B. 已实现但需要谨慎说明: memory/file/SQLite/file-sqlite persistence 存在，但客户生产数据治理、备份、权限和生命周期还要定制。
- B. 已实现但需要谨慎说明: `documentParsers.js`、upload receipt、citation insight、user API catalog coverage 等入口存在，但当前商业包装要先做稳定 demo。
- C. 设计中 / 半自动: vector mode、embedding provider、pgvector、namespace、production readiness probe 是显式配置路径。
- D. 未完成 / 不能承诺: 生产级向量数据库、GraphRAG 索引、企业权限同步、跨租户隔离、全文权限审计。

商业卖点:

- 这是客户最容易理解的第二核心卖点: “把你公司的资料接进 AI 工作台。”
- 它能服务售前、客服、运营、内部 IT、研发知识沉淀、交付复盘。
- 它和 Agent Workforce 可以组合: 先用知识库提供业务上下文，再用 Agent Workforce 生成可交接任务包。
- 它和 Codex bridge 可以组合: Codex handoff 不再只是裸任务，而可以引用项目文档、规则和验收资料。

谨慎说法:

- 当前默认是 local keyword retrieval，不是生产级 vector RAG。
- 当前 vector/pgvector readiness 是边界和配置检查，不是已完成真实向量检索生产系统。
- 当前不应承诺企业级文档权限同步、审计留存、数据脱敏流水线已经完成。

### 5.4 Agent Workforce Preview

当前能力:

- A. 已验证可演示: 目标输入。
- A. 已验证可演示: 模板选择，包括 feature development、bug fix、documentation、code review、release checklist、research/design study。
- A. 已验证可演示: 七角色规划: CEO、PM、Architect、Frontend Engineer、Backend Engineer、QA、Reviewer。
- A. 已验证可演示: role tiers: Strategy、Architecture、Implementation Planning、Quality。
- A. 已验证可演示: clarification questions。
- A. 已验证可演示: consensus preview。
- A. 已验证可演示: review package。
- A. 已验证可演示: approval preview, but only as metadata.
- A. 已验证可演示: saved plans/history。
- A. 已验证可演示: JSON / Markdown export。
- A. 已验证可演示: UX polish, demo goals, manual QA checklist, verification matrix。
- B. 已实现但需要谨慎说明: lifecycle state, review/approval persistence, local dev-only store。
- C. 设计中 / 半自动: execution readiness preflight, external runner design, runner request queue, approval record preview。
- D. 未完成 / 不能承诺: real worker execution, autonomous multi-agent coding, production workflow orchestration。

商业卖点:

- 这是系统最强的当下核心卖点。
- 它把业务目标转成开发计划，比普通聊天更结构化。
- 它能作为售前 demo 的主流程。

谨慎说法:

- 这是 Preview，不是执行器。
- Approval Preview 不是真实执行授权。
- Export 是 handoff package，不是 execution package。

### 5.5 Codex Handoff / Feedback Bridge

当前能力:

- A. 已验证可演示: Codex Desktop Handoff Pack。
- A. 已验证可演示: `cmd /c pnpm run handoff:codex`。
- A. 已验证可演示: `.codex-handoff/outbox` handoff 文件。
- A. 已验证可演示: `.codex-handoff/inbox` result 文件契约。
- A. 已验证可演示: `cmd /c pnpm run codex:result:import`。
- A. 已验证可演示: system review and feedback-to-codex 文件生成。
- A. 已验证可演示: controlled dry-run evidence。
- B. 已实现但需要谨慎说明: desktop BAT 一键菜单。
- B. 已实现但需要谨慎说明: `codex:send:once`, `agent:auto:codex-once`, desktop GUI send once are explicit-gated and not default.
- C. 设计中 / 半自动: controlled real Codex one-shot readiness and safety dashboard.
- D. 未完成 / 不能承诺: unattended execution, auto apply, auto merge, auto commit, auto push, auto PR。

必须明确:

- 默认不是无人值守自动执行。
- 默认不调用 Codex CLI。
- 当前商业演示应以 manual bridge / dry-run 为主。
- 真实 one-shot 只能作为未来受控能力或单独明确批准的试验，不应作为当前正式产品卖点。

### 5.6 Documentation / Evidence / Verification

当前能力:

- A. 已验证可演示: evidence 文件体系。
- A. 已验证可演示: verification matrix。
- A. 已验证可演示: operator runbook。
- A. 已验证可演示: manual QA checklist。
- A. 已验证可演示: user manual。
- A. 已验证可演示: final closure reports。
- A. 已验证可演示: Phase 235A full system readthrough report。
- B. 已实现但需要谨慎说明: release/GitHub/Docker docs and evidence exist, but this commercial pass did not re-run Docker or remote CI.
- D. 未完成 / 不能承诺: audit-grade enterprise compliance platform。

商业卖点:

- 对企业客户，这是“可信度资产”。
- 不只是一个 demo，而是每个阶段有 evidence 和 verifier。
- 能支持 PoC 验收。

谨慎说法:

- evidence 是本地项目证据，不等于第三方安全认证。
- verification matrix 证明当前边界，不证明未来能力。

## 6. Demonstrable Scenarios / 可演示销售场景

### 6.1 从业务目标生成开发任务包

演示目标:

- 证明系统能把一句目标转成结构化研发计划。

操作步骤:

1. 运行 `cmd /c pnpm run health:phase12a` 确认服务 ready。
2. 打开 `http://127.0.0.1:3100/ui`。
3. 进入 Agent Workforce。
4. 选择 Feature Development 模板。
5. 输入一个业务目标。
6. 点击 Generate Plan。
7. 展示 roles、role tiers、clarification、consensus、review package。
8. 点击 Save Plan。
9. Export JSON / Markdown。

客户能看到什么:

- 七角色任务拆解。
- 澄清问题。
- 风险和验收标准。
- 可导出的 handoff package。

价值点:

- 降低需求拆解成本。
- 把非结构化想法转成可执行任务包。

当前是否真实可演示:

- A. 已验证可演示。

### 6.2 商品评论分析功能规划

演示目标:

- 用电商/运营客户能理解的业务场景展示价值。

操作步骤:

1. 选择 Feature Development 模板。
2. 输入: “规划一个商品评论分析功能，可以导入用户评论，自动分类好评/差评/常见问题，并生成改进建议。”
3. Generate Plan。
4. 展示 PM 视角、架构视角、前后端任务、QA 验收。
5. 导出 Markdown。

客户能看到什么:

- 业务目标被拆成产品范围、数据流、UI、API、测试、验收。
- 系统会提示风险和非目标。

价值点:

- 让业务团队更快把运营需求交给技术或 Codex。

当前是否真实可演示:

- A. 已验证可演示 for plan generation/export。
- B. 已实现但需要谨慎说明 for any actual implementation, because system does not implement the feature automatically。

### 6.3 Bug 修复任务规划

演示目标:

- 展示系统不仅能做新功能，也能做缺陷修复计划。

操作步骤:

1. 选择 Bug Fix 模板。
2. 输入: “规划一个 Markdown export 按钮失效的安全修复。”
3. Generate Plan。
4. 展示 root cause、fix scope、regression checklist。
5. 导出 Codex handoff。

客户能看到什么:

- Bug 复现、影响范围、修复策略、测试建议。
- 清楚的边界: 不自动改代码。

价值点:

- 让修 Bug 也有结构化流程和验收。

当前是否真实可演示:

- A. 已验证可演示。

### 6.4 Codex handoff 包生成

演示目标:

- 展示系统如何把 Agent Workforce plan 交给 Codex。

操作步骤:

1. 先生成并保存一个 plan。
2. 运行 `cmd /c pnpm run handoff:codex`。
3. 打开 `.codex-handoff/outbox/latest-codex-handoff.md`。
4. 展示 allowed files、forbidden actions、verification commands、evidence expectations。

客户能看到什么:

- 标准化 Codex 任务包。
- 明确的禁止事项。
- 不自动调用 Codex 的安全边界。

价值点:

- 把 Codex 协作从随意聊天变成可控交接。

当前是否真实可演示:

- A. 已验证可演示 for local handoff generation。
- B. 已实现但需要谨慎说明 because paste/execution remains human-managed。

### 6.5 Codex 结果导入并生成反馈

演示目标:

- 展示系统能审查 Codex 结果，而不是盲信结果。

操作步骤:

1. 准备一个符合 contract 的 `# Codex Result` markdown。
2. 放到 `.codex-handoff/inbox/latest-codex-result.md`。
3. 运行 `cmd /c pnpm run codex:result:import`。
4. 展示 `.codex-handoff/review/latest-system-review.md`。
5. 展示 `.codex-handoff/review/latest-feedback-to-codex.md`。

客户能看到什么:

- 系统会检查结果结构、边界、已运行命令、测试、风险。
- 生成下一轮反馈。

价值点:

- AI coding output 进入人工审查闭环。
- 降低“AI 说完成了但没人知道是否安全”的风险。

当前是否真实可演示:

- A. 已验证可演示 for manual result import/review/feedback。
- D. 未完成 / 不能承诺 for automatic patch application or auto merge。

### 6.6 企业知识库检索与 RAG 问答

演示目标:

- 展示系统不仅能规划任务，还能把客户资料变成 AI 可检索上下文。

操作步骤:

1. 运行 `cmd /c pnpm run health:phase12a` 确认 `/knowledge/health` ready。
2. 通过 `/knowledge/load` 或已有 UI/API 路径加载一段客户示例文档，例如售后规则、商品说明、项目验收标准。
3. 调用 `/knowledge/sources` 展示 source 和 document 已进入知识库。
4. 调用 `/knowledge/retrieve` 输入一个业务问题。
5. 展示返回的 chunks、score、snippet、highlights、matchedTerms、citations。
6. 调用 RAG chat 场景，让回答带上 knowledgeInjected 和 citation summary。

客户能看到什么:

- 资料被组织成 source/document。
- 检索结果不是“模型凭空说”，而是带引用、命中词和片段。
- 同一套知识可以服务 Chat、Agent Workforce planning 和 Codex handoff 上下文。

价值点:

- 企业客户可以把内部知识接入 AI 工作台。
- 售前/客服/运营/研发都能用同一套知识资产。
- 降低 AI 回答脱离公司资料的风险。

当前是否真实可演示:

- A. 已验证可演示 for local keyword retrieval, source load/list, citations, highlights, and RAG chat contract。
- B. 已实现但需要谨慎说明 for file/SQLite persistence and UI polish。
- C. 设计中 / 半自动 for vector/pgvector production mode。
- D. 未完成 / 不能承诺 for production-grade GraphRAG, document permission sync, and enterprise knowledge governance。

## 7. What Can Be Sold Now / 当前能卖什么

### 可以卖的形态 A: 本地 AI 开发工作台试用版

卖点:

- 本地部署。
- `/ui` Web 控制台。
- Knowledge/RAG 本地知识库。
- Agent Workforce planning。
- Codex handoff。
- result import / feedback bridge。
- 文档、evidence、verification。
- Desktop BAT 和操作手册。

适合:

- 技术团队试点。
- 企业内部 AI 工作流试验。
- 小团队研发流程升级。

交付方式:

- 1-2 周本地试点。
- 帮客户在一台开发机或内网机器跑通。
- 交付 demo goals、操作手册、验收报告。

成熟度:

- 当前产品成熟度支持“试用版 / Pilot”。
- 不支持宣称“生产级 SaaS”。

### 可以卖的形态 B: 定制化交付服务

卖点:

- 根据客户业务定制模板。
- 帮客户整理首批知识库资料: 产品说明、FAQ、项目文档、验收标准、运营规则。
- 帮客户接入 Codex 工作流。
- 帮客户做 AI 开发流程标准化。
- 帮客户形成任务包、验收标准、反馈格式。

适合:

- AI 咨询/交付团队。
- 企业内部 IT。
- 电商/运营团队。

交付方式:

- 需求访谈。
- 3-5 个业务模板。
- 1-3 个知识源接入样例。
- 本地部署。
- 操作培训。
- 试点复盘。

成熟度:

- 当前产品成熟度支持“定制化交付服务”。
- 需要服务团队兜底，不建议完全自助销售。

### 可以卖的形态 C: AI 项目管理 / 任务规划工具

卖点:

- 业务目标拆解。
- 角色协作。
- Review / Approval Preview。
- Handoff package。
- Evidence-based acceptance。

适合:

- 独立产品团队。
- 小型软件团队。
- 咨询顾问。

交付方式:

- 本地工具 + 模板包 + 操作指南。

成熟度:

- 当前产品成熟度支持“planning-first 工具”。
- 如果客户期待自动代码执行，需要明确不属于当前承诺。

必须写清楚:

- 现在不适合直接卖成完全自动化 SaaS。
- 现在最适合卖试点、定制、规划/交接工作台。

## 8. What Should Not Be Promised / 不能对客户承诺什么

不能对客户承诺:

- 不能承诺: 无人值守自动写代码已完成。
- 不能承诺: 自动 commit/push 已完成。
- 不能承诺: 多用户 SaaS 生产部署已完成。
- 不能承诺: 自动创建 worktree 已完成。
- 不能承诺: 真实 workflow run 已接入。
- 不能承诺: 多 provider 生产级调度已完成。
- 不能承诺: 完全安全合规已完成。
- 不能承诺: 不需要人工审查。
- 不能承诺: 真实多 Agent 执行已完成。
- 不能承诺: 真实外部 runner dispatch 已完成。
- 不能承诺: 自动应用 Codex patch 已完成。
- 不能承诺: 自动创建 PR 已完成。
- 不能承诺: 企业级 SSO/RBAC/tenant isolation/secret vault 已完成。
- 不能承诺: 公网生产部署可直接上线。
- 不能承诺: 所有客户环境都能一键运行。

推荐对外说法:

- “当前是本地试点版，适合演示、内部试用、流程验证和定制交付。”
- “默认安全策略是不执行、不提交、不推送、不创建 worktree。”
- “真实执行路线在规划中，必须先经过安全门、审批和人工审查。”

## 9. Competitive Differentiation / 差异化

与普通 ChatGPT / Claude 聊天相比:

- 普通聊天擅长回答问题，但输出容易散。
- 本系统把目标转成固定结构的研发任务包。
- 本系统有保存、导出、handoff、result import、feedback、evidence。
- 本系统强调边界和验证，而不是只追求回答速度。

与普通 Codex / coding agent 相比:

- 普通 coding agent 更偏执行。
- 本系统更偏执行前规划、执行中交接、执行后审查。
- 本系统默认不让 AI 直接改动、提交、推送。
- 本系统能作为 Codex 前后的控制层。

与普通项目管理工具相比:

- 普通项目管理工具需要人工拆需求。
- 本系统用 Agent Workforce 生成角色化任务计划。
- 本系统输出可以直接变成 Codex handoff。
- 本系统更贴近 AI-assisted development workflow。

与普通 AI workflow 工具相比:

- 普通 workflow 工具常强调自动执行。
- 本系统当前差异化是受控、本地、证据化、安全边界明确。
- 本系统能先解决企业最怕的 AI 乱执行问题。

核心差异化:

- Knowledge/RAG + 任务规划 + Codex handoff 的组合，而不是单点聊天或单点代码助手。
- 任务规划 + handoff + result review 闭环。
- 本地运行。
- evidence / verification。
- preview 安全边界。
- 面向业务目标到代码任务的转换。

## 10. Pricing / 定价建议

以下价格为建议区间，不是市场报价。实际价格应根据客户规模、部署复杂度、模板数量、是否包含培训和维护调整。

### 方案 A: 项目交付制

建议产品包:

1. 基础部署包  
   建议区间: RMB 20,000 - 60,000 / 次。  
   包含本地部署、启动验证、基础演示、操作手册。

2. 定制模板包  
   建议区间: RMB 10,000 - 50,000 / 3-5 个模板。  
   包含客户行业模板、demo goals、验收 checklist。

3. 知识库接入包  
   建议区间: RMB 15,000 - 80,000 / 1-3 个知识源样例。  
   包含客户文档梳理、source/document 结构设计、RAG 检索演示、citation 验收、知识库操作培训。

4. Codex workflow 接入包  
   建议区间: RMB 20,000 - 80,000 / 次。  
   包含 handoff/result/feedback 流程配置、培训、试点演练。

5. 培训与维护  
   建议区间: RMB 5,000 - 30,000 / 月。  
   包含远程支持、问题排查、模板迭代、知识源更新指导、升级指导。

适合客户:

- 企业内部 IT。
- AI 咨询/交付团队。
- 有明确试点场景的小团队。

收费逻辑:

- 按交付物和实施服务收费。
- 客户自带模型/API key，模型费用另算。

优点:

- 最符合当前成熟度。
- 可以服务兜底，避免 SaaS 未成熟的问题。
- 容易从首批客户拿真实反馈。

风险:

- 交付人力成本高。
- 每个客户环境不同。
- 模板定制容易变成项目外包。

当前产品成熟度是否支持:

- 支持。推荐作为首卖模式。

### 方案 B: 订阅制

建议分层:

1. Solo  
   建议区间: RMB 99 - 299 / 月。  
   单机本地使用，适合个人开发者。

2. Team  
   建议区间: RMB 999 - 3,999 / 月 / 团队。  
   本地团队版，包含模板、handoff、evidence、基础支持。

3. Business  
   建议区间: RMB 5,000 - 20,000 / 月。  
   面向公司内部试点，包含定制模板、培训、试点支持。

4. Enterprise  
   建议区间: RMB 80,000 - 300,000 / 年起。  
   私有化、本地部署、定制、安全审查支持、运维支持。

适合客户:

- Solo/Team 适合小团队。
- Business/Enterprise 适合内部 IT 和咨询公司。

收费逻辑:

- 软件订阅 + 支持服务。
- 模型/API 消耗由客户承担或另计。

优点:

- 收入可持续。
- 产品化方向清晰。

风险:

- 当前多用户和 SaaS 能力不足。
- 需要 license、更新、权限、计费、支持体系。
- 若过早订阅化，客户会期待成熟 SaaS。

当前产品成熟度是否支持:

- 支持 Solo/Team 的本地试点订阅。
- 不支持成熟 SaaS 订阅。

### 方案 C: 咨询 + 软件混合

建议结构:

- 一次性实施费: RMB 30,000 - 150,000。
- 月度维护费: RMB 5,000 - 30,000。
- 定制开发费: RMB 1,500 - 5,000 / 人天，或按模块报价。
- 企业年度授权: RMB 80,000+。

适合客户:

- AI 咨询/交付团队。
- 企业内部 IT。
- 需要流程改造的客户。

收费逻辑:

- 软件作为底座。
- 咨询团队卖模板、流程、培训、验收。
- 后续按模板、集成、UI 面板、安全能力迭代收费。

优点:

- 最能发挥当前项目的文档/evidence/流程优势。
- 允许边做边产品化。

风险:

- 依赖交付能力。
- 需要避免客户把咨询服务理解成成品 SaaS。

当前产品成熟度是否支持:

- 强烈支持。建议作为第一商业路线。

## 11. Go-to-Market / 销售路径

第一批客户怎么找:

- 找已经在用 ChatGPT/Codex/Cursor 但流程混乱的小型软件团队。
- 找有内部工具自动化压力的企业 IT。
- 找电商/运营团队，用“评论分析、活动页、报表工具”做场景。
- 找 AI 咨询/外包团队，让他们把系统作为交付底座。
- 先找愿意参与试点的熟人客户，不要直接大规模陌生销售。

怎么演示:

- 不先讲技术架构，先讲“需求到任务包到 Codex 反馈”。
- 中间插入“客户资料进入知识库，再被检索和引用”的场景。
- 15 分钟跑通 UI demo。
- 展示安全边界和 evidence。
- 最后展示可定制模板和本地部署。

怎么包装卖点:

- “不是空聊天，而是带客户知识库的 AI 工作台。”
- “不是替代 Codex，而是 Codex 前后的控制台。”
- “不是自动乱跑，而是可审查的 AI 协作闭环。”
- “不是一次性 prompt，而是有任务包、结果导入、反馈和证据。”

怎么避免夸大:

- 每次销售演示都明确四类状态:
  - A. 已验证可演示。
  - B. 已实现但需要谨慎说明。
  - C. 设计中 / 半自动。
  - D. 未完成 / 不能承诺。
- 不使用“全自动开发完成”“无人值守上线”“企业合规已完成”等说法。
- 把 real Codex one-shot 说成未来受控能力或显式批准实验。

试点交付流程:

1. 选一个客户真实需求。
2. 部署本地服务。
3. 跑 health/doctor/check。
4. 接入 1-3 个客户知识源样例。
5. 配置 3 个客户模板。
6. 用知识库问答确认资料可检索。
7. 用 UI 生成任务包。
8. 做一次 handoff。
9. 人工把结果放入 inbox。
10. 导入审查和反馈。
11. 输出试点验收报告。

成功指标:

- 客户能独立启动系统。
- 客户能加载并检索至少一个业务知识源。
- 客户能生成并理解任务包。
- 客户能完成一次 handoff/import/feedback。
- 客户认可“AI 开发过程更可控”。
- 客户愿意为模板定制或下一阶段试点付费。

建议路线:

1. 先做内部真实案例。
2. 做 3 个行业模板。
3. 做演示视频。
4. 找小团队/电商/内部 IT 试点。
5. 收费做定制交付。
6. 再考虑产品化订阅。

## 12. Sales Demo Script / 销售演示脚本

15 分钟演示流程:

### Step 1: 介绍痛点

话术:

> 现在很多团队已经在用 AI 写代码，但真正的问题不是 AI 会不会写，而是需求怎么拆、任务怎么交接、结果怎么审查、有没有证据。这个系统解决的是 AI 开发协作的流程控制问题。

### Step 2: 打开 `/ui`

操作:

- 打开 `http://127.0.0.1:3100/ui`。
- 展示 setup readiness 和 service ready。

话术:

> 这是本地运行的 AI 开发工作台。所有演示都在本地服务上完成，不需要先上 SaaS。

### Step 3: 输入业务目标

操作:

- 选择 Feature Development。
- 输入商品评论分析功能目标。

话术:

> 我们不用先写完整 PRD，只输入一个业务目标，看系统怎么把它拆成研发任务包。

### Step 4: 展示 Knowledge/RAG

操作:

- 展示 `/knowledge/health`。
- 展示一个已加载的业务知识源，或用 API 演示 source/document/retrieve。
- 展示 snippet、highlight、citation。

话术:

> 这块很关键: 系统不是只会空聊天。它可以把你们自己的资料放进本地知识库，让 AI 回答和任务规划有公司上下文、有引用来源。

### Step 5: 生成 Agent Workforce plan

操作:

- 点击 Generate Plan。

话术:

> 系统会用七个角色视角生成计划: CEO、PM、架构、前端、后端、QA、Reviewer。它不是直接写代码，而是先把工作拆清楚。

### Step 6: 展示 roles / clarification / review / approval

操作:

- 展示 role tiers、clarification questions、consensus preview、review package、approval preview。

话术:

> 这里的 approval 是 preview metadata，不是执行授权。这个边界很重要: 当前系统默认不让 AI 自动乱动代码。

### Step 7: 导出 Codex handoff

操作:

- Save Plan。
- Export Markdown 或运行 `handoff:codex`。
- 展示 `.codex-handoff/outbox/latest-codex-handoff.md`。

话术:

> 这一步把计划变成可以交给 Codex 的任务包，里面有允许范围、禁止动作、验证命令和证据要求。

### Step 8: 模拟 Codex result import

操作:

- 放入一个示例 `latest-codex-result.md`。
- 运行 `codex:result:import`。

话术:

> Codex 的结果不是直接合并。我们先导入结果，让系统做结构检查和边界审查。

### Step 9: 展示 system feedback

操作:

- 打开 review 和 feedback 文件。

话术:

> 这就是反馈闭环。系统会告诉下一轮 Codex 需要修什么、补什么、注意什么。

### Step 10: 强调安全边界

话术:

> 当前默认不调用 Codex CLI、不自动 commit、不 push、不创建 worktree、不接 workflow run。我们卖的是可控协作，不是无人值守冒险执行。

### Step 11: 介绍可定制方向

话术:

> 下一步可以为你们定制行业模板、接入首批知识源、把 bridge 状态做进 UI、做安全门仪表盘，再逐步进入受控 one-shot 执行。

## 13. Buyer Objections / 客户异议与回答

1. 这和 ChatGPT 有什么区别?

回答:

> ChatGPT 是通用聊天。这个系统把业务目标转成固定结构的开发任务包，并且有保存、导出、handoff、结果导入、反馈和 evidence。它更像 AI 开发流程控制台。

2. 这和 Codex 有什么区别?

回答:

> Codex 更偏执行代码任务。这个系统位于 Codex 前后: 前面负责规划和任务包，后面负责结果导入、审查和反馈。它不是替代 Codex，而是让 Codex 协作更可控。

3. 会不会自动乱改代码?

回答:

> 默认不会。当前 Web 系统不自动执行代码，不自动 apply，不 commit，不 push，不创建 worktree。真实 one-shot 路线也必须显式批准和通过安全门。

4. 数据会不会泄露?

回答:

> 当前是本地试点形态，系统强调不写明文 API key，evidence 有 secret-safety 检查。但它还不是完整企业密钥保险箱或合规平台。企业正式上线前仍需要安全评审和密钥管理方案。

5. 你们的知识库能力和普通 RAG 有什么区别?

回答:

> 当前卖点不是“我们已经是生产级向量 RAG 平台”，而是“这个 AI 开发工作台已经内置可演示的本地知识源、检索、引用和 RAG chat 能力”。它能把客户资料接进任务规划和协作闭环。生产级 vector/pgvector、权限同步、文档生命周期治理可以作为下一阶段交付。

6. 我们不会用 Codex 怎么办?

回答:

> 可以先把系统当任务规划和交接工具用。Codex bridge 是可选流程，也可以交给人工开发者、其他 coding agent 或外包团队。

7. 能不能部署到公司内网?

回答:

> 当前适合本地/内网试点。已有本地启动、Docker/部署文档和验收命令。但公网多用户生产部署还不能直接承诺，需要额外做权限、密钥、审计和运维。

8. 能不能接我们自己的模型?

回答:

> 代码里有 provider/runtime config 和 OpenAI-compatible 路径，但当前默认主链是 NVIDIA `/chat`。接入自有模型可以作为定制交付范围，不能说已经是生产级多 provider 调度。

9. 能不能多人用?

回答:

> 当前更适合本地单用户或小团队试点。多用户、项目空间、权限、审计、租户隔离是团队版/企业版路线图，不是当前完成能力。

10. 能不能自动提交 PR?

回答:

> 当前不能承诺。系统默认不 commit、不 push、不自动创建 PR。未来可以做受控 PR workflow，但需要审批、安全门、回滚和审计。

11. 当前成熟度如何?

回答:

> 适合演示、试点、内部流程验证和定制交付；不适合直接作为成熟 SaaS 或无人值守执行平台销售。

12. 如果 Codex 结果错了怎么办?

回答:

> 系统设计了 result import、system review、feedback-to-Codex，不会默认相信 Codex 输出。当前仍需要人工审查。

13. 为什么不直接让 AI 全自动执行?

回答:

> 因为企业真正关心的是可控和可审查。当前先把计划、交接、审查、证据做稳，再逐步开放受控执行。

## 14. Productization Roadmap / 产品化路线图

### Stage 1: 可演示版本

目标:

- 稳定 demo / local trial。

功能:

- `/ui` demo。
- Agent Workforce plan。
- 保存/导出。
- Codex handoff。
- result import / feedback。
- evidence/verifier。

交付物:

- Demo script。
- 3 个 demo goals。
- 商业介绍文档。
- 本地安装和验收手册。

风险:

- UI 仍偏技术。
- 本地环境差异。
- 客户误解为自动执行。

验收指标:

- 15 分钟 demo 可稳定跑通。
- `health`、`doctor`、workspace check 通过。
- 客户能理解当前边界。

### Stage 2: 试点交付版本

目标:

- 客户模板、日志、权限、导出报告。

功能:

- 3-5 个客户模板。
- Bridge Status Panel。
- Next Task Queue UI。
- Run History。
- Safety Gate Dashboard。
- PoC report export。

交付物:

- 客户模板包。
- 试点验收报告。
- 操作培训。
- 风险清单。

风险:

- 定制范围膨胀。
- 客户期望自动开发。
- 需要更清楚的错误处理。

验收指标:

- 客户完成一次真实业务目标 planning。
- 客户完成一次 handoff/import/feedback。
- 客户认可下一阶段付费价值。

### Stage 3: 团队版本

目标:

- 多用户、项目空间、任务队列、审查流。

功能:

- 用户/角色基础。
- Project workspace。
- Plan ownership。
- Review workflow。
- Team task queue。
- Exportable audit report。

交付物:

- Team local edition。
- 管理员手册。
- 权限模型说明。

风险:

- 当前架构需要补 auth/session/storage。
- 多用户安全复杂度上升。

验收指标:

- 至少 3 个用户角色可区分。
- 每个项目空间数据隔离。
- Review/approval 仍不能等同执行授权。

### Stage 4: 受控执行版本

目标:

- codex exec one-shot、安全门、审批、回滚。

功能:

- Controlled Codex one-shot readiness。
- Clean git check。
- Secret scan。
- Explicit approval。
- No commit/push default。
- Result diff review。
- Rollback plan。

交付物:

- One-shot execution playbook。
- Safety gate evidence。
- Human approval record。
- Failure-stop report。

风险:

- 执行风险显著增加。
- Codex CLI 环境差异。
- Dirty workspace 风险。
- 客户可能要求无人值守。

验收指标:

- real one-shot 只在显式批准下运行。
- 无自动 commit/push。
- 失败可停止、可审查。

### Stage 5: 企业版本

目标:

- 内网部署、审计、权限、模型配置、合规。

功能:

- SSO/RBAC。
- Tenant/project isolation。
- Encrypted secret vault。
- Audit retention。
- Admin dashboard。
- Model/provider policy。
- Enterprise deployment package。

交付物:

- Enterprise local installer。
- Security review pack。
- Admin/operator docs。
- Support SLA。

风险:

- 企业安全要求高。
- 合规成本高。
- 运维复杂度高。

验收指标:

- 权限和审计通过客户安全评审。
- 密钥不出现在日志/evidence/UI。
- 内网部署可重复。

## 15. Technical Readiness / 技术成熟度评估

评分: 1 = 概念/文档，5 = 可产品化稳定销售。

| Module | Score | Reason |
| --- | ---: | --- |
| AI Gateway | 3.5/5 | 本地服务、health、chat、knowledge route 已可用；默认 NVIDIA 主链清晰。但生产级多 provider、fallback、governance 不应夸大。 |
| UI | 3/5 | `/ui` 可演示，Phase 199A real browser trial passed；但商业 UI 还需要 bridge status、run history、safety dashboard。 |
| Knowledge Base / RAG | 3.5/5 | 本地 knowledge load/sources/retrieve、RAG chat、citation、highlight、file/SQLite persistence 已具备强演示价值；但生产级 vector RAG、GraphRAG、权限同步和知识治理还不能承诺。 |
| Agent Workforce | 4/5 | 当前最强模块。模板、角色、tiers、clarification、review、approval preview、export、evidence 都很完整；但仍是 preview，不执行。 |
| Codex bridge | 3.5/5 | handoff/inbox/review/feedback/dry-run 已形成闭环；真实 Codex one-shot 未作为默认能力验证。 |
| Evidence/verification | 4/5 | 证据体系丰富，适合试点验收；但不是第三方审计或企业合规认证。 |
| Desktop automation | 3/5 | BAT 和 PowerShell 工具可演示；依赖 Windows 环境、剪贴板、Codex Desktop 状态。 |
| Security | 2.5/5 | Secret-safety 和边界很强；但缺生产级 vault、SSO、tenant isolation、audit retention。 |
| SaaS readiness | 1.5/5 | 当前不是多租户 SaaS；缺用户、计费、隔离、云运维。 |
| Enterprise readiness | 2.5/5 | 有大量 enterprise docs/checks 和本地部署线索；但完整企业安全/权限/合规未完成。 |

总体成熟度判断:

- Demo / Pilot: 4/5。
- 定制交付: 3.5/5。
- Knowledge/RAG pilot: 3.5/5。
- Team product: 2.5/5。
- Enterprise product: 2/5。
- SaaS product: 1.5/5。
- Unattended execution product: 1/5。

## 16. Business Risks / 商业风险

1. 过度承诺自动化  
   最大风险是把 controlled bridge 说成无人值守自动执行系统。必须避免。

2. Codex 依赖  
   Codex CLI、Codex Desktop、账号、窗口、模型、费用、网络都可能影响真实流程。

3. 客户环境差异  
   Windows、PowerShell、pnpm、Node、端口、权限、杀毒软件、内网策略都可能影响部署。

4. 安全与密钥管理  
   当前有 secret-safety，但企业客户会要求 vault、rotation、audit、least privilege。

5. 知识库过度承诺风险  
   当前强项是本地 keyword retrieval、RAG chat 和 citation demo；不能把 vector/pgvector readiness 包装成已完成生产级知识中台。

6. 多用户能力不足  
   当前偏本地单用户/小团队试点，不能直接卖大型团队 SaaS。

7. 部署复杂度  
   项目脚本多、phase 多，普通客户需要包装成更简单的 installer/runbook。

8. UI 体验仍需打磨  
   当前 UI 能演示，但商业客户需要更清楚的 dashboard、状态、历史、错误提示。

9. Dirty workspace 风险  
   当前 workspace 不 clean。真实 Codex execution 必须先处理 clean git / safety gate。

10. 真实 codex exec 未完全验证  
   Phase 218A 记录 skipped-not-enabled，不能说真实 one-shot 已稳定跑通。

11. 维护成本  
   如果走定制交付，模板、客户环境、模型接入、培训会形成持续服务成本。

12. 市场认知风险  
   客户可能把它和 ChatGPT/Cursor/Codex 直接对比，忽略流程控制价值。

13. 证据解释成本  
   evidence 很多，客户可能看不懂，需要产品化成报告和 dashboard。

## 17. Recommended Commercial Package / 推荐销售包装

推荐首卖名称:

> AI Development Command Center - Local Pilot Edition  
> AI 开发指挥台本地试点版

首卖版本包含:

- 本地部署。
- Knowledge/RAG 本地知识库。
- Agent Workforce。
- Codex handoff。
- feedback bridge。
- 3-5 个业务模板。
- 1-3 个知识源样例。
- 操作手册。
- 培训。
- 1-2 周试点支持。
- 一份试点验收报告。

不包含:

- 无人值守执行。
- 自动 commit/push。
- 企业 SaaS。
- 高级权限。
- SSO/RBAC。
- 多租户。
- 自动 PR。
- 生产级密钥保险箱。
- 完整合规认证。

推荐交付包:

1. Local Pilot Setup  
   本地安装、启动、health/doctor/check、UI demo。

2. Business Template Pack  
   为客户做 3-5 个业务模板，例如电商评论分析、内部报表、Bug 修复、文档更新、发布检查。

3. Knowledge Starter Pack  
   帮客户整理 1-3 个知识源样例，跑通 load/sources/retrieve/RAG chat/citation 演示。

4. Codex Collaboration Workflow  
   规划 -> handoff -> 人工 Codex -> result import -> feedback。

5. Safety & Evidence Review  
   输出边界清单、evidence、verification command result。

6. Training Session  
   教客户如何加载知识源、输入目标、保存、导出、导入结果、看反馈。

推荐首卖口径:

> 我们先不卖一个“自动开发机器人”，而是卖一个“能让你的团队安全使用 AI 开发助手的本地工作台”。先用 1-2 周跑通真实业务试点，再决定是否进入团队版/受控执行版。

## 18. Next 30 / 60 / 90 Days Plan

### 30 天

目标:

- 稳定 demo。
- 把 Knowledge/RAG 做成销售演示主线之一。
- 补 Bridge Status Panel。
- 补 Next Task Queue UI。
- 做销售 demo。

任务:

- 做一个 15 分钟稳定演示脚本。
- 建 3 个标准 demo goals: 商品评论分析、Bug 修复、文档更新。
- 建 3 个标准 knowledge demo sources: 产品 FAQ、项目验收标准、运营规则。
- 在 UI/文档中明确 local keyword、citation、vector readiness 的边界。
- 在 UI 中展示 handoff/inbox/review/feedback 状态。
- 在 UI 中展示 P1-P5 next task queue。
- 整理商业介绍 PPT/Markdown。

验收:

- 新客户机器上可跑通 health/doctor/check。
- Knowledge demo 可展示 source/document/retrieve/citation。
- 15 分钟 demo 无需解释太多命令。
- 销售报告和 demo 话术一致。

### 60 天

目标:

- 做 3 个行业模板。
- 做 3 个行业知识源 starter pack。
- 做客户试点包。
- 做安全门可视化。

任务:

- 电商运营模板。
- 内部 IT 工具模板。
- 软件团队研发模板。
- 电商商品/评论/FAQ 知识源样例。
- 内部 IT 制度/操作手册知识源样例。
- 软件团队 PRD/验收/缺陷规范知识源样例。
- Safety Gate Dashboard。
- Auto Loop Run History。
- 试点验收报告模板。
- 客户反馈表。

验收:

- 至少 1 个真实试点客户完成任务包生成和 feedback loop。
- 客户能看懂“当前能做/不能做”。
- 安全门 dashboard 能阻止误解真实执行。

### 90 天

目标:

- 做受控 Codex one-shot。
- 做审计报告。
- 做团队版原型。
- 做知识库管理原型。

任务:

- Controlled Codex One-shot Readiness。
- 明确 explicit approval 流程。
- clean git / secret scan / no commit/push gate 可视化。
- Result diff review prototype。
- Project workspace prototype。
- Knowledge source lifecycle / import log / citation report prototype。
- 基础用户/角色原型。
- Enterprise security gap report。

验收:

- 真实 one-shot 只在显式批准下运行。
- 所有执行结果必须进入审查，不自动合并。
- 团队版原型能展示项目空间和审查流。

## 19. Final Business Conclusion

当前能不能卖:

- 能卖，但应该卖“本地试点版 / 定制交付 / AI 开发协作工作台”，不要卖“成熟 SaaS”或“无人值守自动开发系统”。

适合怎么卖:

- 以 1-2 周 Local Pilot 切入。
- 用一个客户真实业务目标和一组客户资料演示 knowledge -> plan -> handoff -> import -> feedback。
- 按项目交付或咨询 + 软件混合收费。
- 先卖给小团队、内部 IT、AI 咨询/交付团队、电商/运营场景。

不适合怎么卖:

- 不适合直接承诺全自动写代码。
- 不适合直接承诺自动提交 PR。
- 不适合直接承诺多用户 SaaS。
- 不适合说 production-ready execution。
- 不适合说 approval-preview 就是执行授权。

下一步最应该补什么:

- P0 Knowledge/RAG Sales Demo Pack。
- P1 Codex Bridge Status Panel。
- P2 Next Task Queue UI。
- P3 Auto Loop Run History。
- P4 Safety Gate Dashboard。
- P5 Controlled Codex One-shot Readiness。

最终商业判断:

> `unified-ai-system` 当前最有商业价值的形态，是一个“AI 开发指挥台本地试点版”: 它能把企业资料变成本地 Knowledge/RAG 上下文，把业务目标变成研发任务包，把 Codex 协作纳入交接/审查/反馈闭环，并用 evidence 和安全边界让客户敢于试点 AI 开发流程。它现在可以进入收费试点和定制交付，但不能承诺无人值守自动执行、生产级 SaaS、多用户企业平台、生产级向量知识中台或自动 commit/push。

本 Phase 236A 商业报告只完成商业化通读和产品包装建议，没有新增业务能力，没有启用真实 Agent 执行，没有调用 Codex CLI，没有创建 worktree，没有 workflow run，没有自动 commit/push，没有改变默认 NVIDIA `/chat` 主链。
