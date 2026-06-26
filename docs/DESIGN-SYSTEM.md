# Design System — 太极北斗

## Token 体系

### 颜色

| Token | 用途 |
|-------|------|
| `--text-primary` | 主文本 (92% 白) |
| `--text-secondary` | 次文本 (56% 白) |
| `--text-tertiary` | 辅助文本 (32% 白) |
| `--accent` | 主题色 (#7c6aef) |
| `--accent-hover` | 主题色悬停 |
| `--accent-soft` | 主题色软背景 |
| `--status-success/warning/danger/info` | 状态色 |

### 间距

`--space-1` (4px) → `--space-10` (128px)

### 圆角

`--radius-xs` (6px) → `--radius-full` (9999px)

### 阴影

`--depth-1` → `--depth-3` (递增深度)
`--shadow-glow-accent` (卡片悬停发光)

---

## 组件清单

### 基础

| 组件 | 类名 | 描述 |
|------|------|------|
| 按钮 | `.btn .btn-primary .btn-secondary .btn-ghost .btn-danger` | 基础按钮 |
| 输入框 | `.input` | 文本输入 |
| 输入验证 | `.input-success .input-warning .input-error` | 验证状态 |
| 表单提示 | `.form-hint .form-hint-success/warning/error` | 提示文字 |

### 卡片与面板

| 组件 | 类名 | 描述 |
|------|------|------|
| 玻璃面板 | `.glass-panel` | 标准玻璃面板 |
| 重玻璃 | `.glass-panel-heavy` | 深度模糊 |
| 静态玻璃 | `.glass-panel-static` | 无悬停 |
| 渐变边框 | `.gradient-border` | accent 渐变描边 |
| 发光卡片 | `.glow-card` | 悬停发光 |

### 表格

| 组件 | 类名 | 描述 |
|------|------|------|
| 表格 | `.table .data-table` | 斑马纹 + hover |

### 列表与动画

| 组件 | 类名 | 描述 |
|------|------|------|
| 级联列表 | `.stagger > *` | 50ms 级联入场 |
| 滚动揭示 | `.reveal` | 滚动时淡入 |

### 状态指示

| 组件 | 类名 | 描述 |
|------|------|------|
| 徽章 | `.badge .badge-accent/success/warning/danger` | 状态标签 |
| 横幅 | `.banner .banner-info/success/warning/danger` | 状态横幅 |

### 加载

| 组件 | 类名 | 描述 |
|------|------|------|
| 旋转器 | `.spinner .spinner-lg` | 旋转加载 |
| 脉冲点 | `.loading-dots` | 三点脉冲 |
| 骨架屏 | `.skeleton .skeleton-text .skeleton-card .skeleton-row` | 加载占位 |
| 脉冲 | `.pulse` | 透明度呼吸 |

### 空/错误/成功状态

| 组件 | 类名 | 描述 |
|------|------|------|
| 空状态 | `.empty-state` | 图标+文字 |
| 错误状态 | `.error-state` | 红色图标+描述 |
| 成功状态 | `.success-state` | 绿色图标 |

### 分隔

| 组件 | 类名 | 描述 |
|------|------|------|
| 分隔线 | `.divider` | 玻璃分隔线 |
| 渐变分隔 | `.divider-accent` | accent 渐变 |

### 文字

| 组件 | 类名 | 描述 |
|------|------|------|
| 渐变文字 | `.gradient-text` | accent→blue |
| 暖色渐变 | `.gradient-text-warm` | accent→amber |

### 交互

| 组件 | 类名 | 描述 |
|------|------|------|
| Tooltip | `[data-tooltip]` | 悬停提示 |
| 回到顶部 | `.back-to-top` | 浮动按钮 |

### 代码

| 组件 | 类名 | 描述 |
|------|------|------|
| 行内代码 | `.bubble-text code` | 代码样式 |
| 代码块 | `.bubble-text pre` | 终端风格 |

### 主题

| 组件 | 类名 | 描述 |
|------|------|------|
| 主题切换 | `.theme-toggle` | 月亮/太阳按钮 |
| 亮色主题 | `.light-theme` | 60+ token 覆盖 |

### 导航

| 组件 | 类名 | 描述 |
|------|------|------|
| 侧边栏切换 | `.sidebar-toggle` | 固定定位 |
| 导航徽章 | `.sidebar-badge` | 红色脉冲 |

### 聊天

| 组件 | 类名 | 描述 |
|------|------|------|
| 打字光标 | `.typing-cursor` | blink + glow |
| 流式文本 | `.streaming-line` | fade-in |
| 连接状态 | `.chat-status-badge` | 状态指示 |

### 新增组件

| 组件 | 类名 | 描述 |
|------|------|------|
| 数字计数 | `.counter.counting` | accent 高亮 |
| 加载覆盖 | `.loading-overlay` | 玻璃模糊遮罩 |
| 标签 | `.tag` | 内联标签 |
| 头像 | `.avatar .avatar-sm .avatar-lg` | 3 种尺寸 |
| 进度条 | `.progress-bar` | 渐变填充 |
| 芯片 | `.chip .chip.active` | 筛选芯片 |

---

## 品牌

- **Favicon**: SVG 太极符号
- **主题色**: #7c6aef (accent)
- **字体**: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui
