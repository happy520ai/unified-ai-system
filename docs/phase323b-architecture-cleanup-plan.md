# Phase323B 架构清理优先计划

## 1. 当前基线确认

### 1.1 主链状态

- Phase322A 主链仍成立：Workbench UI -> `/chat-gateway/execute` -> Chat Gateway -> NVIDIA Provider -> 真实模型回复 -> UI 展示成功。
- 当前真实 Provider 仍只有 NVIDIA。
- 当前系统仍定位为本地 / 内部测试，不是公开生产部署。
- 当前 Workbench 默认主 UI 仍只暴露 5 个模块：
  - 快速对话
  - 模型配置
  - 审批任务
  - 添加文件
  - 诊断中心

### 1.2 核心文件状态

- `apps/ai-gateway-service/src/ui/consolePage.js`
  - 仍为单文件 UI。
  - 约 1460 行。
  - 5 个默认主模块入口位于约第 477-481 行。
  - Chat 真实发送路径 `/chat-gateway/execute` 位于约第 1187 行。
  - 请求体仍显式包含：
    - `mode: "manual_model"`
    - `dryRun: false`
    - `selectedModel: { providerId, modelId }`
- `apps/ai-gateway-service/src/http/httpServer.js`
  - 仍为集中式 route registry。
  - 约 3835 行。
  - `/chat-gateway/execute` 路由存在，位于约第 652 行。
  - `/provider-config/test` 路由存在，位于约第 551 行。
  - `/approvals/create` 路由存在，位于约第 227 行。
  - `/file-context/select` 路由存在，位于约第 291 行。
  - `/workbench/diagnostics/status` 路由存在，位于约第 704 行。

### 1.3 脚本与 entrypoint 数量级

- 根 `package.json` scripts 总量：约 443
- 根 `verify:*` scripts：约 353
- 根 `smoke:*` scripts：约 21
- `apps/ai-gateway-service/package.json` scripts 总量：约 400
- service `verify:*` scripts：约 339
- service `smoke:*` scripts：约 23
- `apps/ai-gateway-service/src/entrypoints/*.js` 总量：约 410
  - `verify*.js`：约 349
  - `smoke*.js`：约 23
  - `run*.js`：约 26

结论：

- 当前系统已经不是“缺脚本”，而是“历史脚本过多、阶段性脚本密度过高、核心链与历史兼容链混杂”的状态。
- Phase323B 不应直接删除这些资产，而应先做分层归档规划。

## 2. 本阶段没有修改哪些禁止区域

- 未修改 `legacy/`
- 未创建 `PROJECT_CONTEXT.md`
- 未修改 `/chat-gateway/execute` 主链逻辑
- 未修改 NVIDIA API Key 读取 / redact / runtime credential store 安全逻辑
- 未默认暴露隐藏模块
- 未改动 Workbench 5 个默认主模块行为
- 未调用 OpenAI / Claude / OpenRouter / MiMo / paid API
- 未做 embedding batch training
- 未执行 commit / push / deploy / release
- 未声称 workspace clean

## 3. verifier / entrypoint 分类清单

### A. 必须保留的核心验证

这些能力直接保护当前可交付主链，不应降级：

- `health:phase12a`
- `doctor:phase13a`
- `verify:phase322a-workbench-chat-gateway-real-nvidia`
- `verify:phase321a-workbench-product-recovery`
- `verify:phase319a-functional-landing`
- `verify:phase314a-chat-gateway-task-closure`
- `verify:phase313a-model-usability-matrix`
- `verify:phase312a-unified-model-library`
- `verify:phase107a-secret-safety`
- `pnpm -r --if-present check`

对应 entrypoint 也应列为核心保留：

- `verifyPhase322AWorkbenchChatGatewayRealNvidia.js`
- `verifyPhase321AWorkbenchProductRecovery.js`
- `verifyPhase319AFunctionalLanding.js`
- `verifyPhase314AChatGatewayTaskClosure.js`
- `verifyPhase313AModelUsabilityMatrix.js`
- `verifyPhase312AUnifiedModelLibrary.js`
- `verifySecretSafety.js`
- `checkSyntax.js`

### B. 可暂时保留但降级为历史兼容

