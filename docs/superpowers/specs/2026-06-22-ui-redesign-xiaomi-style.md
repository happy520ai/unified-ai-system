# AI Gateway 前端 UI 整改方案：小米设计语言

> **日期**：2026-06-22
> **设计理念**：小米 HyperOS / MIUI 设计语言 + 对话优先 + 卡片转场
> **范围**：`unified-ai-system` 全部前端 UI

---

## 一、设计哲学：四个字

### 1. 减（Less）

小米的核心不是"加功能"，是"减噪音"。

- 第一屏**只有对话**，其他都是噪音
- 每个页面**只有一个主操作**，其他都是次要
- 信息**按需出现**，不预加载到眼前
- 颜色**只用一个强调色**，其他全是灰阶

### 2. 圆（Round）

小米的视觉签名——一切都是圆的。

- 卡片圆角 `16px`
- 按钮圆角 `12px`
- 输入框圆角 `24px`（胶囊形）
- 头像/图标圆角 `50%`（正圆）
- 芯片圆角 `20px`

### 3. 轻（Light）

轻盈感来自：大留白 + 低对比 + 微阴影 + 淡色彩。

- 背景 `#f5f5f5`（不是纯白，不是深色）
- 卡片 `#ffffff` + 极淡阴影 `0 1px 3px rgba(0,0,0,0.06)`
- 文字主色 `#1a1a1a`（不是纯黑）
- 文字次要色 `#888`（不是灰色块，是淡灰）
- 强调色 `#ff6700`（小米橙）或 `#007aff`（冷静蓝）二选一

### 4. 动（Motion）

动画不是装饰，是**引导视线**。

- 卡片展开：从点击位置"生长"到目标位置，300ms `ease-out`
- 页面切换：旧页面向左滑出 + 新页面从右滑入，250ms
- 芯片→面板：芯片放大、内容淡入，200ms
- 返回：反向动画，从面板缩回芯片
- 微交互：按钮按下 `scale(0.97)`，松开弹回

---

## 二、信息架构：三层

```
第一层：对话（默认首页）
  └─ 用户说一句话 → 系统响应 → 持续对话

第二层：功能面板（从建议芯片/对话中展开）
  ├─ 日报面板
  ├─ 审批面板
  ├─ 员工状态面板
  └─ 其他功能...

第三层：工程后台（"更多"抽屉里）
  ├─ 指标监控
  ├─ 模型管理
  ├─ 安全审计
  └─ 设置
```

**规则**：
- 老板日常只用第一层
- 第二层从对话中自然触发（"帮我看看日报" → 日报面板展开）
- 第三层几乎不进，只有工程师需要

---

## 三、视觉系统

### 3.1 色彩

```
背景色系：
  --bg-page:      #f5f5f5    页面背景
  --bg-card:      #ffffff    卡片背景
  --bg-elevated:  #ffffff    悬浮卡片（加更深阴影）

文字色系：
  --text-primary:   #1a1a1a  主文字
  --text-secondary: #888888  次要文字
  --text-hint:      #b0b0b0  提示文字
  --text-inverse:   #ffffff  深色背景上的文字

强调色系：
  --accent:         #ff6700  小米橙（主强调）
  --accent-light:   #fff3e6  橙色浅底
  --accent-dark:    #e55d00  橙色深

状态色系：
  --success:        #34c759  成功/正常
  --warning:        #ff9500  警告
  --danger:         #ff3b30  危险/错误
  --info:           #007aff  信息

分割线：
  --divider:        #e8e8e8  分割线
```

### 3.2 字体

```
字体栈：-apple-system, "SF Pro Text", "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif

字号阶梯：
  --font-xs:    12px    标签、辅助文字
  --font-sm:    13px    次要正文
  --font-base:  15px    正文（对话文字）
  --font-lg:    17px    卡片标题
  --font-xl:    20px    页面标题
  --font-2xl:   24px    大标题
  --font-3xl:   32px    首屏问候语

字重：
  --weight-regular:  400
  --weight-medium:   500
  --weight-semibold: 600
  --weight-bold:     700

行高：
  --leading-tight:   1.3    标题
  --leading-normal:  1.5    正文
  --leading-relaxed: 1.7    对话文字
```

### 3.3 间距

