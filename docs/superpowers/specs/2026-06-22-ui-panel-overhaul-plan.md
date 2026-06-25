# UI 全板块整改计划：小米设计语言 × qoder 可执行

> **日期**：2026-06-22
> **目标**：80+ 面板 → 分类 → 合并 → 统一视觉 → 卡片转场 → qoder 直接执行
> **设计理念**：小米 HyperOS（减/圆/轻/动）
> **配套文档**：`2026-06-22-ui-redesign-xiaomi-style.md`（视觉规范）

---

## 一、面板分类与处置总表

当前 80+ 面板，按用户角色和使用频率分为 5 类：

### A 类：日常使用（老板每天看）→ 芯片展开面板

| 面板 | 处置 | 目标形态 |
|------|------|----------|
| OwnerDailyReportSurface | **重设计** → 日报面板 | 从"看看日报"芯片展开 |
| OwnerAutomationCommandPalette | **重设计** → 审批面板 | 从"审批"芯片展开 |
| WorkforcePreviewPanel | **重设计** → 员工状态面板 | 从"员工在干嘛"芯片展开 |
| OwnerSignalCard | **删除** → 内容并入日报面板 | — |
| OwnerStatusCard | **删除** → 状态融入 SystemFirstLine 语气 | — |
| OwnerHeroCommand | **删除** → 被 ConversationShell 取代 | — |
| OwnerPrimaryAction | **删除** → 被 ReplyField 取代 | — |
| OwnerTaskInput | **删除** → 被 ReplyField 取代 | — |
| OwnerAutomationResultCard | **合并** → 审批面板内 | — |
| OwnerAutomationCommandCard | **合并** → 审批面板内 | — |
| OwnerTrialFeedbackPanel | **合并** → 日报面板内 | — |

### B 类：监控概览（偶尔查看）→ 更多抽屉卡片

| 面板 | 处置 | 目标形态 |
|------|------|----------|
| MissionControlPanel | **重设计** → 监控总览卡片 | "更多"抽屉里的卡片 |
| NormalModePanel | **合并** → 监控总览内 | — |
| GodModePanel | **合并** → 监控总览内 | — |
| TianshuModePanel | **合并** → 监控总览内 | — |
| ThreeModeOverviewPanel | **合并** → 监控总览内 | — |
| GlobalModelLibraryPanel | **重设计** → 模型管理卡片 | "更多"抽屉里的卡片 |
| GlobalModelOpsPanel | **合并** → 模型管理卡片内 | — |
| ProviderCredentialRefPanel | **重设计** → Provider 配置卡片 | "更多"抽屉里的卡片 |
| ProductWorkModeDashboardPanel | **重设计** → 工作模式卡片 | "更多"抽屉里的卡片 |

### C 类：工程面板（工程师用）→ 更多抽屉二级展开

| 面板 | 处置 | 目标形态 |
|------|------|----------|
| GodModeConflictMapPanel | **合并** → 工程面板合集 | "更多"→"工程工具" |
| GodTianshuEnsemblePanel | **合并** → 工程面板合集 | — |
| ModelRoutingPanel | **合并** → 工程面板合集 | — |
| ModelRoutingSurrogateSoakPanel | **合并** → 工程面板合集 | — |
| RealModelRoutingPanel | **合并** → 工程面板合集 | — |
| RouteAffinityPanel | **合并** → 工程面板合集 | — |
| RouteQualityAuditPanel | **合并** → 工程面板合集 | — |
| RouteQualityRound2Panel | **合并** → 工程面板合集 | — |
| TianshuRouteComparisonPanel | **合并** → 工程面板合集 | — |
| ProviderCallAuthenticityPanel | **合并** → 工程面板合集 | — |
| GvcRunnerDashboardPanel | **合并** → 工程面板合集 | — |
| TokenSavingDashboardPanel | **合并** → 工程面板合集 | — |
| ScenarioTrialPanel | **合并** → 工程面板合集 | — |
| ScenarioDryRunResultPanel | **合并** → 工程面板合集 | — |
| RiskFieldPanel | **合并** → 工程面板合集 | — |
| SecurityNegativeSourceMapPanel | **合并** → 工程面板合集 | — |

### D 类：员工管理（workforce 相关）→ 员工面板二级展开

| 面板 | 处置 | 目标形态 |
|------|------|----------|
| EmployeePyramidPanel | **合并** → 员工管理面板 | "员工在干嘛"→"员工管理" |
| PositionLibraryPanel | **合并** → 员工管理面板 | — |
| InternalEmployeeCommunicationPanel | **合并** → 员工管理面板 | — |
| BranchExecutionPreviewPanel | **合并** → 员工管理面板 | — |
| WorkforceSchedulerPanel | **合并** → 员工管理面板 | — |
| FiveCapabilityActivationPanel | **合并** → 员工管理面板 | — |
| OwnerNeuralSkillPreviewPanel | **合并** → 员工管理面板 | — |
| CapabilityCellCandidatePanel | **合并** → 员工管理面板 | — |
| NeuralFabricReadOnlyPanel | **合并** → 员工管理面板 | — |

### E 类：高级/安全（几乎不用）→ 最深层