这些脚本不建议本轮删除，但建议在后续归类为“兼容层 / 历史资产”：

- 企业治理 / enterprise 相关
  - 目录规模样本：约 16 个 service verifier
- workforce / agent workforce / codex bridge 相关
  - entrypoint 规模样本：约 113 个 workforce 类
  - scripts 规模样本：约 53 个 workforce / codex / handoff 类
- release / deploy / docker / github / cicd 相关
  - scripts 规模样本：约 29 个
  - entrypoint 规模样本：约 33 个
- knowledge / workflow / routing / cache / cost 相关
  - scripts 规模样本：约 27 个
  - entrypoint 规模样本：约 28 个

处理建议：

- 不删除
- 不默认执行
- 不继续扩写新 phase
- 在 Phase323C 进入分组命名或兼容清单

### C. 建议归档候选

符合以下任一特征的 verifier / entrypoint，应进入“归档候选”而不是继续增长：

- 只输出 JSON evidence、没有当前主链断言增量的 verifier
- 重复验证相同能力的旧 phase
- 指向旧 UI / 旧入口 / 旧 marker 的 verifier
- 与当前 5 模块 Workbench 无关的历史演示入口
- 与当前禁止边界冲突的 release / deploy / commit / push 方向脚本
- 命名上属于阶段堆叠但已经被更高阶段覆盖的 smoke/verifier

高优先归档候选族群：

- 旧 Web Chat / Screenshot / Browser / UI 微阶段 verifier 家族
- Agent Workforce Preview 长链 phase 家族
- GitHub release / publish / remote push / prerelease 长链 phase 家族
- 个人知识库 / personal knowledge / personal workflow 长链 phase 家族
- benchmark / preview / design-only 但未进入当前 Workbench 5 模块的脚本

### D. 高风险禁止触碰

- `legacy/`
- `.env` / secret / token / key 明文相关
- 当前 NVIDIA 真实调用链
- 当前审批保护链
- 当前 `/chat-gateway/execute` 主路由
- 当前 selectable model gate 与 verification state
- 当前 Workbench 默认 5 模块入口

## 4. package scripts 清理建议

### 4.1 当前问题

- 根 scripts 443 个、根 verify 脚本 353 个，已经远超日常可维护阈值。
- 当前 `package.json` 兼具：
  - 核心运行命令
  - 当前主链验证
  - 历史 phase 验证
  - 企业 / workforce / docker / github / release / benchmark / personal 系列脚本
- 对新维护者不友好，难以判断“今天应该跑什么”。

### 4.2 本轮不做的事

- 不删除脚本
- 不重命名大批脚本
- 不调整真实主链脚本名

### 4.3 后续建议

#### Phase323C 第一刀

- 目标：先做“分层归档”，不是删除。
- 建议把脚本逻辑分成 4 层：
  - 核心运行层：`health` / `doctor` / `check` / 当前主链 verify
  - 当前产品验收层：312A / 313A / 314A / 319A / 321A / 322A
  - 历史兼容层：旧 UI / workforce / enterprise / release / docker / github
  - 研究 / benchmark / preview 层

#### Phase323C 第二刀

- 新增一份脚本索引文档，而不是先改脚本名。
- 文档中给出：
  - “日常必须跑”
  - “发布前才跑”
  - “历史兼容，不建议默认跑”
  - “研究脚本，不进入主链”

#### Phase323C 第三刀

- 再考虑为历史脚本增加统一前缀策略或维护清单。
- 只有在核心回归完全稳定后，才考虑物理归档。

## 5. consolePage.js 模块化建议

### 5.1 本阶段判断

- `consolePage.js` 仍是单文件 UI。
- 它已经承担：
  - 页面 shell
  - 5 模块导航
  - 状态管理
  - fetch API 调用
  - 页面渲染
  - 详情抽屉 / evidence / diagnostics / approvals / files / provider config / chat 交互
- 这已是明确的“应拆分但不能暴力重写”状态。

### 5.2 设计原则

