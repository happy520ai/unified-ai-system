# NeuralForge UI 设计方案
## 基于系统真实能力的界面重构建议

---

## 一、系统真实画像

通读完整个代码仓库后，我发现这套系统和之前做的通用 AI 网关 UI 有本质区别。这不是一个简单的 SaaS 代理平台，而是一个**本地优先的 AI 网关 + 智能体劳动力编排系统**。它有非常独特的核心身份：

### 系统核心能力清单（从代码中提取）

| 能力层 | 真实能力 | 对应 API |
|--------|---------|---------|
| **三模执行** | Normal（直出）、God（多候选评审）、Tianshu（元路由）三种执行模式 | `/three-mode/execute` |
| **智能路由** | 基于任务压力、成本压力、延迟压力、可靠性压力的多维度路由决策引擎 | `/routing/answer-path/preview`、`/routing/quality-cost/preview` |
| **30+ 模型供应商** | OpenAI、NVIDIA、Anthropic、DeepSeek、通义、智谱、文心、MiMo 等 30 余个供应商 | `/providers`、`/model-library` |
| **员工劳动力** | AI 智能体以"员工"身份运作，有 7 级金字塔（L0 系统治理者 → L6 助理），协作协议、通信总线 | `/workforce/*` |
| **分支执行** | 任务分叉为产品/工程/安全三条并行路径，各自分配员工执行后合并 | workforce-execution-fabric |
| **GVC 权限引擎** | 文件变更、Shell 命令、Provider 调用、密钥读取、部署、路由修改的分级权限控制 | gvc-permission-engine |
| **知识库 RAG** | SQLite 向量存储、PDF/DOCX/XLSX 文档解析、语义检索 | `/knowledge/*` |
| **安全审计** | 企业级 RBAC、审计日志、备份恢复、密钥脱敏、漏洞扫描 | `/enterprise/*` |
| **IM 连接器** | 飞书/企业微信机器人推送（dry-run 模式） | `/connectors/*` |
| **Codex 上下文** | Token 预算管控、上下文压缩编码、Codex Prompt 包构建 | codex-context-gateway |
| **响应缓存** | 语义去重、新鲜度守卫、审计追踪 | `/cache/*` |
| **成本管控** | Token 成本守卫、预算策略、成本账本、估算器校准 | `/cost/*` |
| **审批流** | 分级审批（低风险自动/高风险人工）、审批队列、审批历史 | `/approvals/*` |
| **证据追踪** | 每个操作都生成 JSON 证据文件，记录做了什么、没做什么、安全边界 | evidence/ |
| **本地操作** | 桌面自动化、代码补丁提案、受控执行循环 | `/agent-runner/*`、`/local-operation/*` |

---

## 二、当前 UI 与真实系统的差距

### 现在做的 UI 是什么

当前做的是通用 SaaS AI 网关的"外壳"——仪表盘、模型路由、API 密钥、用量分析、安全策略、知识库、团队管理、设置。这是一套标准的企业 SaaS 管理后台模板。

### 缺失了什么

1. **三模执行器** — 系统最核心的差异化能力（Normal/God/Tianshu），UI 里完全没有体现
2. **员工劳动力面板** — 7 级金字塔、员工目录、协作会话、分支执行可视化
3. **审批队列** — 系统有完整的审批流（`/approvals/*`），UI 没有审批中心
4. **GVC 权限面板** — 权限规则引擎的可视化管理
5. **证据审计时间线** — 每个阶段的证据文件可视化
6. **Codex 上下文网关** — Token 预算可视化、上下文包预览
7. **IM 连接器管理** — 飞书/企微的连接器配置
8. **本地操作台** — Agent Runner 的操作意图预览、补丁提案审批
9. **Provider 上线向导** — 新供应商的发现 → 准入 → 冒烟测试 → 上线的完整流程
10. **70+ API 的完整覆盖** — 当前 UI 只覆盖了约 10% 的 API

---

## 三、重构后的 UI 架构建议

基于系统真实能力，建议将界面重构为 **6 大功能区**：

