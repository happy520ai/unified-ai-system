// =============================================================================
// component-system.js — UI 组件系统
// 轻量级组件化框架，支持主题切换、响应式布局
// =============================================================================

/**
 * 创建 UI 组件系统
 * @returns {Object} { createComponent, ThemeEngine, LayoutManager }
 */
export function createComponentSystem() {

  // ── 主题引擎 ──
  const ThemeEngine = {
    themes: {
      light: {
        "--bg": "#f5f7fa",
        "--surface": "#ffffff",
        "--surface-hover": "#f8f9fa",
        "--text": "#1a1a2e",
        "--text-secondary": "#666666",
        "--border": "#e0e0e0",
        "--primary": "#1a73e8",
        "--primary-hover": "#1557b0",
        "--success": "#0f9d58",
        "--warning": "#f4b400",
        "--danger": "#d93025",
        "--info": "#4285f4",
        "--code-bg": "#f1f3f4",
        "--shadow": "0 1px 3px rgba(0,0,0,0.1)",
        "--shadow-lg": "0 4px 12px rgba(0,0,0,0.15)",
        "--radius": "8px",
        "--radius-sm": "4px",
      },
      dark: {
        "--bg": "#0d1117",
        "--surface": "#161b22",
        "--surface-hover": "#1c2128",
        "--text": "#e6edf3",
        "--text-secondary": "#8b949e",
        "--border": "#30363d",
        "--primary": "#58a6ff",
        "--primary-hover": "#79c0ff",
        "--success": "#3fb950",
        "--warning": "#d29922",
        "--danger": "#f85149",
        "--info": "#58a6ff",
        "--code-bg": "#161b22",
        "--shadow": "0 1px 3px rgba(0,0,0,0.3)",
        "--shadow-lg": "0 4px 12px rgba(0,0,0,0.4)",
        "--radius": "8px",
        "--radius-sm": "4px",
      },
    },

    currentTheme: "light",

    setTheme(name) {
      if (!this.themes[name]) return;
      this.currentTheme = name;
      const vars = this.themes[name];
      for (const [key, value] of Object.entries(vars)) {
        document.documentElement.style.setProperty(key, value);
      }
      document.documentElement.setAttribute("data-theme", name);
      localStorage.setItem("ai-gateway-theme", name);
    },

    toggle() {
      this.setTheme(this.currentTheme === "light" ? "dark" : "light");
    },

    init() {
      const saved = localStorage.getItem("ai-gateway-theme");
      if (saved && this.themes[saved]) {
        this.setTheme(saved);
      } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        this.setTheme("dark");
      } else {
        this.setTheme("light");
      }
    },
  };

  // ── 响应式布局管理器 ──
  const LayoutManager = {
    breakpoints: { mobile: 768, tablet: 1024, desktop: 1280 },

    getDevice() {
      const w = window.innerWidth;
      if (w < this.breakpoints.mobile) return "mobile";
      if (w < this.breakpoints.tablet) return "tablet";
      return "desktop";
    },

    isMobile() { return this.getDevice() === "mobile"; },
    isTablet() { return this.getDevice() === "tablet"; },
    isDesktop() { return this.getDevice() === "desktop"; },

    onResize(callback) {
      let timeout;
      window.addEventListener("resize", () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => callback(this.getDevice()), 150);
      });
    },
  };

  // ── 组件工厂 ──
  function createComponent(name, options = {}) {
    const { template, styles, script, props = {} } = options;

    return {
      name,
      props,
      render(containerId, data = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // 注入样式
        if (styles && !document.getElementById(`style-${name}`)) {
          const styleEl = document.createElement("style");
          styleEl.id = `style-${name}`;
          styleEl.textContent = styles;
          document.head.appendChild(styleEl);
        }

        // 渲染模板
        const html = typeof template === "function" ? template(data) : template;
        container.innerHTML = html;

        // 执行脚本
        if (script) {
          script(container, data);
        }
      },
    };
  }

  // ── 通用组件 ──
  const Components = {
    // 卡片组件
    card: createComponent("card", {
      template: (data) => `
        <div class="card" style="background:var(--surface);border-radius:var(--radius);box-shadow:var(--shadow);padding:20px;margin-bottom:16px;">
          ${data.title ? `<h3 style="margin:0 0 12px;color:var(--text);font-size:1.1rem;">${data.title}</h3>` : ""}
          <div class="card-body">${data.content ?? ""}</div>
        </div>
      `,
    }),

    // 指标卡片
    metricCard: createComponent("metric-card", {
      template: (data) => `
        <div style="background:var(--surface);border-radius:var(--radius);box-shadow:var(--shadow);padding:20px;text-align:center;">
          <div style="font-size:2rem;font-weight:bold;color:var(--primary);">${data.value ?? "—"}</div>
          <div style="color:var(--text-secondary);font-size:0.9rem;margin-top:4px;">${data.label ?? ""}</div>
          ${data.trend ? `<div style="color:${data.trend > 0 ? "var(--success)" : "var(--danger)"};font-size:0.85rem;margin-top:4px;">${data.trend > 0 ? "↑" : "↓"} ${Math.abs(data.trend)}%</div>` : ""}
        </div>
      `,
    }),

    // 状态徽章
    badge: createComponent("badge", {
      template: (data) => {
        const colors = { success: "var(--success)", warning: "var(--warning)", danger: "var(--danger)", info: "var(--info)" };
        return `<span style="display:inline-block;padding:2px 8px;border-radius:var(--radius-sm);font-size:0.75rem;background:${colors[data.type] ?? colors.info};color:white;">${data.text ?? ""}</span>`;
      },
    }),

    // 表格组件
    table: createComponent("table", {
      template: (data) => {
        const headers = (data.columns ?? []).map((c) => `<th style="padding:10px 12px;text-align:left;border-bottom:2px solid var(--border);color:var(--text);font-weight:600;">${c.label}</th>`).join("");
        const rows = (data.rows ?? []).map((row) => {
          const cells = (data.columns ?? []).map((c) => `<td style="padding:10px 12px;border-bottom:1px solid var(--border);color:var(--text-secondary);">${row[c.key] ?? ""}</td>`).join("");
          return `<tr>${cells}</tr>`;
        }).join("");
        return `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`;
      },
    }),

    // 加载指示器
    spinner: createComponent("spinner", {
      template: () => `
        <div style="display:flex;align-items:center;gap:8px;color:var(--text-secondary);">
          <div style="width:20px;height:20px;border:2px solid var(--border);border-top-color:var(--primary);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
          <span>加载中...</span>
          <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
        </div>
      `,
    }),

    // 通知 Toast
    toast: createComponent("toast", {
      template: (data) => `
        <div id="toast-${Date.now()}" style="position:fixed;top:20px;right:20px;padding:12px 20px;border-radius:var(--radius);background:var(--surface);box-shadow:var(--shadow-lg);z-index:10000;animation:slideIn 0.3s ease;max-width:400px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.2rem;">${data.type === "success" ? "✅" : data.type === "error" ? "❌" : data.type === "warning" ? "⚠️" : "ℹ️"}</span>
            <span style="color:var(--text);">${data.message ?? ""}</span>
          </div>
          <style>@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}</style>
        </div>
      `,
      script: (el, data) => {
        setTimeout(() => el.innerHTML = "", data.duration ?? 3000);
      },
    }),
  };

  // ── WebSocket 实时状态 ──
  const LiveStatus = {
    ws: null,
    listeners: new Map(),

    connect(url) {
      this.ws = new WebSocket(url);
      this.ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          const handlers = this.listeners.get(msg.type) ?? [];
          handlers.forEach((h) => h(msg));
        } catch (err) { console.error("[component-system]:", err?.message || err); }
      };
      this.ws.onclose = () => setTimeout(() => this.connect(url), 5000);
    },

    on(type, handler) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(handler);
    },
  };

  return { ThemeEngine, LayoutManager, Components, LiveStatus, createComponent };
}