- 保持 `/ui` 入口不变
- 保持 5 个主模块不变
- 保持 fetch 调用语义不变
- 保持 `selectedModel` localStorage 行为不变
- 不引入 React / Vue / Angular
- 不引入复杂构建链
- 优先原生 ESM 模块
- 不改变真实 Chat 请求体：
  - `mode=manual_model`
  - `dryRun=false`
  - `selectedModel={ providerId, modelId }`

### 5.3 建议拆分边界

#### `ui/shell/`

- `workbenchShell.js`
- 责任：
  - 页面外层布局
  - 左侧 5 模块导航
  - 主区域切换
  - evidence drawer 容器

#### `ui/state/`

- `workbenchState.js`
- 责任：
  - 当前页面状态
  - selected model / provider
  - loading / error / diagnostics snapshot
  - localStorage 读写封装

#### `ui/api/`

- `workbenchApiClient.js`
- 责任：
  - 所有 fetch 封装
  - 保持原路径不变
  - 保持请求/响应 schema 不变

#### `ui/pages/chat/`

- `chatPage.js`
- 责任：
  - Chat 页面布局与发送交互
  - 保持 `/chat-gateway/execute`
  - 保持 `manual_model` / `dryRun=false` / `selectedModel` 语义

#### `ui/pages/provider-config/`

- `providerConfigPage.js`
- 责任：
  - NVIDIA key 遮罩状态展示
  - 保存配置
  - 测试连接
  - 页面模型设置

#### `ui/pages/approvals/`

- `approvalsPage.js`
- 责任：
  - 审批队列
  - 创建测试审批任务
  - 批准 / 拒绝 / 执行受控动作

#### `ui/pages/file-context/`

- `fileContextPage.js`
- 责任：
  - 文件登记 / 预览
  - 明确“仅登记 / 预览”

#### `ui/pages/diagnostics/`

- `diagnosticsPage.js`
- 责任：
  - 服务状态
  - provider 状态
  - 最近一次 chat 与错误摘要

#### `ui/shared/components/`

- `statusBadge.js`
- `sectionCard.js`
- `evidenceDrawer.js`
- `emptyState.js`
- 责任：
  - 通用 UI 片段

#### `ui/shared/`

- `renderUtils.js`
- 责任：
  - escape / format / small helpers

### 5.4 推荐迁移顺序

1. 先抽 `apiClient`
2. 再抽 `state/store`
3. 再抽 `pages/chat`
4. 再抽 `pages/providerConfig`
5. 再抽 `approvals/files/diagnostics`
6. 最后抽 `shell/layout` 与 shared 组件

原因：

- 先抽 API 和状态，能在不重写 DOM 的情况下稳定边界。
- Chat 页最敏感，应在最小改动下先独立，保护 322A 主链。

## 6. httpServer.js 路由拆分建议

### 6.1 本阶段判断

- `httpServer.js` 只有 1 个文件承载 HTTP 主路由。
- 当前已经同时承载：
  - health
  - UI
  - model library
  - provider config
  - approvals
  - file context
  - diagnostics
  - chat gateway
  - 多批历史能力与兼容路由

这不是功能错误，但已经是维护风险。

### 6.2 设计原则

- 不改变任何现有路由路径
- 不改变响应 schema
- 不改变 `/chat-gateway/execute`
- 不默认暴露隐藏模块
- 不删除 enterprise / workflow / workforce / knowledge 代码
- 先设计迁移顺序，再进入后续 Phase 执行

### 6.3 建议拆分边界

- `routes/healthRoutes.js`
- `routes/uiRoutes.js`
- `routes/chatGatewayRoutes.js`
- `routes/modelLibraryRoutes.js`
- `routes/providerConfigRoutes.js`
- `routes/approvalRoutes.js`
- `routes/fileContextRoutes.js`
- `routes/diagnosticsRoutes.js`
- `routes/hiddenExperimentalRoutes.js`
- `routeRegistry.js`

### 6.4 迁移顺序建议

#### Phase323E 第一刀

- 先拆只读、低风险路由：
  - `healthRoutes`
  - `uiRoutes`
  - `diagnosticsRoutes`

#### Phase323E 第二刀

- 再拆中风险但结构清晰的路由：
  - `providerConfigRoutes`
  - `fileContextRoutes`
  - `approvalRoutes`

#### Phase323E 第三刀

- 最后拆最关键的主链：
  - `modelLibraryRoutes`
  - `chatGatewayRoutes`

#### `hiddenExperimentalRoutes.js`

- 只收纳当前不应默认暴露、但暂不删除的历史路由入口。
- 目的不是继续开放，而是把风险路由与主产品面隔离。

#### `routeRegistry.js`

- 只做统一注册，不改变 handler 内部逻辑。
- 第一轮仅迁移分发，不做 handler 逻辑重写。

## 7. 不应触碰的主链保护点

- `/chat-gateway/execute` 路由行为
- Workbench Chat 请求体结构
- `manual_model` 真实请求模式
- `dryRun=false` 默认真实聊天语义
- `selectedModel={ providerId, modelId }` 传参方式
- 当前 NVIDIA key 安全读取与 mask / redact 逻辑
- 当前 selectable model gate
- 当前 approval gate / forbidden paths
- 当前 5 模块默认 UI
- 当前 evidence / diagnostics 对真实调用与非真实调用的区分

## 8. 后续 Phase323C / Phase323D / Phase323E 建议

### Phase323C：package scripts / entrypoint 分层归档

- 目标：
  - 不删脚本，先做分层目录与索引策略
  - 明确核心链、历史兼容链、研究链
- 最小交付：
  - 一份脚本分层索引
  - 一份 entrypoint 归档候选清单
  - 可选的小范围 alias，不改核心脚本名

### Phase323D：consolePage.js 原生 ESM 模块化第一刀

- 目标：
  - 把 `consolePage.js` 从单文件 UI 拆成最小可落地模块
- 第一刀边界：
  - `apiClient`
  - `state/store`
  - `chatPage`
- 成功标准：
  - `/ui` 入口不变
  - 5 模块不变
  - 322A 主链不回退

### Phase323E：httpServer.js routeRegistry 拆分第一刀

- 目标：
  - 在不改响应 schema 的前提下，把 `httpServer.js` 改为注册器 + 子路由模块
- 第一刀边界：
  - `healthRoutes`
  - `uiRoutes`
  - `diagnosticsRoutes`
- 成功标准：
  - 路径不变
  - schema 不变
  - `/chat-gateway/execute` 不动

## 9. 风险清单

- 历史 verifier 数量过大，直接删除极易误伤未知依赖。
- `consolePage.js` 拆分如果先动 chat/DOM 结构，可能破坏 322A 主链。
- `httpServer.js` 拆分如果先动 chat gateway 路由，风险高于收益。
- providers 目录已经存在多 provider 适配文件，但当前产品真实策略仍是 NVIDIA-only；架构清理时不能误把“文件存在”当成“产品开放”。
- 旧 UI / browser / screenshot / workforce / enterprise / release 相关 phase 数量大，后续需要明确“兼容保留”与“默认不跑”的边界。

## 10. 验证命令清单

Phase323B 只新增报告时，推荐验证命令：

```powershell
cmd /c pnpm run health:phase12a
cmd /c pnpm run doctor:phase13a
cmd /c pnpm run verify:phase321a-workbench-product-recovery
cmd /c pnpm run verify:phase313a-model-usability-matrix
cmd /c pnpm run verify:phase107a-secret-safety
cmd /c pnpm -r --if-present check
```

说明：

- 如果环境未配置 NVIDIA key，不应把 Phase322A 真实调用失败视为本阶段回退。
- 本阶段重点是“只读审计 + 计划输出”，不是重新做真实 provider 调用。

## 11. 是否可进入下一阶段

结论：可以进入下一阶段，但应严格按顺序推进。

建议顺序：

1. 先做 Phase323C：scripts / entrypoints 分层归档
2. 再做 Phase323D：`consolePage.js` 原生 ESM 模块化第一刀
3. 最后做 Phase323E：`httpServer.js` route registry 第一刀

原因：

- 当前最大的风险不是“缺功能”，而是“主链成功后维护复杂度过高”。
- 先做脚本与入口分层，有助于降低后续清理时的误伤概率。
- 再做 UI 单文件拆分，能先降低前端维护难度。
- 最后再碰 `httpServer.js`，避免在最早阶段误伤 `/chat-gateway/execute`。