```
间距阶梯（4px 基数）：
  --space-1:   4px
  --space-2:   8px
  --space-3:   12px
  --space-4:   16px
  --space-5:   20px
  --space-6:   24px
  --space-8:   32px
  --space-10:  40px
  --space-12:  48px
  --space-16:  64px

页面边距：
  移动端：16px
  平板：24px
  桌面：32px，内容最大宽度 720px
```

### 3.4 阴影

```
阴影阶梯：
  --shadow-sm:   0 1px 2px rgba(0,0,0,0.04)      卡片默认
  --shadow-md:   0 2px 8px rgba(0,0,0,0.06)      卡片悬浮
  --shadow-lg:   0 4px 16px rgba(0,0,0,0.08)     弹窗/抽屉
  --shadow-xl:   0 8px 32px rgba(0,0,0,0.12)     全屏面板
```

### 3.5 圆角

```
圆角阶梯：
  --radius-sm:    8px     小元素（标签、小按钮）
  --radius-md:    12px    按钮、输入框
  --radius-lg:    16px    卡片
  --radius-xl:    20px    芯片
  --radius-full:  999px   胶囊形（输入框、药丸按钮）
```

---

## 四、组件设计

### 4.1 第一屏：ConversationShell

```
┌─────────────────────────────────────────────┐
│                                              │
│                                              │
│                                              │
│      早上好。一切正常，想做点什么？              │  ← SystemFirstLine
│                                              │     字号 32px，字重 400
│                                              │     颜色 #1a1a1a
│      ┌────────────────────────────────┐     │     居中，上方大量留白
│      │ 说点什么...                     │  →  │  ← ReplyField
│      └────────────────────────────────┘     │     胶囊形，圆角 24px
│                                              │     高度 48px，字号 15px
│      看看日报    审批    员工在干嘛            │  ← SuggestionChips
│                                              │     圆角 20px，边框 #e8e8e8
│      ⋯ 更多                                  │     文字 #888，hover 变 #1a1a1a
│                                              │  ← MoreButton
│                                              │     文字 #b0b0b0，无边框
└─────────────────────────────────────────────┘
```

**关键细节**：
- 问候语**不加粗**，用字重 400（小米的"轻"感）
- 输入框**没有明显边框**，只有一条极细的底边 `1px solid #e8e8e8`
- 建议芯片**默认无背景**，只有文字+细边框，hover 才出现浅底
- 整体**大面积留白**，内容集中在屏幕中上方

### 4.2 SystemFirstLine（系统第一句话）

```
状态映射（沿用 v5 ToneByStatus）：

正常：  "早上好。一切正常，想做点什么？"
待审批： "早上好。有 1 件事等你确认，先看看？"
异常：   "早。刚才有个任务没跑成，要看看吗？"
离线：   "系统暂时连不上，你可以先告诉我待会儿要做什么。"
```

**视觉**：
- 字号 `32px`，字重 `400`（不加粗）
- 颜色 `#1a1a1a`
- 居中对齐
- 有淡入动画 `opacity 0→1, translateY 12px→0`，500ms

### 4.3 ReplyField（回话处）

**输入框**：
- 胶囊形，`border-radius: 24px`
- 高度 `48px`
- 背景 `#ffffff`
- 边框 `1px solid #e8e8e8`，focus 时变为 `1px solid #ff6700`
- placeholder 颜色 `#b0b0b0`
- 右侧圆形发送按钮 `40x40px`，背景 `#ff6700`，图标白色

**对话气泡**：
- 用户消息：右对齐，背景 `#ff6700`，文字白色，圆角 `16px 16px 4px 16px`
- 系统消息：左对齐，背景 `#f0f0f0`，文字 `#1a1a1a`，圆角 `16px 16px 16px 4px`
- 消息最大宽度 `70%`
- 消息间距 `12px`

### 4.4 SuggestionChips（建议芯片）

```
默认态：
┌──────────┐  ┌──────────┐  ┌──────────┐
│ 看看日报  │  │   审批    │  │ 员工在干嘛 │
└──────────┘  └──────────┘  └──────────┘
  边框 #e8e8e8    无背景       文字 #888

悬浮态：
┌──────────┐
│ 看看日报  │  边框 #ff6700，背景 #fff3e6，文字 #ff6700
└──────────┘

点击态：
  scale(0.95)，100ms
```

