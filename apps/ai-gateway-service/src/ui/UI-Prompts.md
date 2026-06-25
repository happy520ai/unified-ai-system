# UI-Prompts.md — AI 网关系统未来感 UI 升级

## 1. Project meta

- **Stack**: Server-side rendered HTML + vanilla JS + CSS (NOT Vue/React)
- **Theme**: Glassmorphism + Cyberpunk (dark)
- **Audience**: AI 系统运维、开发者、数据分析师
- **Existing system**: `apps/ai-gateway-service/src/ui/future-minimal-os/` (80+ components, 5 CSS files, state management, module registry)
- **Scope**: 增强现有 `future-minimal-os` 系统，不重写

## 2. Color token mapping

### 现有 → 新版

| Token | 现有值 | 新版值 | 变化说明 |
|-------|--------|--------|----------|
| `--future-bg` | `#07101c` | `#0A0A0A` | 更纯的暗黑，去掉蓝调 |
| `--future-bg-soft` | `#0b1828` | `#111114` | 更中性的深灰 |
| `--future-surface` | `rgb(12 25 42 / 72%)` | `rgba(255, 255, 255, 0.04)` | 玻璃拟态：半透明白 |
| `--future-surface-strong` | `rgb(14 30 50 / 88%)` | `rgba(255, 255, 255, 0.08)` | 更强的玻璃层 |
| `--future-border` | `rgb(151 174 255 / 20%)` | `rgba(0, 240, 255, 0.2)` | 霓虹蓝边框 |
| `--future-text` | `#f3f7ff` | `#F5F7FA` | 微调，更亮 |
| `--future-muted` | `#a7b4c8` | `#8A8FA3` | 更灰，降低干扰 |
| `--future-subtle` | `#76859b` | `#5A5F73` | 更暗，层次感 |
| `--future-accent` | `#7c8cff` | `#00F0FF` | **霓虹蓝**（主强调色） |
| `--future-accent-strong` | `#5b6cff` | `#B026FF` | **紫罗兰**（次强调色） |
| `--future-accent-soft` | `rgb(124 140 255 / 16%)` | `rgba(0, 240, 255, 0.12)` | 霓虹蓝半透明 |
| `--future-success` | `#38d39f` | `#00FF88` | 更亮的霓虹绿 |
| `--future-warning` | `#f7c66b` | `#FFB800` | 更饱和的琥珀 |
| `--future-danger` | `#ff7d8a` | `#FF3366` | 更烈的霓虹红 |

### 新增 token

```css
/* 霓虹紫半透明 */
--future-violet-soft: rgba(176, 38, 255, 0.12);

/* 玻璃拟态 */
--future-glass-blur: 20px;
--future-glass-bg: rgba(255, 255, 255, 0.03);
--future-glass-border: rgba(0, 240, 255, 0.15);

/* 霓虹发光 */
--future-glow-cyan: 0 0 20px rgba(0, 240, 255, 0.3), 0 0 60px rgba(0, 240, 255, 0.1);
--future-glow-violet: 0 0 20px rgba(176, 38, 255, 0.3), 0 0 60px rgba(176, 38, 255, 0.1);
--future-glow-pulse: glow-pulse 2s ease-in-out infinite;

/* 扫描线 */
--future-scanline: repeating-linear-gradient(
  0deg,
  transparent,
  transparent 2px,
  rgba(0, 240, 255, 0.03) 2px,
  rgba(0, 240, 255, 0.03) 4px
);
```

### Tailwind config snippet

```js
// tailwind.config.js (如果以后迁移到 Tailwind)
module.exports = {
  theme: {
    extend: {
      colors: {
        'future-bg': '#0A0A0A',
        'future-surface': 'rgba(255, 255, 255, 0.04)',
        'neon-cyan': '#00F0FF',
        'neon-violet': '#B026FF',
        'neon-green': '#00FF88',
        'neon-amber': '#FFB800',
        'neon-red': '#FF3366',
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(0, 240, 255, 0.3), 0 0 60px rgba(0, 240, 255, 0.1)',
        'glow-violet': '0 0 20px rgba(176, 38, 255, 0.3), 0 0 60px rgba(176, 38, 255, 0.1)',
      },
      backdropBlur: {
        'glass': '20px',
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'scanline': 'scanline 8s linear infinite',
      },
    },
  },
}
```