| 面板 | 处置 | 目标形态 |
|------|------|----------|
| TaijiBeidouPanel | **合并** → 高级面板合集 | "更多"→"工程工具"→"高级" |
| TaijiBeidouAutoRuntimePanel | **合并** → 高级面板合集 | — |
| TaijiBeidouDryRunReadoutPreviewPanel | **合并** → 高级面板合集 | — |
| TaijiBeidouLocalDogfoodingMainlinePanel | **合并** → 高级面板合集 | — |
| TaijiBeidouMissionControlVisualizationPanel | **合并** → 高级面板合集 | — |
| TaijiBeidouProductionOpsPanel | **合并** → 高级面板合集 | — |
| TaijiBeidouProductionReadinessPanel | **合并** → 高级面板合集 | — |
| TaijiBeidouRealLocalDogfoodingIntakePanel | **合并** → 高级面板合集 | — |
| TaijiBeidouRealProviderRuntimePanel | **合并** → 高级面板合集 | — |
| CodexContextGatewayPanel | **合并** → 高级面板合集 | — |
| LongHorizonHardeningPanel | **合并** → 高级面板合集 | — |
| SevenDaySoakEntryPanel | **合并** → 高级面板合集 | — |
| ModelRoutingSurrogateSoakPanel | **合并** → 高级面板合集 | — |
| BugIntakeGovernancePanel | **合并** → 高级面板合集 | — |
| EvidenceCoherencePanel | **合并** → 高级面板合集 | — |
| FieldSnapshotTimelinePanel | **合并** → 高级面板合集 | — |
| ConceptFieldPreviewPanel | **合并** → 高级面板合集 | — |
| OwnerBossViewPanel | **删除** → 被 ConversationShell 取代 | — |
| OwnerAdvancedDrawer | **删除** → 被 MoreDrawer 取代 | — |
| GuardedCandidateNotice | **保留** → 通用通知组件 | — |
| SleepCandidateReviewDrawer | **保留** → 通用抽屉组件 | — |
| OperatorReviewChecklistPanel | **合并** → 高级面板合集 | — |
| LocalSelfUseEvidenceLedgerPanel | **合并** → 高级面板合集 | — |
| LocalSelfUseIssueLedgerPanel | **合并** → 高级面板合集 | — |
| LocalSelfUseRoutingV1Panel | **合并** → 高级面板合集 | — |
| UserOwnedProviderExpansionPanel | **合并** → 高级面板合集 | — |
| FutureMinimalOsPanel | **删除** → 被 ConversationShell 取代 | — |

### F 类：依依（Yiyi）→ 独立可选模块

| 面板 | 处置 | 目标形态 |
|------|------|----------|
| YiyiAvatarLayer | **保留但简化** → 可选浮窗 | 默认隐藏，"更多"里开启 |
| YiyiAvatarStage | **保留但简化** | — |
| YiyiLiveAvatarStage | **保留但简化** | — |
| YiyiBrainPanel | **合并** → 依依设置 | — |
| YiyiCharacterSettingsPanel | **合并** → 依依设置 | — |
| YiyiEmotionPanel | **合并** → 依依设置 | — |
| YiyiGuidedShowcasePanel | **合并** → 依依设置 | — |
| YiyiModelBrainPanel | **合并** → 依依设置 | — |
| YiyiMotionControls | **合并** → 依依设置 | — |
| YiyiVisualParts | **合并** → 依依设置 | — |
| YiyiLayeredAvatar | **合并** → 依依设置 | — |

---

## 二、合并后的目标面板清单

合并后只剩 **12 个面板**（原来是 80+）：

| # | 面板名称 | 入口 | 优先级 |
|---|----------|------|--------|
| 1 | **ConversationShell** | 首页（默认） | P0 |
| 2 | **DailyReportPanel** | "看看日报"芯片 | P0 |
| 3 | **ApprovalPanel** | "审批"芯片 | P0 |
| 4 | **WorkforceStatusPanel** | "员工在干嘛"芯片 | P0 |
| 5 | **MoreDrawer** | "⋯ 更多"按钮 | P0 |
| 6 | **MonitoringPanel** | "更多"→"监控"卡片 | P1 |
| 7 | **ModelManagementPanel** | "更多"→"模型"卡片 | P1 |
| 8 | **ProviderConfigPanel** | "更多"→"配置"卡片 | P1 |
| 9 | **WorkforceManagementPanel** | 员工状态→"管理员工" | P1 |
| 10 | **EngineeringToolsPanel** | "更多"→"工程工具"卡片 | P2 |
| 11 | **AdvancedPanel** | 工程工具→"高级" | P2 |
| 12 | **YiyiSettingsPanel** | "更多"→"依依设置"卡片 | P2 |

---

## 三、每个面板的视觉规范

### 通用面板模板（小米风格）

```
┌─────────────────────────────────────────────┐
│                                              │
│  ← 返回                          面板标题    │  ← 顶栏：返回箭头 + 标题
│  ────────────────────────────────────────── │  ← 分割线 #e8e8e8
│                                              │
│  区域标题 1                                   │  ← 区域标题：字号 13px，#888，大写
│  ┌─────────────────────────────────────┐    │     letter-spacing 0.05em
│  │ 卡片内容                             │    │  ← 卡片：白底，圆角 16px
│  │ 字号 15px，颜色 #1a1a1a              │    │     阴影 0 1px 3px rgba(0,0,0,0.06)
│  │                                      │    │     padding 16px
│  │                      [操作按钮]       │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │ 另一张卡片                           │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  区域标题 2                                   │
│  ┌─────────────────────────────────────┐    │
│  │ ...                                  │    │
│  └─────────────────────────────────────┘    │
│                                              │
└─────────────────────────────────────────────┘
```