```
┌─────────────────────────────────────────────────────┐
│ NeuralForge Console                                  │
├──────────┬──────────────────────────────────────────┤
│          │                                           │
│ ① 总控台 │  实时状态 · 三模执行器 · 审批队列          │
│          │                                           │
│ ② 路由中心│  模型库(30+) · 路由策略 · 成本监控        │
│          │                                           │
│ ③ 劳动力  │  员工目录 · 金字塔 · 协作会话 · 分支执行  │
│          │                                           │
│ ④ 知识库  │  文档管理 · RAG检索 · Embedding配置       │
│          │                                           │
│ ⑤ 安全塔  │  GVC权限 · 审批流 · 审计日志 · IM连接器   │
│          │                                           │
│ ⑥ 操作台  │  Codex上下文 · 本地操作 · 补丁提案 · 证据 │
│          │                                           │
└──────────┴──────────────────────────────────────────┘
```

---

## 四、各功能区详细设计

### ① 总控台（Dashboard 重构）

不再是通用的统计仪表盘，而是**系统运行状态的实时指挥屏**。

**顶部状态栏**
- 服务健康：`/health/check` → 绿灯/红灯
- 当前执行模式：Normal / God / Tianshu（带模式说明 tooltip）
- 待审批数：`/approvals` → 红色角标
- 活跃员工数：`/workforce/agents` → 数字

**核心指标卡片（4 张）**
- 今日请求 → `/dashboard/status`
- Token 消耗 → `/cost/summary`
- 路由延迟 → 从 dashboard status 提取
- 缓存命中率 → `/cache/summary`

**三模执行器面板（核心差异化）**
这是系统最独特的功能，应该占据仪表盘的核心位置：
```
┌──────────────────────────────────────────────────┐
│ 三模执行器                                        │
│                                                   │
│ [Normal] 直出模式                                  │
│  当前任务: 翻译英文文档 → 推荐模型: DeepSeek-V3     │
│  预估成本: ¥0.02 · 预估延迟: 340ms                 │
│                                                   │
│ [God] 多候选评审模式                                │
│  方案A: GPT-4o (快速) — 方案B: Claude 3.5 (平衡)   │
│  方案C: DeepSeek-V3 (经济) — 冲突: 无              │
│  推荐: 方案B · 置信度: 87%                         │
│                                                   │
│ [Tianshu] 元路由模式                                │
│  任务评分: 0.73 · 推荐模式: God                     │
│  关键词命中: 架构评审, 安全敏感                      │
│                                                   │
│           [▶ 执行]  [预览路由]  [查看证据]           │
└──────────────────────────────────────────────────┘
```

**审批队列（侧边面板）**
- 实时拉取 `/approvals` 数据
- 每条审批显示：类型（provider_call/file_mutation/shell_command）、风险等级、申请人、时间
- 操作：[批准] [拒绝] [查看详情]

---

### ② 路由中心（Model Routing 重构）

**模型库（30+ 供应商全景）**

不是简单的 6 个模型列表，而是完整的模型目录管理，对接 `/model-library` 和 `/model-library/usability-matrix`：

```
┌─────────────────────────────────────────────────┐
│ 模型目录 · 148 个模型 · 17 个可选 · 12 个高风险   │
│                                                   │
│ 按供应商分组:                                      │
│ ┌─ NVIDIA (3) ──────────────────────────────┐    │
│ │ Nemotron-120B ● 可选  延迟890ms  成本$$$  │    │
│ │ Nemotron-49B  ● 可选  延迟520ms  成本$$   │    │
│ │ Nemotron-8B   ● 可选  延迟180ms  成本$    │    │
│ └────────────────────────────────────────────┘    │
│ ┌─ OpenAI (5) ──────────────────────────────┐    │
│ │ GPT-4o        ○ 待验证  延迟-    成本$$$$ │    │
│ │ GPT-4o-mini   ● 可选  延迟230ms  成本$    │    │
│ │ ...                                        │    │
│ └────────────────────────────────────────────┘    │
│ ┌─ 国内供应商 (12) ─────────────────────────┐    │
│ │ DeepSeek-V3   ● 可选   延迟340ms  成本$   │    │
│ │ 通义千问-Max  ● 可选   延迟410ms  成本$   │    │
│ │ 智谱 GLM-4    ○ 未连接  延迟-     成本$$  │    │
│ │ ...                                        │    │
│ └────────────────────────────────────────────┘    │
│                                                   │
│ [导入新模型]  [刷新目录]  [冒烟测试]  [可用性矩阵] │
└─────────────────────────────────────────────────┘
```