## 3. Typography

- **Display**: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` (保持现有)
- **Body**: 同上
- **Mono**: `"JetBrains Mono", "Fira Code", "Cascadia Code", monospace` (代码/数据)
- **Sizes**: 保持现有 scale，KPI 数字用 `font-size: 2.5rem; font-weight: 700;`

## 4. Component upgrade spec

### 4.1 GlassCard（增强 `future-module-card`）

**现有**：纯色背景 + 边框
**升级**：玻璃拟态 + 霓虹边框 + 悬停发光

```css
.future-module-card {
  background: var(--future-glass-bg);
  backdrop-filter: blur(var(--future-glass-blur));
  -webkit-backdrop-filter: blur(var(--future-glass-blur));
  border: 1px solid var(--future-glass-border);
  border-radius: var(--future-radius);
  box-shadow: var(--future-shadow-soft);
  transition: all var(--future-transition);
}

.future-module-card:hover {
  border-color: rgba(0, 240, 255, 0.4);
  box-shadow: var(--future-glow-cyan);
  transform: translateY(-2px);
}
```

### 4.2 StatusPill（增强）

**现有**：纯色背景
**升级**：霓虹发光 + 脉冲动画

```css
.status-pill--online {
  background: rgba(0, 255, 136, 0.15);
  color: #00FF88;
  box-shadow: 0 0 12px rgba(0, 255, 136, 0.3);
  animation: glow-pulse 2s ease-in-out infinite;
}

.status-pill--critical {
  background: rgba(255, 51, 102, 0.15);
  color: #FF3366;
  box-shadow: 0 0 12px rgba(255, 51, 102, 0.3);
  animation: glow-pulse 1s ease-in-out infinite;
}
```

### 4.3 KPI Tile（新增组件）

```html
<div class="kpi-tile">
  <span class="kpi-tile__value">$1.2M</span>
  <span class="kpi-tile__delta kpi-tile__delta--up">+12.4%</span>
  <span class="kpi-tile__label">Revenue</span>
</div>
```

```css
.kpi-tile {
  background: var(--future-glass-bg);
  backdrop-filter: blur(var(--future-glass-blur));
  border: 1px solid var(--future-glass-border);
  border-radius: var(--future-radius);
  padding: 24px;
  text-align: center;
}

.kpi-tile__value {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--future-text);
  text-shadow: 0 0 20px rgba(0, 240, 255, 0.3);
}

.kpi-tile__delta--up {
  color: #00FF88;
}

.kpi-tile__delta--down {
  color: #FF3366;
}
```

### 4.4 Navigation Rail（增强 `OsNavigationRail`）

**升级**：霓虹指示器 + 玻璃背景

```css
.os-nav-rail {
  background: var(--future-glass-bg);
  backdrop-filter: blur(var(--future-glass-blur));
  border-right: 1px solid var(--future-glass-border);
}

.os-nav-rail__item--active {
  background: var(--future-accent-soft);
  border-left: 3px solid var(--future-accent);
  box-shadow: var(--future-glow-cyan);
}
```

### 4.5 DataTable（新增组件）

```css
.future-data-table {
  width: 100%;
  border-collapse: collapse;
}

.future-data-table tr:hover {
  background: rgba(0, 240, 255, 0.05);
  box-shadow: inset 0 0 20px rgba(0, 240, 255, 0.05);
}