### 通用卡片模板

```
┌─────────────────────────────────────────┐
│  图标  卡片标题              状态标签     │  ← 标题行
│                                          │
│  描述文字，字号 13px，颜色 #888           │  ← 描述
│  最多两行，超出省略                       │
│                                          │
│  [主要操作]  [次要操作]                   │  ← 操作区（可选）
└─────────────────────────────────────────┘

样式：
  背景：#ffffff
  圆角：16px
  阴影：0 1px 3px rgba(0,0,0,0.06)
  padding：16px
  间距：卡片之间 12px
```

### 通用按钮样式

```
主要按钮（Primary）：
  背景：#ff6700
  文字：#ffffff
  圆角：12px
  高度：40px
  字号：14px，字重 600
  hover：背景 #e55d00
  active：scale(0.97)

次要按钮（Secondary）：
  背景：transparent
  边框：1px solid #e8e8e8
  文字：#1a1a1a
  圆角：12px
  高度：40px
  hover：边框 #ff6700，文字 #ff6700

文字按钮（Ghost）：
  背景：transparent
  无边框
  文字：#888
  hover：文字 #1a1a1a
```

---

## 四、各面板详细设计

### 面板 1：ConversationShell（首页）

**文件**：`v5/ConversationShell.js`, `v5/SystemFirstLine.js`, `v5/ReplyField.js`, `v5/SuggestionChips.js`, `v5/ToneByStatus.js`, `conversationShellCopy.js`, `conversationShellClientJs.js`

**布局**：
```
┌─────────────────────────────────────────────┐
│                                              │
│                                              │
│                                              │
│                                              │
│      早上好。一切正常，想做点什么？              │  ← 居中，字号 32px
│                                              │     字重 400，#1a1a1a
│                                              │
│      ┌────────────────────────────────┐     │
│      │ 说点什么...                     │  →  │  ← 胶囊输入框
│      └────────────────────────────────┘     │     圆角 24px，高度 48px
│                                              │     边框 1px solid #e8e8e8
│      看看日报    审批    员工在干嘛            │  ← 芯片：圆角 20px
│                                              │     边框 1px solid #e8e8e8
│      ⋯ 更多                                  │     文字 #888
│                                              │  ← 更多：文字 #b0b0b0
│                                              │     无边框
│                                              │
└─────────────────────────────────────────────┘
```

**改动清单**：
- [ ] 删除 `OwnerOSShell.js` 中所有非 ConversationShell 的渲染代码
- [ ] 修改 `ConversationShell.js`：移除 MissionControlPanel 引用
- [ ] 修改 `ReplyField.js`：输入框改为胶囊形
- [ ] 修改 `SuggestionChips.js`：芯片改为小米风格
- [ ] 修改 `consolePageInlineCss.js`：添加小米风格 CSS
- [ ] 修改 `conversationShellClientJs.js`：添加芯片→面板转场逻辑

---

### 面板 2：DailyReportPanel（日报）

**文件**：新建 `panels/DailyReportPanel.js`，新建 `copy/dailyReportCopy.js`

**数据源**：复用 `OwnerDailyReportSurface.js` 的数据逻辑

**布局**：
```
┌─────────────────────────────────────────────┐
│                                              │
│  ← 返回                              日报    │
│  ────────────────────────────────────────── │
│                                              │
│  今日完成                                    │  ← 区域标题
│  ┌─────────────────────────────────────┐    │
│  │ ✅  客户反馈归类完成                   │    │  ← 完成项卡片
│  │     前三类：发货延迟 / 价格 / 质量      │    │     左侧绿色对勾
│  │     2 分钟前                          │    │     右侧时间戳
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │ ✅  周报已生成                        │    │
│  │     DeepSeek 生成，已发送              │    │
│  │     1 小时前                          │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  待处理                                      │  ← 区域标题
│  ┌─────────────────────────────────────┐    │
│  │ ⏳  审批：调整 DeepSeek 配置           │    │  ← 待处理卡片
│  │     风险低，建议批准                    │    │     左侧黄色时钟
│  │                        [批准] [拒绝]  │    │     右侧操作按钮
│  └─────────────────────────────────────┘    │
│                                              │
│  发现问题                                    │  ← 区域标题（条件显示）
│  ┌─────────────────────────────────────┐    │
│  │ ⚠️  服务健康检查发现延迟升高            │    │  ← 问题卡片
│  │     P95 延迟 3.2s，建议关注            │    │     左侧橙色警告
│  │                           [查看详情]  │    │
│  └─────────────────────────────────────┘    │
│                                              │
└─────────────────────────────────────────────┘
```

**改动清单**：
- [ ] 新建 `apps/ai-gateway-service/src/ui/components/panels/DailyReportPanel.js`
- [ ] 新建 `apps/ai-gateway-service/src/ui/copy/dailyReportCopy.js`
- [ ] 从 `OwnerDailyReportSurface.js` 提取数据逻辑
- [ ] 从 `OwnerSignalCard.js` 提取卡片渲染逻辑
- [ ] 从 `OwnerTrialFeedbackPanel.js` 提取反馈逻辑
- [ ] 添加到 `consolePageInlineCss.js` 的日报样式