**转场**：点击芯片 → 芯片从原位"生长"为全屏面板（详见 §5.2）

### 4.5 MoreDrawer（更多抽屉）

```
点击"⋯ 更多"后，从底部滑上面板：

┌─────────────────────────────────────────────┐
│                                              │
│  更多功能                              收起 ↑ │
│  ────────────────────────────────────────── │
│                                              │
│  ┌─────────────┐  ┌─────────────┐          │
│  │  📊 指标监控  │  │  🤖 模型管理  │          │
│  │  服务状态     │  │  当前 3 个    │          │
│  └─────────────┘  └─────────────┘          │
│                                              │
│  ┌─────────────┐  ┌─────────────┐          │
│  │  🔒 安全审计  │  │  ⚙️ 设置    │          │
│  │  0 拦截      │  │  运行时配置   │          │
│  └─────────────┘  └─────────────┘          │
│                                              │
│  ┌─────────────┐  ┌─────────────┐          │
│  │  🏭 员工管理  │  │  📋 任务队列  │          │
│  │  workforce   │  │  执行历史     │          │
│  └─────────────┘  └─────────────┘          │
│                                              │
└─────────────────────────────────────────────┘
```

- 从底部滑入，`translateY(100%) → translateY(0)`，300ms
- 背景 `#ffffff`，顶部圆角 `20px`
- 卡片网格 `2列`，间距 `12px`
- 每张卡片：图标 + 标题 + 一行描述
- 点击卡片 → 展开为全屏面板（卡片转场动画）

---

## 五、交互系统：卡片转场

### 5.1 转场类型总览

| 触发 | 动画 | 时长 | 缓动 |
|------|------|------|------|
| 芯片→面板 | 从芯片位置生长到全屏 | 300ms | `cubic-bezier(0.4, 0, 0.2, 1)` |
| 面板→芯片 | 从全屏缩回芯片位置 | 250ms | `cubic-bezier(0.4, 0, 0.2, 1)` |
| 抽屉打开 | 从底部滑入 | 300ms | `ease-out` |
| 抽屉关闭 | 向底部滑出 | 250ms | `ease-in` |
| 页面切换 | 旧页面左滑 + 新页面右入 | 250ms | `ease-in-out` |
| 气泡出现 | 淡入 + 上移 8px | 200ms | `ease-out` |
| 按钮按下 | `scale(0.97)` | 100ms | `ease` |
| 按钮松开 | `scale(1)` | 150ms | `ease-out` |

### 5.2 芯片→面板转场（核心动画）

```javascript
// 伪代码
function expandChipToPanel(chipElement, panelContent) {
  // 1. 记录芯片的起始位置和尺寸
  const chipRect = chipElement.getBoundingClientRect();

  // 2. 创建全屏面板（初始状态：和芯片一样大，在芯片位置）
  const panel = document.createElement('div');
  panel.className = 'card-transition-panel';
  panel.style.cssText = `
    position: fixed;
    top: ${chipRect.top}px;
    left: ${chipRect.left}px;
    width: ${chipRect.width}px;
    height: ${chipRect.height}px;
    border-radius: 20px;
    background: #ffffff;
    z-index: 100;
    overflow: hidden;
    transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
  `;
  panel.innerHTML = panelContent;
  document.body.appendChild(panel);

  // 3. 下一帧：动画到全屏
  requestAnimationFrame(() => {
    panel.style.top = '0';
    panel.style.left = '0';
    panel.style.width = '100vw';
    panel.style.height = '100vh';
    panel.style.borderRadius = '0';
  });

  // 4. 内容淡入
  setTimeout(() => {
    panel.querySelector('.panel-content').style.opacity = '1';
  }, 150);
}

function collapsePanelToChip(panelElement, chipElement) {
  const chipRect = chipElement.getBoundingClientRect();

  // 1. 内容淡出
  panelElement.querySelector('.panel-content').style.opacity = '0';

  // 2. 缩回芯片位置
  setTimeout(() => {
    panelElement.style.top = chipRect.top + 'px';
    panelElement.style.left = chipRect.left + 'px';
    panelElement.style.width = chipRect.width + 'px';
    panelElement.style.height = chipRect.height + 'px';
    panelElement.style.borderRadius = '20px';
  }, 100);

  // 3. 移除
  setTimeout(() => {
    panelElement.remove();
  }, 350);
}
```