**路由策略可视化**
对接 `/routing/answer-path/preview` 和 `/routing/quality-cost/preview`：
- 输入一个任务描述 → 实时预览路由决策
- 显示：任务压力分类、候选模型评分、选中原因、fallback 链
- 可视化路由权重（哪些模型被加权、哪些被降权）

**成本监控**
对接 `/cost/summary` 和 `/cost/health`：
- Token 消耗趋势图
- 按供应商/模型的成本分布
- 预算进度条（`/cost/guard/check`）
- 缓存节省统计（`/cache/summary`）

**Provider 上线向导**
对接 provider-expansion 流程：
```
发现 → 准入评估 → 冒烟测试 → 成本配额 → 上线
 [1]    [2]       [3]        [4]       [5]
```
每一步都有审批门禁，可视化整个上线进度。

---

### ③ 劳动力中心（全新模块）

这是系统最独特的概念层，需要专门的可视化界面。

**员工目录**
对接 `/workforce/agents`：
```
┌──────────────────────────────────────────────────┐
│ 员工目录 · 7 名员工                                │
│                                                   │
│ ┌─ L0 系统治理者 ─────────────────────────────┐  │
│ │ 🔒 emp-system-governor                      │  │
│ │    领域: Governance · 风险: High · 状态: 活跃│  │
│ │    最大并发: 1 · 需审批: 是                   │  │
│ └─────────────────────────────────────────────┘  │
│                                                   │
│ ┌─ L2 领域主管 ──────────────────────────────┐   │
│ │ 👔 emp-product-chief                        │   │
│ │    领域: Product · 风险: Medium              │   │
│ │ 👔 emp-security-chief                       │   │
│ │    领域: Security · 风险: High               │   │
│ └─────────────────────────────────────────────┘  │
│                                                   │
│ ┌─ L3 资深专家 ──────────────────────────────┐   │
│ │ 🧑‍💻 emp-ai-gateway-engineer                  │   │
│ │    领域: Engineering · 脑绑定: dry_run       │   │
│ │ 🔍 emp-ux-researcher                        │   │
│ │    领域: Design · 脑绑定: dry_run            │   │
│ └─────────────────────────────────────────────┘  │
│ ...                                               │
└──────────────────────────────────────────────────┘
```

**金字塔可视化**
用 SVG 画一个 7 层金字塔，每层显示：
- 层级名称（L0-L6）
- 当前活跃员工数 / 最大并发数
- 该层的扇出策略（max candidates, max active）

**协作会话面板**
对接 employee-communication-bus：
- 显示活跃的通信线程（thread）
- 消息类型可视化：ask、reply、review_request、handoff、objection、approval_request
- 房间（room）列表：domain_room、task_room、review_room、approval_room
- 协作模式标识：solo、pair_review、council_review、domain_handoff

**分支执行可视化**
对接 workforce-execution-fabric：
```
任务: "评审新的路由策略"
         │
    ┌────┼────┐
    │    │    │
 Product  Engineering  Safety
 (产品)    (工程)       (安全)
    │         │          │
 product-   gateway-    security-
 chief +    engineer +  chief
 ux-        qa-
 researcher engineer
    │         │          │
    └────┬────┘          │
         │               │
    合并结果 ← 冲突检测 ←─┘
         │
    最终建议
```

---

### ④ 知识库（RAG 增强）

**文档管理**
对接 `/knowledge/sources`、`/knowledge/file-types`：
- 文档列表 + 上传（支持 PDF、DOCX、XLSX、TXT）
- 分块状态可视化（chunks count, vector dimensions）
- 基础设施就绪度指示器（`/knowledge/infra/readiness`）