---

### 面板 3：ApprovalPanel（审批）

**文件**：新建 `panels/ApprovalPanel.js`，新建 `copy/approvalCopy.js`

**数据源**：复用 `OwnerAutomationCommandPalette.js` 的数据逻辑

**布局**：
```
┌─────────────────────────────────────────────┐
│                                              │
│  ← 返回                              审批    │
│  ────────────────────────────────────────── │
│                                              │
│  待审批 (1)                                  │
│  ┌─────────────────────────────────────┐    │
│  │ 调整 DeepSeek 配置                   │    │  ← 审批卡片
│  │                                      │    │     标题：任务名
│  │ 风险等级：低                          │    │     详情：风险/申请人/原因
│  │ 申请人：product-chief                 │    │
│  │ 原因：生成周报需要更高质量模型         │    │
│  │                                      │    │
│  │                     [批准]  [拒绝]    │    │  ← 操作按钮
│  └─────────────────────────────────────┘    │     批准：#ff6700 填充
│                                              │     拒绝：灰色边框
│  已完成 (3)                                  │
│  ┌─────────────────────────────────────┐    │
│  │ ✅ 客户反馈归类         已批准        │    │  ← 已完成卡片
│  │ ✅ 数据库备份           已批准        │    │     绿色对勾
│  │ ✅ 安全扫描             已批准        │    │     状态标签
│  └─────────────────────────────────────┘    │
│                                              │
└─────────────────────────────────────────────┘
```

**改动清单**：
- [ ] 新建 `apps/ai-gateway-service/src/ui/components/panels/ApprovalPanel.js`
- [ ] 新建 `apps/ai-gateway-service/src/ui/copy/approvalCopy.js`
- [ ] 从 `OwnerAutomationCommandPalette.js` 提取数据逻辑
- [ ] 从 `OwnerAutomationResultCard.js` 提取结果渲染
- [ ] 从 `OwnerAutomationCommandCard.js` 提取命令卡片

---

### 面板 4：WorkforceStatusPanel（员工状态）

**文件**：新建 `panels/WorkforceStatusPanel.js`，新建 `copy/workforceStatusCopy.js`

**数据源**：复用 `WorkforcePreviewPanel.js` 的数据逻辑

**布局**：
```
┌─────────────────────────────────────────────┐
│                                              │
│  ← 返回                           员工状态   │
│  ────────────────────────────────────────── │
│                                              │
│  活跃员工                                    │
│  ┌────────────┐  ┌────────────┐            │
│  │ 🟢          │  │ 🟢          │            │
│  │ product     │  │ ux          │            │
│  │ chief       │  │ researcher  │            │
│  │             │  │             │            │
│  │ 空闲        │  │ 执行中      │            │
│  │             │  │ ▓▓▓░░ 60%   │            │  ← 进度条（可选）
│  └────────────┘  └────────────┘            │
│                                              │
│  ┌────────────┐  ┌────────────┐            │
│  │ 🟢          │  │ 🟡          │            │
│  │ ai gateway  │  │ security    │            │
│  │ engineer    │  │ chief       │            │
│  │             │  │             │            │
│  │ 空闲        │  │ 审计中      │            │
│  └────────────┘  └────────────┘            │
│                                              │
│  ┌────────────┐                             │
│  │ 🟢          │                             │
│  │ data        │                             │
│  │ engineer    │                             │
│  │             │                             │
│  │ 空闲        │                             │
│  └────────────┘                             │
│                                              │
│  [管理员工]  [查看历史]                       │  ← 底部操作
│                                              │
└─────────────────────────────────────────────┘
```

**改动清单**：
- [ ] 新建 `apps/ai-gateway-service/src/ui/components/panels/WorkforceStatusPanel.js`
- [ ] 新建 `apps/ai-gateway-service/src/ui/copy/workforceStatusCopy.js`
- [ ] 从 `WorkforcePreviewPanel.js` 提取数据逻辑
- [ ] 从 `WorkforceSchedulerPanel.js` 提取调度逻辑

---

### 面板 5：MoreDrawer（更多抽屉）

**文件**：修改 `v5/ConversationShell.js` 中的 MoreDrawer 部分

**布局**：
```
┌─────────────────────────────────────────────┐
│                                              │
│  更多功能                              收起 ↑ │
│  ────────────────────────────────────────── │
│                                              │
│  ┌──────────────┐  ┌──────────────┐        │
│  │  📊           │  │  🤖           │        │
│  │  系统监控      │  │  模型管理      │        │
│  │  服务正常      │  │  3 个模型      │        │
│  └──────────────┘  └──────────────┘        │
│                                              │
│  ┌──────────────┐  ┌──────────────┐        │
│  │  ⚙️           │  │  👥           │        │
│  │  运行配置      │  │  员工管理      │        │
│  │  NVIDIA 模式  │  │  5 名员工      │        │
│  └──────────────┘  └──────────────┘        │
│                                              │
│  ┌──────────────┐  ┌──────────────┐        │
│  │  🔧           │  │  🎭           │        │
│  │  工程工具      │  │  依依设置      │        │
│  │  路由/安全/调试 │  │  陪伴/性格     │        │
│  └──────────────┘  └──────────────┘        │
│                                              │
└─────────────────────────────────────────────┘
```