### 5.3 页面滑动切换

```javascript
function slideToPage(direction, currentPage, nextPage) {
  // direction: 'left' | 'right'
  const offset = direction === 'left' ? '-100%' : '100%';
  const enterFrom = direction === 'left' ? '100%' : '-100%';

  // 旧页面滑出
  currentPage.style.transition = 'transform 250ms ease-in-out';
  currentPage.style.transform = `translateX(${offset})`;

  // 新页面滑入
  nextPage.style.transform = `translateX(${enterFrom})`;
  nextPage.style.display = 'block';
  requestAnimationFrame(() => {
    nextPage.style.transition = 'transform 250ms ease-in-out';
    nextPage.style.transform = 'translateX(0)';
  });

  // 清理
  setTimeout(() => {
    currentPage.style.display = 'none';
    currentPage.style.transform = '';
    currentPage.style.transition = '';
    nextPage.style.transition = '';
  }, 260);
}
```

---

## 六、页面设计

### 6.1 对话页（首页）

```
┌─────────────────────────────────────────────┐
│                                              │
│                                              │
│                                              │
│                                              │
│      早上好。一切正常，想做点什么？              │
│                                              │
│                                              │
│      ┌────────────────────────────────┐     │
│      │ 说点什么...                     │  →  │
│      └────────────────────────────────┘     │
│                                              │
│      看看日报    审批    员工在干嘛            │
│                                              │
│      ⋯ 更多                                  │
│                                              │
│                                              │
│                                              │
└─────────────────────────────────────────────┘

对话开始后：

┌─────────────────────────────────────────────┐
│                                              │
│      ┌───────────────────────────────┐      │
│      │ 帮我把昨天的客户反馈归类        │      │  ← 用户气泡（右，橙底白字）
│      └───────────────────────────────┘      │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │ 好的。我会用"严谨"的方式做，          │    │  ← 系统气泡（左，灰底黑字）
│  │ 大概 5 分钟，做完叫你。               │    │
│  │                                     │    │
│  │  ▍ product-chief 接单               │    │  ← 轻量 workforce 披露
│  │  ▍ 三路分支 → DeepSeek 生成          │    │
│  └─────────────────────────────────────┘    │
│                                              │
│      ┌────────────────────────────────┐     │
│      │ 说点什么...                     │  →  │
│      └────────────────────────────────┘     │
│                                              │
│      看看日报    审批    员工在干嘛            │
│                                              │
└─────────────────────────────────────────────┘
```

### 6.2 日报面板（从芯片展开）

```
点击 [看看日报] → 芯片位置生长为：

┌─────────────────────────────────────────────┐
│                                              │
│  ← 返回                              日报    │
│  ────────────────────────────────────────── │
│                                              │
│  今日完成                                    │
│  ┌─────────────────────────────────────┐    │
│  │ ✅ 客户反馈归类完成                   │    │
│  │    前三类：发货延迟 / 价格 / 质量      │    │
│  │    2 分钟前                          │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │ ✅ 周报已生成                        │    │
│  │    DeepSeek 生成，已发送              │    │
│  │    1 小时前                          │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  待处理                                      │
│  ┌─────────────────────────────────────┐    │
│  │ ⏳ 审批：调整 DeepSeek 配置           │    │
│  │    风险低，建议批准                    │    │
│  │                        [批准] [拒绝]  │    │
│  └─────────────────────────────────────┘    │
│                                              │
└─────────────────────────────────────────────┘
```

### 6.3 审批面板（从芯片展开）

```
┌─────────────────────────────────────────────┐
│                                              │
│  ← 返回                              审批    │
│  ────────────────────────────────────────── │
│                                              │
│  待审批 (1)                                  │
│  ┌─────────────────────────────────────┐    │
│  │ 调整 DeepSeek 配置                   │    │
│  │ 风险等级：低                          │    │
│  │ 申请人：product-chief                 │    │
│  │ 原因：生成周报需要更高质量模型         │    │
│  │                        [批准] [拒绝]  │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  已完成 (3)                                  │
│  ┌─────────────────────────────────────┐    │
│  │ ✅ 客户反馈归类                       │    │
│  │ ✅ 数据库备份                         │    │
│  │ ✅ 安全扫描                           │    │
│  └─────────────────────────────────────┘    │
│                                              │
└─────────────────────────────────────────────┘
```