**RAG 检索测试台**
对接 `/knowledge/retrieve` 和 `/knowledge/graph/retrieve`：
- 输入查询 → 显示 Top-K 检索结果
- 每条结果显示：相关度分数、来源文档、匹配片段
- 对比普通检索 vs 图谱检索的结果差异

**RAG Chat 测试**
对接 `/chat/rag` 和 `/chat/rag/stream`：
- 带知识增强的聊天界面
- 显示引用来源（哪个文档、哪个片段）

---

### ⑤ 安全塔（Governance 重构）

**GVC 权限引擎面板**
对接 gvc-permission-engine：
```
┌──────────────────────────────────────────────┐
│ 权限规则引擎                                   │
│                                                │
│ 动作类型:                                       │
│ [●] file_mutation    → 路径: /src/** → allow   │
│ [●] shell_command    → 全局 → approval_required│
│ [●] provider_call    → 全局 → approval_required│
│ [●] secret_read      → 全局 → forbidden        │
│ [●] deploy           → 全局 → forbidden        │
│ [●] chat_route_modify→ 全局 → deny             │
│                                                │
│ Shell 命令分类器:                                │
│ 安全读取 ✓  安全测试 ✓  Git变更 ⚠  网络访问 ⚠  │
│ 密钥风险 ✗  Provider风险 ✗  部署风险 ✗          │
└──────────────────────────────────────────────┘
```

**审批中心**
对接 `/approvals`、`/approvals/create`、`/approvals/:id/approve`、`/approvals/:id/reject`：
- 待审批队列（按风险等级排序）
- 审批历史（已批准/已拒绝/已过期）
- 每条审批详情：请求类型、风险标记、发起人、时间线

**企业审计**
对接 `/enterprise/audit`、`/enterprise/audit/export`：
- 操作日志表格：时间、用户、动作、目标、结果
- 审计导出按钮
- 安全评分卡（`/enterprise/security/readiness`）

**IM 连接器管理**
对接 `/connectors`：
- 飞书连接器：Webhook URL 配置、消息格式预览（text/card）、连接测试
- 企业微信连接器：Webhook URL 配置、消息格式预览（text/markdown）、连接测试
- 发送测试消息功能（`/connectors/feishu/send`、`/connectors/wecom/send`）

---

### ⑥ 操作台（Developer Tools）

**Codex 上下文网关面板**
- Token 预算可视化（8K/16K 配置文件）
- 上下文包预览：哪些文件被选中、token 估算、压缩比
- 上下文新鲜度检测状态

**本地操作台**
对接 `/agent-runner/intent-approval-preview`、`/agent-runner/local-operation`、`/local-agent/patch-proposal`：
```
┌──────────────────────────────────────────────┐
│ 本地操作意图预览                                │
│                                                │
│ 任务: "优化路由算法的性能"                       │
│                                                │
│ 意图分类: code_mutation                        │
│ 影响文件: 3 个                                  │
│ 风险等级: Medium                                │
│                                                │
│ 补丁提案:                                       │
│ ┌────────────────────────────────────────────┐│
│ │ - function route(request) {                ││
│ │ + function route(request, options = {}) {  ││
│ │ +   const cached = cache.get(request.key); ││
│ │ +   if (cached) return cached;             ││
│ │ ...                                        ││
│ └────────────────────────────────────────────┘│
│                                                │
│ [批准并应用]  [拒绝]  [修改后重新提交]           │
└──────────────────────────────────────────────┘
```

**证据浏览器**
对接 evidence/ 目录：
- 时间线视图：按阶段展示证据文件
- 每条证据显示：phase 编号、完成状态、安全断言、blockers
- 安全边界可视化：providerCallsMade、secretValueExposed、chatModified 等

---

## 五、导航结构建议