**卡片交互**：
- 点击卡片 → 从卡片位置生长为全屏面板（300ms）
- 面板内有返回按钮 → 缩回卡片位置（250ms）

**改动清单**：
- [ ] 修改 `v5/ConversationShell.js`：重写 MoreDrawer 内容
- [ ] 新建 `cardTransition.js`：实现卡片转场动画
- [ ] 添加到 `consolePageInlineCss.js` 的抽屉样式

---

### 面板 6：MonitoringPanel（监控总览）

**文件**：新建 `panels/MonitoringPanel.js`

**合并来源**：`MissionControlPanel.js` + `NormalModePanel.js` + `GodModePanel.js` + `TianshuModePanel.js` + `ThreeModeOverviewPanel.js`

**布局**：
```
┌─────────────────────────────────────────────┐
│                                              │
│  ← 返回                           系统监控   │
│  ────────────────────────────────────────── │
│                                              │
│  系统状态                                    │
│  ┌────────────┐  ┌────────────┐            │
│  │  服务健康    │  │  活跃模型    │            │
│  │     98%     │  │      3      │            │
│  │    正常     │  │    正常     │            │
│  └────────────┘  └────────────┘            │
│                                              │
│  ┌────────────┐  ┌────────────┐            │
│  │  Provider   │  │  安全状态    │            │
│  │   可用      │  │    正常     │            │
│  │    正常     │  │  0 拦截     │            │
│  └────────────┘  └────────────┘            │
│                                              │
│  运行模式                                    │
│  ┌─────────────────────────────────────┐    │
│  │ 当前模式：正常                        │    │
│  │ 可切换：正常 / God / 天枢             │    │
│  │                       [切换模式]      │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  最近执行                                    │
│  ┌─────────────────────────────────────┐    │
│  │ ✅ 客户反馈归类    2 分钟前           │    │
│  │ ✅ 周报生成        1 小时前           │    │
│  │ ⏳ 审批等待中      30 分钟前          │    │
│  └─────────────────────────────────────┘    │
│                                              │
└─────────────────────────────────────────────┘
```

**改动清单**：
- [ ] 新建 `apps/ai-gateway-service/src/ui/components/panels/MonitoringPanel.js`
- [ ] 从 `MissionControlPanel.js` 提取健康指标逻辑
- [ ] 从 `ThreeModeOverviewPanel.js` 提取模式切换逻辑
- [ ] 删除 `NormalModePanel.js`, `GodModePanel.js`, `TianshuModePanel.js` 的独立渲染

---

### 面板 7：ModelManagementPanel（模型管理）

**文件**：新建 `panels/ModelManagementPanel.js`

**合并来源**：`GlobalModelLibraryPanel.js` + `GlobalModelOpsPanel.js`

**布局**：
```
┌─────────────────────────────────────────────┐
│                                              │
│  ← 返回                           模型管理   │
│  ────────────────────────────────────────── │
│                                              │
│  当前模型                                    │
│  ┌─────────────────────────────────────┐    │
│  │ nvidia/llama-3.3-nemotron-super     │    │
│  │ 延迟 875ms · 状态正常                │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  可用模型                                    │
│  ┌─────────────────────────────────────┐    │
│  │ nvidia/llama-3.3-nemotron-super     │    │
│  │ 延迟 875ms · 推荐            [选用]  │    │
│  ├─────────────────────────────────────┤    │
│  │ nvidia/nemotron-mini-4b-instruct    │    │
│  │ 延迟 428ms · 最快            [选用]  │    │
│  ├─────────────────────────────────────┤    │
│  │ meta/llama-3.1-70b-instruct         │    │
│  │ 延迟 2143ms · 最强           [选用]  │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  [导入模型]  [刷新列表]                       │
│                                              │
└─────────────────────────────────────────────┘
```

**改动清单**：
- [ ] 新建 `apps/ai-gateway-service/src/ui/components/panels/ModelManagementPanel.js`
- [ ] 从 `GlobalModelLibraryPanel.js` 提取模型列表逻辑
- [ ] 从 `GlobalModelOpsPanel.js` 提取模型操作逻辑

---

### 面板 8：ProviderConfigPanel（运行配置）

**文件**：新建 `panels/ProviderConfigPanel.js`

**合并来源**：`ProviderCredentialRefPanel.js`

**布局**：
```
┌─────────────────────────────────────────────┐
│                                              │
│  ← 返回                           运行配置   │
│  ────────────────────────────────────────── │
│                                              │
│  Provider 模式                              │
│  ┌─────────────────────────────────────┐    │
│  │ 当前：NVIDIA 模式                    │    │
│  │ 说明：使用 NVIDIA API 进行推理        │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  连接状态                                    │
│  ┌─────────────────────────────────────┐    │
│  │ NVIDIA API    🟢 已连接              │    │
│  │ 密钥状态      已配置（不显示密钥）     │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  高级选项                                    │
│  ┌─────────────────────────────────────┐    │
│  │ Fallback      已启用                 │    │
│  │ Rate Limit    60 req/min            │    │
│  │ Timeout       30s                   │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  [测试连接]  [重置配置]                       │
│                                              │
└─────────────────────────────────────────────┘
```