### 6.4 员工状态面板（从芯片展开）

```
┌─────────────────────────────────────────────┐
│                                              │
│  ← 返回                           员工状态   │
│  ────────────────────────────────────────── │
│                                              │
│  ┌─────────────┐  ┌─────────────┐          │
│  │ 🟢 product  │  │ 🟢 ux       │          │
│  │    chief    │  │  researcher │          │
│  │ 空闲        │  │ 执行中      │          │
│  └─────────────┘  └─────────────┘          │
│                                              │
│  ┌─────────────┐  ┌─────────────┐          │
│  │ 🟢 ai       │  │ 🟡 security │          │
│  │  gateway    │  │    chief    │          │
│  │ 空闲        │  │ 审计中      │          │
│  └─────────────┘  └─────────────┘          │
│                                              │
│  ┌─────────────┐                            │
│  │ 🟢 data     │                            │
│  │  engineer   │                            │
│  │ 空闲        │                            │
│  └─────────────┘                            │
│                                              │
└─────────────────────────────────────────────┘
```

### 6.5 更多抽屉（底部滑入）

```
┌─────────────────────────────────────────────┐
│  更多功能                              收起 ↑ │
│  ────────────────────────────────────────── │
│                                              │
│  ┌─────────────┐  ┌─────────────┐          │
│  │  📊          │  │  🤖          │          │
│  │  指标监控     │  │  模型管理     │          │
│  │  服务正常     │  │  3 个模型     │          │
│  └─────────────┘  └─────────────┘          │
│                                              │
│  ┌─────────────┐  ┌─────────────┐          │
│  │  🔒          │  │  ⚙️          │          │
│  │  安全审计     │  │  设置        │          │
│  │  0 拦截      │  │  运行时配置   │          │
│  └─────────────┘  └─────────────┘          │
│                                              │
│  ┌─────────────┐  ┌─────────────┐          │
│  │  🏭          │  │  📋          │          │
│  │  员工管理     │  │  任务队列     │          │
│  │  workforce   │  │  执行历史     │          │
│  └─────────────┘  └─────────────┘          │
│                                              │
│  ┌─────────────┐  ┌─────────────┐          │
│  │  🔧          │  │  📖          │          │
│  │  诊断工具     │  │  使用帮助     │          │
│  │  健康检查     │  │  文档        │          │
│  └─────────────┘  └─────────────┘          │
│                                              │
└─────────────────────────────────────────────┘
```

---

## 七、动画规范

### 7.1 进入动画

```css
/* 淡入上移 */
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* 从底部滑入 */
@keyframes slide-in-bottom {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}

/* 从右侧滑入 */
@keyframes slide-in-right {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}

/* 缩放淡入 */
@keyframes scale-in {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}

/* 卡片展开 */
@keyframes card-expand {
  from {
    border-radius: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  to {
    border-radius: 0;
    box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  }
}
```

### 7.2 退出动画

```css
/* 淡出下移 */
@keyframes fade-out-down {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(12px); }
}

/* 向底部滑出 */
@keyframes slide-out-bottom {
  from { transform: translateY(0); }
  to   { transform: translateY(100%); }
}

/* 向左侧滑出 */
@keyframes slide-out-left {
  from { transform: translateX(0); }
  to   { transform: translateX(-100%); }
}
```

### 7.3 微交互

```css
/* 按钮按下 */
button:active {
  transform: scale(0.97);
  transition: transform 100ms ease;
}

/* 卡片悬浮 */
.card:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  transform: translateY(-1px);
  transition: all 200ms ease;
}

/* 输入框聚焦 */
input:focus {
  border-color: #ff6700;
  box-shadow: 0 0 0 3px rgba(255,103,0,0.1);
  transition: all 200ms ease;
}

/* 芯片悬浮 */
.chip:hover {
  background: #fff3e6;
  border-color: #ff6700;
  color: #ff6700;
  transition: all 200ms ease;
}
```

### 7.4 减弱动效

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 八、响应式断点

