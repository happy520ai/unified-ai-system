# AI Gateway 前端 UI 最终整改方案

> **日期**：2026-06-22
> **设计理念**：小米 HyperOS（减/圆/轻/动）× 对话优先 × 卡片转场
> **目标**：80+ 面板 → 12 面板，深色→浅色，按钮墙→对话，静态→动态
> **执行者**：qoder（按 Step 1→10 顺序执行）

---

## 目录

1. [设计哲学](#一设计哲学)
2. [视觉系统](#二视觉系统)
3. [信息架构](#三信息架构)
4. [面板清单](#四面板清单12-个)
5. [对话系统](#五对话系统核心)
6. [卡片转场系统](#六卡片转场系统)
7. [各面板详细设计](#七各面板详细设计)
8. [动画规范](#八动画规范)
9. [响应式](#九响应式)
10. [实施步骤](#十实施步骤step-110)
11. [验收标准](#十一验收标准)

---

## 一、设计哲学

### 四个字：减、圆、轻、动

**减**：第一屏只有对话，其他都是噪音。信息按需出现，不预加载。
**圆**：卡片 16px，按钮 12px，输入框 24px（胶囊），芯片 20px。
**轻**：背景 `#f5f5f5`，卡片 `#ffffff`，淡阴影，大留白，字重不超过 700。
**动**：芯片→面板 300ms 生长，按钮 scale(0.97)，输入框聚焦变色。

### 三条铁律

1. **对话是万能入口**——用户说什么都能到达对应功能
2. **渐进式披露**——默认只看得到对话，需要时才展开
3. **不卡不死**——任何输入都有回应，永远有下一步

---

## 二、视觉系统

### 2.1 色彩

```css
:root {
  /* 背景 */
  --bg-page: #f5f5f5;
  --bg-card: #ffffff;
  --bg-elevated: #ffffff;

  /* 文字 */
  --text-primary: #1a1a1a;
  --text-secondary: #888888;
  --text-hint: #b0b0b0;

  /* 强调（小米橙） */
  --accent: #ff6700;
  --accent-light: #fff3e6;
  --accent-dark: #e55d00;

  /* 状态 */
  --success: #34c759;
  --warning: #ff9500;
  --danger: #ff3b30;
  --info: #007aff;

  /* 边框/分割 */
  --divider: #e8e8e8;
}
```

### 2.2 字体

```css
:root {
  --font-family: -apple-system, "SF Pro Text", "Helvetica Neue",
                 "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-xs: 12px;
  --font-sm: 13px;
  --font-base: 15px;
  --font-lg: 17px;
  --font-xl: 20px;
  --font-2xl: 24px;
  --font-3xl: 32px;

  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
}
```

### 2.3 间距与圆角

```css
:root {
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

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-full: 999px;

  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 2px 8px rgba(0,0,0,0.06);
  --shadow-lg: 0 4px 16px rgba(0,0,0,0.08);
  --shadow-xl: 0 8px 32px rgba(0,0,0,0.12);
}
```

---

## 三、信息架构

```
第一层：对话（首页，默认可见）
  ├─ SystemFirstLine（系统说的第一句话，含状态+问候）
  ├─ ReplyField（输入框 + 对话气泡）
  ├─ SuggestionChips（动态建议芯片，3-5 个）
  └─ MoreButton（"⋯ 更多"）

第二层：功能面板（从芯片/对话展开，全屏卡片转场）
  ├─ 日报面板
  ├─ 审批面板
  ├─ 员工状态面板
  └─ 其他功能面板...

第三层：工程后台（"更多"抽屉 → 卡片 → 子面板）
  ├─ 系统监控
  ├─ 模型管理
  ├─ 运行配置
  ├─ 员工管理
  ├─ 工程工具
  └─ 依依设置
```

---

## 四、面板清单（12 个）

| # | 面板 | 入口 | 用户 | 优先级 |
|---|------|------|------|--------|
| 1 | ConversationShell | 首页 | 所有人 | P0 |
| 2 | DailyReportPanel | "看看日报"芯片 / 对话 | 老板 | P0 |
| 3 | ApprovalPanel | "审批"芯片 / 对话 | 老板 | P0 |
| 4 | WorkforceStatusPanel | "员工在干嘛"芯片 / 对话 | 老板 | P0 |
| 5 | MoreDrawer | "⋯ 更多"按钮 | 所有人 | P0 |
| 6 | MonitoringPanel | 更多→系统监控 | 工程师 | P1 |
| 7 | ModelManagementPanel | 更多→模型管理 | 工程师 | P1 |
| 8 | ProviderConfigPanel | 更多→运行配置 | 工程师 | P1 |
| 9 | WorkforceManagementPanel | 员工状态→管理员工 | 老板/工程师 | P1 |
| 10 | EngineeringToolsPanel | 更多→工程工具 | 工程师 | P2 |
| 11 | AdvancedPanel | 工程工具→高级 | 工程师 | P2 |
| 12 | YiyiSettingsPanel | 更多→依依设置 | 老板 | P2 |

---

## 五、对话系统（核心）

### 5.1 SystemFirstLine（系统第一句话）

**把状态、问候、呼吸灯合并成一句话。**

```javascript
// ToneByStatus.js — 状态→语气映射
const STATUS_TONE_MAP = {
  normal:  { greeting: "{time}好", status: "一切正常", cta: "想做点什么？" },
  pending: { greeting: "{time}好", status: "有 {n} 件事等你确认", cta: "先看看？" },
  error:   { greeting: "早", status: "刚才有个任务没跑成", cta: "要看看吗？" },
  offline: { greeting: "", status: "系统暂时连不上", cta: "你可以先告诉我待会儿要做什么。" },
};

// 时间问候
const TIME_GREETINGS = [
  { before: 6, text: "夜深了" },
  { before: 9, text: "早上" },
  { before: 12, text: "上午" },
  { before: 14, text: "中午" },
  { before: 18, text: "下午" },
  { before: 22, text: "晚上" },
  { before: 24, text: "夜深了" },
];
```

**视觉**：
- 字号 `32px`，字重 `400`（不加粗），颜色 `#1a1a1a`
- 居中，上方大量留白
- 淡入动画 `opacity 0→1, translateY 12px→0`，500ms

### 5.2 ReplyField（输入框 + 对话）

**输入框**：
- 胶囊形，`border-radius: 24px`
- 高度 `48px`，背景 `#ffffff`
- 边框 `1px solid #e8e8e8`
- Focus：边框 `1px solid #ff6700`，阴影 `0 0 0 3px rgba(255,103,0,0.1)`
- Placeholder：`"说点什么..."`，颜色 `#b0b0b0`
- 右侧圆形发送按钮 `40x40px`，背景 `#ff6700`，白色箭头图标

**对话气泡**：
- 用户消息：右对齐，背景 `#ff6700`，文字白色，圆角 `16px 16px 4px 16px`
- 系统消息：左对齐，背景 `#f5f5f5`，文字 `#1a1a1a`，圆角 `16px 16px 16px 4px`
- 最大宽度 `70%`，间距 `12px`
- 出现动画：淡入 + 上移 8px，200ms

### 5.3 SuggestionChips（动态建议芯片）

**核心改进：芯片不是固定的，而是根据系统状态动态变化。**

```javascript
// chipEngine.js — 动态芯片生成引擎
function generateChips(context) {
  const { systemStatus, pendingCount, lastAction, recentPanels } = context;
  const chips = [];

  // 1. 优先级 1：待处理事项
  if (pendingCount > 0) {
    chips.push({ id: "approval", label: `审批 ${pendingCount} 项`, action: "open:ApprovalPanel" });
  }

  // 2. 优先级 2：系统状态驱动
  if (systemStatus === "error") {
    chips.push({ id: "check-error", label: "查看异常", action: "open:MonitoringPanel" });
  }

  // 3. 优先级 3：日常高频
  chips.push({ id: "daily-report", label: "看看日报", action: "open:DailyReportPanel" });

  // 4. 优先级 4：上下文相关
  if (lastAction === "chat" || lastAction === null) {
    chips.push({ id: "workforce", label: "员工在干嘛", action: "open:WorkforceStatusPanel" });
  }

  // 5. 优先级 5：最近使用
  if (recentPanels.length > 0) {
    const last = recentPanels[recentPanels.length - 1];
    if (!chips.find(c => c.action.includes(last))) {
      chips.push({ id: "recent", label: `继续 ${getPanelLabel(last)}`, action: `open:${last}` });
    }
  }

  // 6. 始终有"更多"
  chips.push({ id: "more", label: "⋯ 更多", action: "open:MoreDrawer" });

  // 最多 5 个
  return chips.slice(0, 5);
}
```

**芯片状态变化示例**：

```
正常早报：  看看日报 · 员工在干嘛 · ⋯ 更多
有待审批：  审批 1 项 · 看看日报 · 员工在干嘛 · ⋯ 更多
有异常：    查看异常 · 看看日报 · 员工在干嘛 · ⋯ 更多
刚看完日报：继续 日报 · 审批 · 员工在干嘛 · ⋯ 更多
```

**视觉**：
- 圆角 `20px`，边框 `1px solid #e8e8e8`
- 文字 `#888`，字号 `13px`
- Hover：边框 `#ff6700`，背景 `#fff3e6`，文字 `#ff6700`
- Active：`scale(0.95)`，100ms
- 间距 `8px`，居中排列

### 5.4 对话快捷指令映射

**用户说的话可以直接打开对应面板，不需要手动点击。**

```javascript
// intentRouter.js — 对话意图路由（四级降级链）

// 第一级：精确匹配
const EXACT_MATCHES = {
  "看看日报": "DailyReportPanel",
  "日报": "DailyReportPanel",
  "今天做了什么": "DailyReportPanel",
  "今天完成什么": "DailyReportPanel",
  "审批": "ApprovalPanel",
  "待审批": "ApprovalPanel",
  "有哪些要审批的": "ApprovalPanel",
  "员工": "WorkforceStatusPanel",
  "员工状态": "WorkforceStatusPanel",
  "员工在干嘛": "WorkforceStatusPanel",
  "模型": "ModelManagementPanel",
  "模型管理": "ModelManagementPanel",
  "监控": "MonitoringPanel",
  "系统状态": "MonitoringPanel",
  "设置": "ProviderConfigPanel",
  "配置": "ProviderConfigPanel",
  "安全": "EngineeringToolsPanel",
  "依依": "YiyiSettingsPanel",
};

// 第二级：关键词匹配
const KEYWORD_MATCHES = [
  { keywords: ["日报", "完成", "今天做了", "结果"], panel: "DailyReportPanel" },
  { keywords: ["审批", "批准", "待办", "确认"], panel: "ApprovalPanel" },
  { keywords: ["员工", "workforce", "谁在", "在干嘛", "状态"], panel: "WorkforceStatusPanel" },
  { keywords: ["模型", "model", "切换模型", "延迟"], panel: "ModelManagementPanel" },
  { keywords: ["监控", "健康", "异常", "出错", "失败"], panel: "MonitoringPanel" },
  { keywords: ["设置", "配置", "provider", "连接"], panel: "ProviderConfigPanel" },
  { keywords: ["安全", "拦截", "密钥", "风险"], panel: "EngineeringToolsPanel" },
  { keywords: ["依依", "yiyi", "陪伴", "性格"], panel: "YiyiSettingsPanel" },
  { keywords: ["工程", "调试", "路由", "god mode"], panel: "EngineeringToolsPanel" },
];

// 第三级：分类匹配
const CATEGORY_PATTERNS = [
  { pattern: /看看(.+)/, handler: "searchPanel" },
  { pattern: /打开(.+)/, handler: "searchPanel" },
  { pattern: /查看(.+)/, handler: "searchPanel" },
  { pattern: /(.+)在哪/, handler: "searchPanel" },
  { pattern: /怎么(.+)/, handler: "helpSearch" },
];

// 第四级：兜底回复
function fallbackResponse(userInput) {
  return {
    type: "suggestion",
    text: `我不太确定你想做什么。试试这几个：`,
    chips: generateChips({ systemStatus: "normal", pendingCount: 0, lastAction: null, recentPanels: [] }),
  };
}

// 主路由函数
function routeIntent(userInput) {
  const input = userInput.trim().toLowerCase();

  // 第一级：精确匹配
  if (EXACT_MATCHES[input]) {
    return { type: "openPanel", panel: EXACT_MATCHES[input] };
  }

  // 第二级：关键词匹配
  for (const rule of KEYWORD_MATCHES) {
    if (rule.keywords.some(kw => input.includes(kw))) {
      return { type: "openPanel", panel: rule.panel };
    }
  }

  // 第三级：分类匹配
  for (const { pattern, handler } of CATEGORY_PATTERNS) {
    const match = input.match(pattern);
    if (match) {
      if (handler === "searchPanel") {
        const panel = searchPanelByName(match[1]);
        if (panel) return { type: "openPanel", panel };
      }
    }
  }

  // 第四级：兜底
  return fallbackResponse(userInput);
}

// 面板名称搜索
function searchPanelByName(keyword) {
  const panelLabels = {
    DailyReportPanel: "日报",
    ApprovalPanel: "审批",
    WorkforceStatusPanel: "员工",
    MonitoringPanel: "监控",
    ModelManagementPanel: "模型",
    ProviderConfigPanel: "配置",
    WorkforceManagementPanel: "员工管理",
    EngineeringToolsPanel: "工程",
    AdvancedPanel: "高级",
    YiyiSettingsPanel: "依依",
  };
  for (const [panel, label] of Object.entries(panelLabels)) {
    if (label.includes(keyword) || keyword.includes(label)) return panel;
  }
  return null;
}
```

### 5.5 对话与面板联动

```
用户：看看日报
系统：好的，这是今天的日报。
      [日报面板从芯片位置展开]

用户：[在日报面板里点"批准"]
系统：已批准。还有 0 项待审批。
      [日报面板更新，审批芯片消失]

用户：员工在干嘛
系统：目前 5 名员工，2 名正在执行任务。
      [员工状态面板展开]

用户：帮我把昨天客户反馈归类
系统：好的，大概 5 分钟，做完叫你。
      ▍ product-chief 接单 → 三路分支
      [异步执行，对话继续]
```

### 5.6 词汇表硬墙

**面向老板的面板，以下术语永不出现**：

```javascript
const FORBIDDEN_TERMS = [
  "Provider", "God Mode", "Tianshu", "CredentialRef",
  "NVIDIA", "API Key", "Token", "endpoint",
  "dry-run", "worktree", "Phase", "pgvector",
  "embedding", "sandboxed", "evidence", "trace",
  "verifier", "fallback", "route", "latency",
];

// 替换规则
const TERM_REPLACEMENTS = {
  "Provider": "模型服务",
  "God Mode": "严谨模式",
  "Tianshu": "规划模式",
  "CredentialRef": "连接配置",
  "NVIDIA": "模型服务",
  "API Key": "连接密钥",
  "dry-run": "预览模式",
  "fallback": "备用方案",
  "route": "路径",
  "latency": "响应速度",
};
```

---

## 六、卡片转场系统

### 6.1 转场类型

| 触发 | 动画 | 时长 | 缓动 |
|------|------|------|------|
| 芯片→面板 | 从芯片位置生长到全屏 | 300ms | `cubic-bezier(0.4, 0, 0.2, 1)` |
| 面板→芯片 | 从全屏缩回芯片位置 | 250ms | `cubic-bezier(0.4, 0, 0.2, 1)` |
| 抽屉打开 | 从底部滑入 | 300ms | `ease-out` |
| 抽屉关闭 | 向底部滑出 | 250ms | `ease-in` |
| 气泡出现 | 淡入 + 上移 8px | 200ms | `ease-out` |
| 按钮按下 | `scale(0.97)` | 100ms | `ease` |

### 6.2 实现方式（CSS transform，GPU 加速）

```css
/* 转场覆盖层 */
.card-transition-overlay {
  position: fixed;
  z-index: 100;
  background: var(--bg-card);
  overflow: hidden;
  will-change: transform, border-radius;
  /* 初始状态由 JS 设置：匹配触发元素的位置和尺寸 */
  transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1),
              border-radius 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* 展开状态 */
.card-transition-overlay.is-expanded {
  transform: translate(0, 0) scale(1);
  border-radius: 0;
}

/* 内容淡入 */
.card-transition-overlay .panel-content {
  opacity: 0;
  transition: opacity 200ms ease 100ms;
}
.card-transition-overlay.is-expanded .panel-content {
  opacity: 1;
}
```

```javascript
// cardTransition.js
function expandChipToPanel(chipEl, panelId) {
  const rect = chipEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // 创建覆盖层，初始状态 = 芯片的位置和尺寸
  const overlay = document.createElement("div");
  overlay.className = "card-transition-overlay";
  overlay.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
  overlay.style.width = rect.width + "px";
  overlay.style.height = rect.height + "px";
  overlay.style.borderRadius = "20px";
  overlay.innerHTML = `<div class="panel-content">${renderPanel(panelId)}</div>`;
  document.body.appendChild(overlay);

  // 下一帧：动画到全屏
  requestAnimationFrame(() => {
    overlay.classList.add("is-expanded");
    overlay.style.transform = "translate(0, 0)";
    overlay.style.width = vw + "px";
    overlay.style.height = vh + "px";
    overlay.style.borderRadius = "0";
  });

  // 记录当前展开的面板和触发元素
  state.activePanel = { id: panelId, overlay, trigger: chipEl };
}

function collapsePanelToChip() {
  const { overlay, trigger } = state.activePanel;
  if (!overlay || !trigger) return;

  const rect = trigger.getBoundingClientRect();

  // 内容淡出
  overlay.querySelector(".panel-content").style.opacity = "0";

  // 缩回芯片位置
  setTimeout(() => {
    overlay.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
    overlay.style.width = rect.width + "px";
    overlay.style.height = rect.height + "px";
    overlay.style.borderRadius = "20px";
  }, 50);

  // 移除
  setTimeout(() => {
    overlay.remove();
    state.activePanel = null;
  }, 350);
}
```

### 6.3 减弱动效

```css
@media (prefers-reduced-motion: reduce) {
  .card-transition-overlay {
    transition: none;
  }
  .card-transition-overlay .panel-content {
    transition: none;
  }
}
```

---

## 七、各面板详细设计

### 通用面板模板

```
┌─────────────────────────────────────────────┐
│  ← 返回                          面板标题    │  ← 顶栏
│  ────────────────────────────────────────── │  ← 分割线
│                                              │
│  区域标题                                     │  ← 灰色小字
│  ┌─────────────────────────────────────┐    │
│  │ 卡片内容                             │    │  ← 白色卡片
│  │                                      │    │     圆角 16px
│  │                      [操作按钮]       │    │     阴影 sm
│  └─────────────────────────────────────┘    │
│                                              │
└─────────────────────────────────────────────┘
```

### 面板 1：ConversationShell

```
┌─────────────────────────────────────────────┐
│                                              │
│                                              │
│      早上好。一切正常，想做点什么？              │  ← 居中，32px
│                                              │
│      ┌────────────────────────────────┐     │
│      │ 说点什么...                     │  →  │  ← 胶囊输入框
│      └────────────────────────────────┘     │
│                                              │
│      看看日报    审批 1 项    员工在干嘛       │  ← 动态芯片
│                                              │
│      ⋯ 更多                                  │
│                                              │
└─────────────────────────────────────────────┘
```

**文件**：`v5/ConversationShell.js`, `v5/SystemFirstLine.js`, `v5/ReplyField.js`, `v5/SuggestionChips.js`, `v5/ToneByStatus.js`, `conversationShellCopy.js`, `conversationShellClientJs.js`

**改动**：
- [ ] `OwnerOSShell.js`：只渲染 ConversationShell，删除其余
- [ ] `ReplyField.js`：胶囊输入框
- [ ] `SuggestionChips.js`：接入 chipEngine 动态生成
- [ ] `conversationShellClientJs.js`：接入 intentRouter + cardTransition

---

### 面板 2：DailyReportPanel

```
┌─────────────────────────────────────────────┐
│  ← 返回                              日报    │
│  ────────────────────────────────────────── │
│                                              │
│  今日完成                                    │
│  ┌─────────────────────────────────────┐    │
│  │ ✅  客户反馈归类完成                   │    │
│  │     前三类：发货延迟 / 价格 / 质量      │    │
│  │     2 分钟前                          │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │ ✅  周报已生成                        │    │
│  │     1 小时前                          │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  待处理                                      │
│  ┌─────────────────────────────────────┐    │
│  │ ⏳  审批：调整模型配置                 │    │
│  │     风险低                            │    │
│  │                     [批准]  [拒绝]    │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  发现问题                                    │
│  ┌─────────────────────────────────────┐    │
│  │ ⚠️  服务延迟升高                      │    │
│  │     P95 3.2s，建议关注                │    │
│  │                          [查看详情]   │    │
│  └─────────────────────────────────────┘    │
│                                              │
└─────────────────────────────────────────────┘
```

**新建文件**：`components/panels/DailyReportPanel.js`, `copy/dailyReportCopy.js`
**数据源**：`OwnerDailyReportSurface.js`, `OwnerSignalCard.js`

---

### 面板 3：ApprovalPanel

```
┌─────────────────────────────────────────────┐
│  ← 返回                              审批    │
│  ────────────────────────────────────────── │
│                                              │
│  待审批 (1)                                  │
│  ┌─────────────────────────────────────┐    │
│  │ 调整模型配置                          │    │
│  │ 风险：低  申请人：product-chief        │    │
│  │                     [批准]  [拒绝]    │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  已完成 (3)                                  │
│  ┌─────────────────────────────────────┐    │
│  │ ✅ 客户反馈归类         已批准        │    │
│  │ ✅ 数据库备份           已批准        │    │
│  │ ✅ 安全扫描             已批准        │    │
│  └─────────────────────────────────────┘    │
│                                              │
└─────────────────────────────────────────────┘
```

**新建文件**：`components/panels/ApprovalPanel.js`, `copy/approvalCopy.js`
**数据源**：`OwnerAutomationCommandPalette.js`, `OwnerAutomationResultCard.js`

---

### 面板 4：WorkforceStatusPanel

```
┌─────────────────────────────────────────────┐
│  ← 返回                           员工状态   │
│  ────────────────────────────────────────── │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ 🟢        │  │ 🟢        │  │ 🟢        │ │
│  │ product   │  │ ux        │  │ ai        │ │
│  │ chief     │  │ researcher│  │ gateway   │ │
│  │           │  │           │  │           │ │
│  │ 空闲      │  │ 执行中    │  │ 空闲      │ │
│  └──────────┘  └──────────┘  └──────────┘ │
│                                              │
│  ┌──────────┐  ┌──────────┐                │
│  │ 🟡        │  │ 🟢        │                │
│  │ security  │  │ data      │                │
│  │ chief     │  │ engineer  │                │
│  │           │  │           │                │
│  │ 审计中    │  │ 空闲      │                │
│  └──────────┘  └──────────┘                │
│                                              │
│  [管理员工]                                  │
│                                              │
└─────────────────────────────────────────────┘
```

**新建文件**：`components/panels/WorkforceStatusPanel.js`, `copy/workforceStatusCopy.js`
**数据源**：`WorkforcePreviewPanel.js`

---

### 面板 5：MoreDrawer

```
┌─────────────────────────────────────────────┐
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
│  │  已连接        │  │  5 名员工      │        │
│  └──────────────┘  └──────────────┘        │
│                                              │
│  ┌──────────────┐  ┌──────────────┐        │
│  │  🔧           │  │  🎭           │        │
│  │  工程工具      │  │  依依设置      │        │
│  │  路由/安全     │  │  陪伴模式      │        │
│  └──────────────┘  └──────────────┘        │
│                                              │
└─────────────────────────────────────────────┘
```

**改动**：`v5/ConversationShell.js` 中 MoreDrawer 部分

---

### 面板 6：MonitoringPanel

```
┌─────────────────────────────────────────────┐
│  ← 返回                           系统监控   │
│  ────────────────────────────────────────── │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  服务健康  │  │  活跃模型  │  │  安全状态  │ │
│  │    98%    │  │     3     │  │   正常    │ │
│  │   正常    │  │   正常    │  │  0 拦截   │ │
│  └──────────┘  └──────────┘  └──────────┘ │
│                                              │
│  运行模式                                    │
│  ┌─────────────────────────────────────┐    │
│  │ 当前：正常模式                        │    │
│  │ [正常]  [严谨]  [规划]               │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  最近执行                                    │
│  ┌─────────────────────────────────────┐    │
│  │ ✅ 客户反馈归类    2 分钟前           │    │
│  │ ✅ 周报生成        1 小时前           │    │
│  └─────────────────────────────────────┘    │
│                                              │
└─────────────────────────────────────────────┘
```

**新建文件**：`components/panels/MonitoringPanel.js`
**数据源**：`MissionControlPanel.js`, `ThreeModeOverviewPanel.js`

---

### 面板 7：ModelManagementPanel

```
┌─────────────────────────────────────────────┐
│  ← 返回                           模型管理   │
│  ────────────────────────────────────────── │
│                                              │
│  当前模型                                    │
│  ┌─────────────────────────────────────┐    │
│  │ nemotron-super-49b    875ms  推荐    │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  可用模型                                    │
│  ┌─────────────────────────────────────┐    │
│  │ nemotron-super-49b    875ms  [选用]  │    │
│  │ nemotron-mini-4b      428ms  [选用]  │    │
│  │ llama-3.1-70b         2143ms [选用]  │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  [导入模型]  [刷新]                          │
│                                              │
└─────────────────────────────────────────────┘
```

**新建文件**：`components/panels/ModelManagementPanel.js`
**数据源**：`GlobalModelLibraryPanel.js`, `GlobalModelOpsPanel.js`

---

### 面板 8：ProviderConfigPanel

```
┌─────────────────────────────────────────────┐
│  ← 返回                           运行配置   │
│  ────────────────────────────────────────── │
│                                              │
│  连接状态                                    │
│  ┌─────────────────────────────────────┐    │
│  │ 模型服务      🟢 已连接              │    │
│  │ 密钥          已配置                 │    │
│  │ 备用方案      已启用                 │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  高级                                        │
│  ┌─────────────────────────────────────┐    │
│  │ 速率限制      60 次/分钟             │    │
│  │ 超时          30 秒                  │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  [测试连接]  [重置]                          │
│                                              │
└─────────────────────────────────────────────┘
```

**新建文件**：`components/panels/ProviderConfigPanel.js`
**数据源**：`ProviderCredentialRefPanel.js`

---

### 面板 9：WorkforceManagementPanel

```
┌─────────────────────────────────────────────┐
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
└─────────────────────────────────────────────┘
```

**新建文件**：`components/panels/WorkforceManagementPanel.js`
**数据源**：`EmployeePyramidPanel.js`, `FiveCapabilityActivationPanel.js`

---

### 面板 10：EngineeringToolsPanel

```
┌─────────────────────────────────────────────┐
│  ← 返回                           工程工具   │
│  ────────────────────────────────────────── │
│                                              │
│  ┌──────────────┐  ┌──────────────┐        │
│  │  模型路由      │  │  路由质量      │        │
│  │  配置与测试    │  │  审计报告      │        │
│  └──────────────┘  └──────────────┘        │
│                                              │
│  ┌──────────────┐  ┌──────────────┐        │
│  │  安全审计      │  │  场景测试      │        │
│  │  负面源映射    │  │  dry-run      │        │
│  └──────────────┘  └──────────────┘        │
│                                              │
│  ┌──────────────┐  ┌──────────────┐        │
│  │  GVC Runner  │  │  Token 节省   │        │
│  │  仪表盘       │  │  仪表盘       │        │
│  └──────────────┘  └──────────────┘        │
│                                              │
│  [高级选项 →]                                 │
│                                              │
└─────────────────────────────────────────────┘
```

**新建文件**：`components/panels/EngineeringToolsPanel.js`
**数据源**：16 个 C 类面板合并

---

### 面板 11：AdvancedPanel

```
┌─────────────────────────────────────────────┐
│  ← 返回                           高级选项   │
│  ────────────────────────────────────────── │
│                                              │
│  ⚠️ 仅供工程师使用                           │
│                                              │
│  Taiji/Beidou 引擎                          │
│  ┌──────────────┐  ┌──────────────┐        │
│  │  自动运行时    │  │  生产运维      │        │
│  └──────────────┘  └──────────────┘        │
│                                              │
│  Codex 上下文                                │
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

**新建文件**：`components/panels/AdvancedPanel.js`
**数据源**：15+ 个 E 类面板合并

---

### 面板 12：YiyiSettingsPanel

```
┌─────────────────────────────────────────────┐
│  ← 返回                           依依设置   │
│  ────────────────────────────────────────── │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │         🟢 依依                      │    │
│  │         当前：陪伴中                  │    │
│  │                                      │    │
│  │    [全屏]  [精简]  [隐藏]            │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  性格                                        │
│  ┌─────────────────────────────────────┐    │
│  │ 情绪    平静 / 开心 / 专注            │    │
│  │ 行为    陪伴 / 引导 / 解释            │    │
│  │ 动效    开启 / 关闭                   │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  大脑                                        │
│  ┌─────────────────────────────────────┐    │
│  │ 模式：模拟（不调用模型）              │    │
│  │                   [了解详情]          │    │
│  └─────────────────────────────────────┘    │
│                                              │
└─────────────────────────────────────────────┘
```

**新建文件**：`components/panels/YiyiSettingsPanel.js`
**数据源**：11 个 Yiyi 面板合并

---

## 八、动画规范

### 进入动画

```css
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes slide-in-bottom {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}

@keyframes scale-in {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}
```

### 微交互

```css
button:active { transform: scale(0.97); transition: transform 100ms ease; }
.card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); transition: all 200ms ease; }
input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(255,103,0,0.1); }
.chip:hover { background: var(--accent-light); border-color: var(--accent); color: var(--accent); }
```

### 减弱动效

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 九、响应式

```
移动端（< 640px）：
  对话气泡最大宽度 90%
  芯片纵向排列
  抽屉全屏
  字号缩小 1px

平板（640-1024px）：
  对话气泡最大宽度 80%
  芯片横向排列
  抽屉宽度 80vw

桌面（> 1024px）：
  对话气泡最大宽度 70%
  内容最大宽度 720px 居中
  抽屉宽度 480px
```

---

## 十、实施步骤（Step 1→10）

### Step 1：视觉地基

| 任务 | 文件 | 说明 |
|------|------|------|
| 1.1 | `ownerDesignTokens.js` | 替换为小米风格 token（§2） |
| 1.2 | `workbenchCoreCss.js` | 重写全局样式（浅色+圆角+间距） |
| 1.3 | `ownerOsTheme.js` | 重写主题（浅色，去掉深色/glow/grid） |
| 1.4 | `consolePageInlineCss.js` | 重写内联样式 |

**验收**：`node --check` 通过，页面浅色，无霓虹

### Step 2：首页瘦身

| 任务 | 文件 | 说明 |
|------|------|------|
| 2.1 | `OwnerOSShell.js` | 只渲染 ConversationShell |
| 2.2 | `ConversationShell.js` | 移除 MissionControlPanel 引用 |
| 2.3 | `ReplyField.js` | 胶囊输入框 |
| 2.4 | `SuggestionChips.js` | 小米风格芯片 |

**验收**：首页只有对话，无指标卡/结果卡/操作记录

### Step 3：对话引擎

| 任务 | 文件 | 说明 |
|------|------|------|
| 3.1 | 新建 `lib/intentRouter.js` | 四级意图路由（§5.4） |
| 3.2 | 新建 `lib/chipEngine.js` | 动态芯片生成（§5.3） |
| 3.3 | `conversationShellClientJs.js` | 集成意图路由 + 动态芯片 |
| 3.4 | `conversationShellCopy.js` | 词汇表硬墙（§5.6） |

**验收**：输入"看看日报"直接打开日报面板，芯片随状态变化

### Step 4：卡片转场

| 任务 | 文件 | 说明 |
|------|------|------|
| 4.1 | 新建 `lib/cardTransition.js` | 转场动画引擎（§6） |
| 4.2 | `consolePageInlineCss.js` | 转场样式 |
| 4.3 | `conversationShellClientJs.js` | 集成转场 |

**验收**：芯片→面板 300ms 生长，返回 250ms 缩回

### Step 5：A 类面板

| 任务 | 文件 | 说明 |
|------|------|------|
| 5.1 | 新建 `panels/DailyReportPanel.js` | 日报面板 |
| 5.2 | 新建 `panels/ApprovalPanel.js` | 审批面板 |
| 5.3 | 新建 `panels/WorkforceStatusPanel.js` | 员工状态面板 |
| 5.4 | 修改 MoreDrawer | 更多抽屉内容 |

**验收**：三个芯片都能展开对应面板，内容正确

### Step 6：B 类面板

| 任务 | 文件 | 说明 |
|------|------|------|
| 6.1 | 新建 `panels/MonitoringPanel.js` | 监控总览 |
| 6.2 | 新建 `panels/ModelManagementPanel.js` | 模型管理 |
| 6.3 | 新建 `panels/ProviderConfigPanel.js` | 运行配置 |
| 6.4 | 新建 `panels/WorkforceManagementPanel.js` | 员工管理 |

**验收**：更多抽屉 4 张卡片都能展开

### Step 7：C/D/E 类面板

| 任务 | 文件 | 说明 |
|------|------|------|
| 7.1 | 新建 `panels/EngineeringToolsPanel.js` | 工程工具 |
| 7.2 | 新建 `panels/AdvancedPanel.js` | 高级选项 |
| 7.3 | 新建 `panels/YiyiSettingsPanel.js` | 依依设置 |

**验收**：所有原有功能可从新面板访问

### Step 8：对话联动

| 任务 | 文件 | 说明 |
|------|------|------|
| 8.1 | `conversationShellClientJs.js` | 对话→面板联动 |
| 8.2 | `conversationShellClientJs.js` | workforce 轻量披露 |
| 8.3 | `conversationShellClientJs.js` | 异步任务状态更新 |

**验收**：对话中说"看看日报"直接展开，系统回复有 workforce 披露

### Step 9：响应式 + 无障碍

| 任务 | 文件 | 说明 |
|------|------|------|
| 9.1 | `consolePageInlineCss.js` | 移动端适配 |
| 9.2 | `consolePageInlineCss.js` | 平板适配 |
| 9.3 | `consolePageInlineCss.js` | 减弱动效 |
| 9.4 | 全部组件 | 无障碍检查 |

**验收**：移动端可用，减弱动效生效

### Step 10：清理 + 验证

| 任务 | 文件 | 说明 |
|------|------|------|
| 10.1 | 删除 60+ 废弃面板 | 清理不再使用的文件 |
| 10.2 | 删除 30+ 废弃 copy | 清理不再使用的文案 |
| 10.3 | `consolePage.js` | 更新 import |
| 10.4 | `node --check` | 语法检查 |
| 10.5 | `verify:safe-regression-matrix` | 回归验证 |
| 10.6 | `verify:phase107a-secret-safety` | 密钥安全 |

**验收**：所有验证通过，无功能丢失

---

## 十一、验收标准

### 视觉

- [ ] 背景 `#f5f5f5`，卡片 `#ffffff`
- [ ] 强调色 `#ff6700`
- [ ] 圆角 ≥ 8px，字重 ≤ 700
- [ ] 无霓虹 glow / grid 动画 / glass morphism
- [ ] 大面积留白，呼吸感

### 结构

- [ ] 面板 ≤ 15 个（原 80+）
- [ ] 无孤立面板，所有面板可从首页到达
- [ ] 无功能丢失

### 对话

- [ ] 意图路由四级降级：精确→关键词→分类→兜底
- [ ] 芯片动态生成：根据状态+待办+最近使用变化
- [ ] 词汇表硬墙：老板视图无 Provider/God Mode 等术语

### 交互

- [ ] 芯片→面板 300ms 生长转场
- [ ] 面板→芯片 250ms 缩回
- [ ] 按钮 scale(0.97) 反馈
- [ ] 输入框聚焦变色

### 术语

- [ ] 面向老板的面板无技术术语
- [ ] 面向工程师的面板保留术语

---

## 十二、文件变更汇总

### 新建（17 个）

```
ui/components/panels/
  DailyReportPanel.js
  ApprovalPanel.js
  WorkforceStatusPanel.js
  MonitoringPanel.js
  ModelManagementPanel.js
  ProviderConfigPanel.js
  WorkforceManagementPanel.js
  EngineeringToolsPanel.js
  AdvancedPanel.js
  YiyiSettingsPanel.js

ui/lib/
  intentRouter.js
  chipEngine.js
  cardTransition.js

ui/copy/
  dailyReportCopy.js
  approvalCopy.js
  workforceStatusCopy.js
```

### 修改（10 个）

```
ui/components/
  OwnerOSShell.js
  v5/ConversationShell.js
  v5/ReplyField.js
  v5/SuggestionChips.js
ui/styles/
  ownerDesignTokens.js
  ownerOsTheme.js
  workbenchCoreCss.js
  consolePageInlineCss.js
ui/scripts/
  conversationShellClientJs.js
ui/
  consolePage.js
```

### 删除（60+ 个，Step 10 执行）

所有被合并的面板和 copy 文件。

---

*方案完成。qoder 按 Step 1→10 顺序执行。*