**改动清单**：
- [ ] 新建 `apps/ai-gateway-service/src/ui/components/panels/ProviderConfigPanel.js`
- [ ] 从 `ProviderCredentialRefPanel.js` 提取配置逻辑
- [ ] 确保密钥值永远不显示

---

### 面板 9：WorkforceManagementPanel（员工管理）

**文件**：新建 `panels/WorkforceManagementPanel.js`

**合并来源**：`EmployeePyramidPanel.js` + `PositionLibraryPanel.js` + `InternalEmployeeCommunicationPanel.js` + `BranchExecutionPreviewPanel.js` + `WorkforceSchedulerPanel.js` + `FiveCapabilityActivationPanel.js` + `OwnerNeuralSkillPreviewPanel.js` + `CapabilityCellCandidatePanel.js` + `NeuralFabricReadOnlyPanel.js`

**布局**：
```
┌─────────────────────────────────────────────┐
│                                              │
│  ← 返回                           员工管理   │
│  ────────────────────────────────────────── │
│                                              │
│  组织架构                                    │
│  ┌─────────────────────────────────────┐    │
│  │ L0  Owner（你）                      │    │
│  │  └ L1  Product Chief                │    │
│  │      ├ L2  UX Researcher            │    │
│  │      ├ L2  AI Gateway Engineer      │    │
│  │      ├ L2  Security Chief           │    │
│  │      └ L2  Data Engineer            │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  能力激活                                    │
│  ┌─────────────────────────────────────┐    │
│  │ Workforce       ✅ 已激活            │    │
│  │ Three-Mode      ✅ 已激活            │    │
│  │ Taiji/Beidou    ⏳ 待激活            │    │
│  │ GVC             ⏳ 待激活            │    │
│  │ Codex           ⏳ 待激活            │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  最近通信                                    │
│  ┌─────────────────────────────────────┐    │
│  │ product-chief → ux-researcher       │    │
│  │ "请审阅客户反馈归类结果"              │    │
│  │ 5 分钟前                            │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  [调度员工]  [查看历史]                       │
│                                              │
└─────────────────────────────────────────────┘
```

**改动清单**：
- [ ] 新建 `apps/ai-gateway-service/src/ui/components/panels/WorkforceManagementPanel.js`
- [ ] 从 `EmployeePyramidPanel.js` 提取组织架构逻辑
- [ ] 从 `FiveCapabilityActivationPanel.js` 提取能力激活逻辑
- [ ] 从 `InternalEmployeeCommunicationPanel.js` 提取通信逻辑

---

### 面板 10：EngineeringToolsPanel（工程工具）

**文件**：新建 `panels/EngineeringToolsPanel.js`

**合并来源**：所有 C 类面板

**布局**：
```
┌─────────────────────────────────────────────┐
│                                              │
│  ← 返回                           工程工具   │
│  ────────────────────────────────────────── │
│                                              │
│  路由与模型                                  │
│  ┌──────────────┐  ┌──────────────┐        │
│  │  模型路由      │  │  路由质量      │        │
│  │  配置与测试    │  │  审计报告      │        │
│  └──────────────┘  └──────────────┘        │
│                                              │
│  安全与审计                                  │
│  ┌──────────────┐  ┌──────────────┐        │
│  │  God Mode    │  │  安全审计      │        │
│  │  冲突地图     │  │  负面源映射    │        │
│  └──────────────┘  └──────────────┘        │
│                                              │
│  调试与测试                                  │
│  ┌──────────────┐  ┌──────────────┐        │
│  │  GVC Runner  │  │  场景测试      │        │
│  │  仪表盘       │  │  dry-run      │        │
│  └──────────────┘  └──────────────┘        │
│                                              │
│  性能                                        │
│  ┌──────────────┐                           │
│  │  Token 节省   │                           │
│  │  仪表盘       │                           │
│  └──────────────┘                           │
│                                              │
│  [高级选项 →]                                 │
│                                              │
└─────────────────────────────────────────────┘
```

**改动清单**：
- [ ] 新建 `apps/ai-gateway-service/src/ui/components/panels/EngineeringToolsPanel.js`
- [ ] 合并 16 个 C 类面板为 4 个子区域
- [ ] 每个子区域卡片点击 → 展开详细面板

---

### 面板 11：AdvancedPanel（高级选项）

**文件**：新建 `panels/AdvancedPanel.js`

**合并来源**：所有 E 类面板

**布局**：
```
┌─────────────────────────────────────────────┐
│                                              │
│  ← 返回                           高级选项   │
│  ────────────────────────────────────────── │
│                                              │
│  ⚠️ 以下功能仅供工程师使用                    │
│                                              │
│  Taiji/Beidou 引擎                          │
│  ┌──────────────┐  ┌──────────────┐        │
│  │  自动运行时    │  │  生产运维      │        │
│  └──────────────┘  └──────────────┘        │
│  ┌──────────────┐  ┌──────────────┐        │
│  │  本地测试      │  │  生产就绪      │        │
│  └──────────────┘  └──────────────┘        │
│                                              │
│  Codex 上下文网关                            │
│  ┌──────────────┐                           │
│  │  上下文管理    │                           │
│  └──────────────┘                           │
│                                              │
│  加固与审计                                  │
│  ┌──────────────┐  ┌──────────────┐        │
│  │  长期加固      │  │  证据一致性    │        │
│  └──────────────┘  └──────────────┘        │
│                                              │
└─────────────────────────────────────────────┘
```