```
移动端（< 640px）：
  - 对话气泡最大宽度 90%
  - 建议芯片纵向排列
  - 更多抽屉全屏
  - 字号整体缩小 1px

平板（640px - 1024px）：
  - 对话气泡最大宽度 80%
  - 建议芯片横向排列
  - 更多抽屉宽度 80vw

桌面（> 1024px）：
  - 对话气泡最大宽度 70%
  - 内容最大宽度 720px，居中
  - 更多抽屉宽度 480px
```

---

## 九、实施路径

### Phase 1：视觉地基（先改色和间距）

| 任务 | 改什么 | 文件 |
|------|--------|------|
| 1.1 | 新增小米风格 token | `ownerDesignTokens.js` |
| 1.2 | 重写全局样式（浅色 + 圆角 + 间距） | `workbenchCoreCss.js` |
| 1.3 | 重写 Owner 主题（浅色） | `ownerOsTheme.js` |
| 1.4 | 重写内联样式 | `consolePageInlineCss.js` |

### Phase 2：首页瘦身（只留对话）

| 任务 | 改什么 | 文件 |
|------|--------|------|
| 2.1 | OwnerOSShell 只渲染 ConversationShell | `OwnerOSShell.js` |
| 2.2 | ConversationShell 接入新样式 | `ConversationShell.js` |
| 2.3 | 输入框改为胶囊形 | `ReplyField.js` |
| 2.4 | 芯片改为小米风格 | `SuggestionChips.js` |
| 2.5 | 客户端 JS 适配新交互 | `conversationShellClientJs.js` |

### Phase 3：卡片转场系统

| 任务 | 改什么 | 文件 |
|------|--------|------|
| 3.1 | 实现芯片→面板转场动画 | 新建 `cardTransition.js` |
| 3.2 | 日报面板（从芯片展开） | 新建 `DailyReportPanel.js` |
| 3.3 | 审批面板（从芯片展开） | 新建 `ApprovalPanel.js` |
| 3.4 | 员工状态面板（从芯片展开） | 新建 `WorkforceStatusPanel.js` |
| 3.5 | 更多抽屉（底部滑入） | 修改 `MoreDrawer` |
| 3.6 | 面板→芯片返回动画 | `cardTransition.js` |

### Phase 4：对话体验打磨

| 任务 | 改什么 | 文件 |
|------|--------|------|
| 4.1 | 对话气泡样式（小米风格） | `consolePageInlineCss.js` |
| 4.2 | workforce 轻量披露 | 新建 `WorkforceDisclosure.js` |
| 4.3 | 打字指示器动画 | `conversationShellClientJs.js` |
| 4.4 | 词汇表硬墙 | `conversationShellCopy.js` |

### Phase 5：响应式 + 无障碍

| 任务 | 改什么 | 文件 |
|------|--------|------|
| 5.1 | 移动端适配 | `consolePageInlineCss.js` |
| 5.2 | 平板适配 | `consolePageInlineCss.js` |
| 5.3 | 减弱动效支持 | `consolePageInlineCss.js` |
| 5.4 | 无障碍检查 | 全部组件 |

---

## 十、验收标准

### 视觉验收

- [ ] 第一屏只有 SystemFirstLine + ReplyField + SuggestionChips + MoreButton
- [ ] 无指标卡、无结果卡、无操作记录、无问候标题栏
- [ ] 浅色背景 `#f5f5f5`，卡片 `#ffffff`
- [ ] 强调色 `#ff6700`（小米橙）
- [ ] 所有圆角 ≥ 8px
- [ ] 字重不超过 700（除特殊情况）
- [ ] 无霓虹 glow、无 grid 动画、无 glass morphism

### 交互验收

- [ ] 点击芯片 → 从芯片位置生长为全屏面板（300ms）
- [ ] 面板返回 → 缩回芯片位置（250ms）
- [ ] 更多抽屉从底部滑入（300ms）
- [ ] 按钮按下有 scale(0.97) 反馈
- [ ] 输入框聚焦有边框变色 + 淡阴影
- [ ] 对话气泡有淡入上移动画

### 术语验收

- [ ] 第一屏无 Provider / God Mode / Tianshu / CredentialRef / NVIDIA 等术语
- [ ] 所有面向老板的文案使用中文自然语言

---

*方案完成，等待确认后进入实施。*