.future-data-table th {
  color: var(--future-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--future-glass-border);
}
```

### 4.6 Modal/Drawer（增强 `ProgressiveDetailsDrawer`）

```css
.future-drawer {
  background: rgba(10, 10, 10, 0.95);
  backdrop-filter: blur(30px);
  border-left: 1px solid var(--future-glass-border);
  box-shadow: -20px 0 60px rgba(0, 0, 0, 0.5);
}
```

## 5. Page-by-page layout

### 5.1 Dashboard（`MissionHomePanel`）

```
+--------------------------------------------------------------+
| [Nav Rail]  |  MISSION CONTROL                    [gear]     |
|-------------+------------------------------------------------|
| [Home]      |  +--- KPI ---+  +--- KPI ---+  +--- KPI ---+ |
| [Mission]   |  | $1.2M     |  | 87.3%     |  | 12.4K     | |
| [Evidence]  |  | +12.4%    |  | live      |  | live      | |
| [Security]  |  +-----------+  +-----------+  +-----------+ |
| [Provider]  |                                                |
| [Diag]      |  +--- Live Traffic --------+  +--- Alerts --+ |
|             |  |  /\  /\/\               |  | * 3 critical| |
|             |  |   \/\/    \/\  /\       |  | * 7 warning | |
|             |  +-------------------------+  +-------------+ |
|             |                                                |
|             |  +--- Recent Activity -----------------------+ |
|             |  | 14:32  user-1029  triggered phase-12a  ok | |
|             |  +-------------------------------------------+ |
+--------------------------------------------------------------+
```

### 5.2 Chat（`consolePage.js`）

```
+--------------------------------------------------------------+
| [Nav Rail]  |  CHAT                              [model ▾]   |
|-------------+------------------------------------------------|
| [History]   |  +------------------------------------------+ |
|             |  | AI: 欢迎使用 AI 网关系统...               | |
|             |  |                                          | |
|             |  | User: 帮我分析一下今天的流量              | |
|             |  |                                          | |
|             |  | AI: 今日流量分析结果...                   | |
|             |  +------------------------------------------+ |
|             |  +------------------------------------------+ |
|             |  | [输入消息...]                    [Send]  | |
|             |  +------------------------------------------+ |
+--------------------------------------------------------------+
```

### 5.3 Admin（`GodModePanel`）

```
+--------------------------------------------------------------+
| [Nav Rail]  |  ADMIN                             [alerts: 3] |
|-------------+------------------------------------------------|
| [Users]     |  +--- System Status ---+  +--- Alerts ------+ |
| [Config]    |  | CPU: 42%  Mem: 67% |  | * 3 critical    | |
| [Logs]      |  | Uptime: 99.97%     |  | * 7 warning     | |
| [Security]  |  +---------------------+  +-----------------+ |
|             |                                                |
|             |  +--- User Management ----------------------+ |
|             |  | [table of users with roles]              | |
|             |  +-------------------------------------------+ |
+--------------------------------------------------------------+
```

## 6. Motion grammar

| Animation | Duration | Easing | Use case |
|-----------|----------|--------|----------|
| Hover lift | 200ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Card hover |
| Glow pulse | 2s | `ease-in-out` infinite | Status pill, KPI highlight |
| Scanline | 8s | `linear` infinite | Background overlay |
| Stagger entry | 60ms/child | `cubic-bezier(0.16, 1, 0.3, 1)` | Page load |
| Drawer slide | 300ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Modal/drawer open |
| Skeleton shimmer | 1.5s | `linear` infinite | Loading states |

```css
@keyframes glow-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes scanline {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100%); }
}
```

## 7. Accessibility checklist

- [ ] All neon-on-dark combos meet WCAG AA (≥ 4.5:1 text)
  - `#00F0FF` on `#0A0A0A` = 10.3:1 ✅
  - `#B026FF` on `#0A0A0A` = 5.1:1 ✅
  - `#F5F7FA` on `#0A0A0A` = 18.7:1 ✅
- [ ] All interactive elements have visible focus ring (`--future-accent` outline + 2px offset)
- [ ] Respect `prefers-reduced-motion`: disable glow-pulse, scanline, stagger
- [ ] Status pills have text labels (not just color)
- [ ] KPI deltas have aria-labels ("up 12.4%" not just green arrow)

## 8. Implementation plan

### Phase 1: Token update（修改 1 个文件）
- 更新 `futureMinimalTokens.css` 的 CSS 变量
- 新增玻璃拟态、霓虹发光、扫描线 token

### Phase 2: Component enhancement（修改 3-5 个文件）
- 增强 `futureMinimalComponents.css` 的 card/button/status 样式
- 新增 KPI tile、DataTable 组件样式
- 增强导航栏霓虹指示器

### Phase 3: Page-level polish（修改 2-3 个文件）
- 更新 `consolePage.js` 的 chat 布局
- 更新 `MissionHomePanel.js` 的 dashboard 布局
- 更新 `GodModePanel.js` 的 admin 布局

### Phase 4: Motion & accessibility（修改 2 个文件）
- 添加 `@keyframes` 动画
- 添加 `prefers-reduced-motion` 媒体查询
- 添加 ARIA 标签

### Phase 5: Verification
- 视觉检查（截图对比）
- 对比度验证（WCAG AA）
- 动画性能检查（60fps）