**改动清单**：
- [ ] 新建 `apps/ai-gateway-service/src/ui/components/panels/AdvancedPanel.js`
- [ ] 合并 15+ 个 E 类面板为 3 个子区域

---

### 面板 12：YiyiSettingsPanel（依依设置）

**文件**：新建 `panels/YiyiSettingsPanel.js`

**合并来源**：所有 F 类 Yiyi 面板

**布局**：
```
┌─────────────────────────────────────────────┐
│                                              │
│  ← 返回                           依依设置   │
│  ────────────────────────────────────────── │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │         🟢 依依                      │    │  ← 依依头像区域
│  │         当前状态：陪伴中              │    │     圆形头像 + 状态
│  │                                      │    │
│  │    [全屏]  [精简]  [隐藏]            │    │  ← 模式切换
│  └─────────────────────────────────────┘    │
│                                              │
│  性格设置                                    │
│  ┌─────────────────────────────────────┐    │
│  │ 情绪      平静 / 开心 / 专注          │    │
│  │ 行为      陪伴 / 引导 / 解释          │    │
│  │ 动效      开启 / 关闭                 │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  大脑状态                                    │
│  ┌─────────────────────────────────────┐    │
│  │ 当前：模拟模式                        │    │
│  │ 说明：依依使用预设回复，不调用模型     │    │
│  │                   [了解详情]          │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  引导展示                                    │
│  ┌─────────────────────────────────────┐    │
│  │ [开始引导]  查看系统功能演示           │    │
│  └─────────────────────────────────────┘    │
│                                              │
└─────────────────────────────────────────────┘
```

**改动清单**：
- [ ] 新建 `apps/ai-gateway-service/src/ui/components/panels/YiyiSettingsPanel.js`
- [ ] 合并 11 个 Yiyi 面板为 4 个区域
- [ ] 保留 `YiyiAvatarLayer.js` 作为可选浮窗

---

## 五、卡片转场系统

### 新建文件：`cardTransition.js`

**功能**：
1. 记录触发元素的位置和尺寸
2. 创建全屏覆盖层，初始状态匹配触发元素
3. 动画到全屏
4. 内容淡入
5. 返回时反向动画

**API**：
```javascript
// 展开面板
expandCardToPanel(triggerElement, panelId, options)

// 收缩面板
collapsePanelToCard(panelId, triggerElement)

// 页面滑动切换
slideToPage(direction, currentPageId, nextPageId)
```

**CSS**：
```css
.card-transition-overlay {
  position: fixed;
  z-index: 100;
  background: #ffffff;
  overflow: hidden;
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

.card-transition-overlay.is-expanding {
  border-radius: 0;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
}

.card-transition-overlay .panel-content {
  opacity: 0;
  transition: opacity 200ms ease 100ms;
}

.card-transition-overlay.is-expanding .panel-content {
  opacity: 1;
}
```

---

## 六、CSS 变量系统

在 `ownerDesignTokens.js` 中定义小米风格 token：

```javascript
export const xiaomiDesignTokens = `
  :root {
    /* 色彩 */
    --color-bg-page: #f5f5f5;
    --color-bg-card: #ffffff;
    --color-text-primary: #1a1a1a;
    --color-text-secondary: #888888;
    --color-text-hint: #b0b0b0;
    --color-accent: #ff6700;
    --color-accent-light: #fff3e6;
    --color-accent-dark: #e55d00;
    --color-success: #34c759;
    --color-warning: #ff9500;
    --color-danger: #ff3b30;
    --color-info: #007aff;
    --color-divider: #e8e8e8;

    /* 字体 */
    --font-family: -apple-system, "SF Pro Text", "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif;
    --font-xs: 12px;
    --font-sm: 13px;
    --font-base: 15px;
    --font-lg: 17px;
    --font-xl: 20px;
    --font-2xl: 24px;
    --font-3xl: 32px;

    /* 字重 */
    --weight-regular: 400;
    --weight-medium: 500;
    --weight-semibold: 600;
    --weight-bold: 700;

    /* 间距 */
    --space-1: 4px;
    --space-2: 8px;
    --space-3: 12px;
    --space-4: 16px;
    --space-5: 20px;
    --space-6: 24px;
    --space-8: 32px;
    --space-10: 40px;
    --space-12: 48px;
    --space-16: 64px;

    /* 圆角 */
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
    --radius-xl: 20px;
    --radius-full: 999px;

    /* 阴影 */
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
    --shadow-md: 0 2px 8px rgba(0,0,0,0.06);
    --shadow-lg: 0 4px 16px rgba(0,0,0,0.08);
    --shadow-xl: 0 8px 32px rgba(0,0,0,0.12);
  }
`;
```

---

## 七、实施顺序

### Step 1：视觉地基（P0）

| 任务 | 文件 | 说明 |
|------|------|------|
| 1.1 | `ownerDesignTokens.js` | 替换为小米风格 token |
| 1.2 | `workbenchCoreCss.js` | 重写全局样式（浅色+圆角+间距） |
| 1.3 | `ownerOsTheme.js` | 重写主题（浅色） |
| 1.4 | `consolePageInlineCss.js` | 重写内联样式 |

### Step 2：首页瘦身（P0）