```
NeuralForge Console
│
├── 总控台 (Dashboard)
│   ├── 实时状态概览
│   ├── 三模执行器
│   └── 审批队列
│
├── 路由中心 (Routing)
│   ├── 模型目录 (30+ models)
│   ├── 路由策略
│   ├── 成本监控
│   └── Provider 上线向导
│
├── 劳动力 (Workforce)
│   ├── 员工目录 & 金字塔
│   ├── 协作会话
│   └── 分支执行
│
├── 知识库 (Knowledge)
│   ├── 文档管理
│   ├── RAG 检索测试
│   └── Embedding 配置
│
├── 安全塔 (Security)
│   ├── GVC 权限引擎
│   ├── 审批中心
│   ├── 审计日志
│   ├── 企业管理
│   └── IM 连接器
│
├── 操作台 (DevTools)
│   ├── Codex 上下文
│   ├── 本地操作台
│   ├── 补丁提案
│   └── 证据浏览器
│
└── 设置 (Settings)
    ├── Provider 配置
    ├── 通知偏好
    ├── 账单
    └── 备份 & 恢复
```

---

## 六、设计风格建议

### 核心理念：不是 SaaS 管理后台，而是"本地 AI 作战指挥室"

1. **深色主题优先** — 系统本质是开发者工具/运维控制台，深色主题更合适长时间操作
2. **终端风格点缀** — 操作台和证据浏览器区域使用等宽字体、终端风格的日志显示
3. **实时数据流** — 大量使用 WebSocket 实时推送（系统已有 `/ws` 端点），让状态变化即时可见
4. **审批驱动交互** — 系统的安全基因决定了 UI 应该是"请求-审批-执行"的交互模式，而不是"点击即生效"
5. **证据可视化** — 每个操作都应该有"查看证据"的入口，展示安全断言和执行记录
6. **模式指示器** — 始终在顶栏显示当前执行模式（Normal/God/Tianshu），这是系统的核心身份标识

### 色调方案

- 主背景：`#0f0f14`（深蓝黑）
- 面板背景：`#1a1a24`（略浅的深蓝黑）
- 边框：`#2a2a3a`（暗紫灰）
- 主强调色：`#7c3aed`（紫，保持 NeuralForge 品牌）
- 成功色：`#34d399`（绿）
- 警告色：`#fbbf24`（黄）
- 危险色：`#f87171`（红）
- 文字主色：`#e2e8f0`（浅灰白）
- 文字辅色：`#94a3b8`（灰蓝）

---

## 七、实施优先级建议

| 优先级 | 页面 | 理由 |
|--------|------|------|
| P0 | 总控台（含三模执行器） | 系统核心差异化，必须第一个做 |
| P0 | 路由中心（模型目录 + 路由策略） | 对接 30+ 模型和路由引擎 |
| P1 | 劳动力中心 | 最独特的概念，金字塔 + 员工目录 |
| P1 | 安全塔（审批中心 + GVC 权限） | 安全基因的核心体现 |
| P2 | 知识库 | 功能相对独立，可以后做 |
| P2 | 操作台 | 开发者工具，目标用户更窄 |
| P3 | 设置 & IM 连接器 | 配置类页面 |

---

## 八、与当前已做 UI 的关系

当前已做的 10 个页面（index/login/dashboard/routing/apikeys/analytics/security/knowledge/team/settings）可以作为基础骨架保留，但需要做以下关键调整：

1. **dashboard.html** → 增加三模执行器面板、审批队列、模式指示器
2. **routing.html** → 扩展为 30+ 模型目录，增加路由策略可视化、Provider 上线向导
3. **apikeys.html** → 整合进设置页面（它只是设置的一个子功能）
4. **analytics.html** → 合并进路由中心的成本监控
5. **security.html** → 重构为 GVC 权限引擎 + 审批中心
6. **knowledge.html** → 增加 RAG 检索测试台
7. **team.html** → 重构为劳动力中心（员工目录 + 金字塔 + 协作）
8. **settings.html** → 增加 Provider 配置、IM 连接器、备份恢复
9. **新增：操作台页面** — Codex 上下文、本地操作台、补丁提案、证据浏览器
10. **全局：切换到深色主题** — 更符合开发者工具定位

---

*基于对 unified-ai-system 全部 24 个 packages、2 个 apps、70+ API 端点、1000+ 开发阶段的深度分析生成。*