| 任务 | 文件 | 说明 |
|------|------|------|
| 2.1 | `OwnerOSShell.js` | 只渲染 ConversationShell |
| 2.2 | `ConversationShell.js` | 接入新样式 |
| 2.3 | `ReplyField.js` | 胶囊输入框 |
| 2.4 | `SuggestionChips.js` | 小米风格芯片 |
| 2.5 | `conversationShellClientJs.js` | 适配新交互 |

### Step 3：卡片转场（P0）

| 任务 | 文件 | 说明 |
|------|------|------|
| 3.1 | 新建 `cardTransition.js` | 转场动画引擎 |
| 3.2 | `consolePageInlineCss.js` | 转场样式 |
| 3.3 | `conversationShellClientJs.js` | 集成转场 |

### Step 4：A 类面板（P0）

| 任务 | 文件 | 说明 |
|------|------|------|
| 4.1 | 新建 `panels/DailyReportPanel.js` | 日报面板 |
| 4.2 | 新建 `panels/ApprovalPanel.js` | 审批面板 |
| 4.3 | 新建 `panels/WorkforceStatusPanel.js` | 员工状态面板 |
| 4.4 | 修改 MoreDrawer | 更多抽屉 |

### Step 5：B 类面板（P1）

| 任务 | 文件 | 说明 |
|------|------|------|
| 5.1 | 新建 `panels/MonitoringPanel.js` | 监控总览 |
| 5.2 | 新建 `panels/ModelManagementPanel.js` | 模型管理 |
| 5.3 | 新建 `panels/ProviderConfigPanel.js` | 运行配置 |
| 5.4 | 新建 `panels/WorkforceManagementPanel.js` | 员工管理 |

### Step 6：C/D/E 类面板（P2）

| 任务 | 文件 | 说明 |
|------|------|------|
| 6.1 | 新建 `panels/EngineeringToolsPanel.js` | 工程工具 |
| 6.2 | 新建 `panels/AdvancedPanel.js` | 高级选项 |
| 6.3 | 新建 `panels/YiyiSettingsPanel.js` | 依依设置 |

### Step 7：清理（P2）

| 任务 | 文件 | 说明 |
|------|------|------|
| 7.1 | 删除废弃面板文件 | 清理 60+ 个不再使用的面板 |
| 7.2 | 删除废弃 copy 文件 | 清理 30+ 个不再使用的 copy |
| 7.3 | 更新 `consolePage.js` | 移除废弃 import |
| 7.4 | 运行 `node --check` | 语法检查 |
| 7.5 | 运行 `verify:safe-regression-matrix` | 回归验证 |

---

## 八、验收标准

### 视觉验收

- [ ] 背景 `#f5f5f5`，卡片 `#ffffff`
- [ ] 强调色 `#ff6700`（小米橙）
- [ ] 所有圆角 ≥ 8px
- [ ] 字重不超过 700
- [ ] 无霓虹 glow、无 grid 动画、无 glass morphism
- [ ] 大面积留白，内容呼吸感

### 结构验收

- [ ] 面板总数 ≤ 15 个（原 80+）
- [ ] 每个面板有明确的入口路径
- [ ] 无孤立面板（所有面板都可从首页到达）
- [ ] 无功能丢失（所有原有功能可从新面板访问）

### 交互验收

- [ ] 芯片→面板转场 300ms
- [ ] 面板→芯片返回 250ms
- [ ] 抽屉从底部滑入 300ms
- [ ] 按钮按下 scale(0.97)
- [ ] 输入框聚焦边框变色

### 术语验收

- [ ] 面向老板的面板无 Provider/God Mode/Tianshu/CredentialRef 等术语
- [ ] 面向工程师的面板可以保留技术术语

---

## 九、文件变更汇总

### 新建文件（14 个）

```
apps/ai-gateway-service/src/ui/
├── components/
│   └── panels/
│       ├── DailyReportPanel.js
│       ├── ApprovalPanel.js
│       ├── WorkforceStatusPanel.js
│       ├── MonitoringPanel.js
│       ├── ModelManagementPanel.js
│       ├── ProviderConfigPanel.js
│       ├── WorkforceManagementPanel.js
│       ├── EngineeringToolsPanel.js
│       ├── AdvancedPanel.js
│       └── YiyiSettingsPanel.js
├── lib/
│   └── cardTransition.js
└── copy/
    ├── dailyReportCopy.js
    ├── approvalCopy.js
    └── workforceStatusCopy.js
```

### 修改文件（8 个）

```
apps/ai-gateway-service/src/ui/
├── components/
│   ├── OwnerOSShell.js          ← 瘦身
│   └── v5/
│       ├── ConversationShell.js ← 集成转场
│       ├── ReplyField.js       ← 胶囊输入框
│       └── SuggestionChips.js  ← 小米风格
├── styles/
│   ├── ownerDesignTokens.js    ← 小米 token
│   ├── ownerOsTheme.js         ← 浅色主题
│   └── workbenchCoreCss.js     ← 全局样式
├── scripts/
│   └── conversationShellClientJs.js ← 转场集成
└── consolePage.js              ← 更新 import
```

### 删除文件（60+ 个，Step 7 清理时执行）

所有被合并的面板文件和 copy 文件。

---

*方案完成。qoder 按 Step 1-7 顺序执行即可。*
