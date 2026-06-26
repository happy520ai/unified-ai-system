/* ============================================================
   sidebar.js — 共享侧边栏组件
   从 nav.js 读取配置,生成 sidebar HTML + 绑定交互
   依赖: nav.js (NAV_CONFIG, getActiveNavId)
   ============================================================ */

/**
 * 生成侧边栏 HTML
 * @param {Object} [options]
 * @param {string} [options.activeId] — 当前活跃项 ID,默认自动检测
 * @param {string} [options.brandText] — 品牌文字,默认 "Gateway"
 * @returns {string} HTML 字符串
 */
function renderSidebar(options = {}) {
  const activeId = options.activeId || getActiveNavId();
  const brandText = options.brandText || "太极北斗";

  const taijiSvg = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <circle cx="16" cy="16" r="15" stroke="url(#tg)" stroke-width="1.5" opacity="0.6"/>
    <path d="M16 1a15 15 0 0 1 0 30A15 15 0 0 0 16 1a7.5 7.5 0 0 1 0 15A7.5 7.5 0 0 0 16 1z" fill="url(#tg)"/>
    <circle cx="16" cy="8.5" r="2.5" fill="#7c6aef"/>
    <circle cx="16" cy="23.5" r="2.5" fill="#fff" opacity="0.7"/>
    <defs><linearGradient id="tg" x1="0" y1="0" x2="32" y2="32"><stop stop-color="#7c6aef"/><stop offset="1" stop-color="#60a5fa"/></linearGradient></defs>
  </svg>`;

  function renderLink(item) {
    const isActive = item.id === activeId ? " active" : "";
    const ariaCurrent = item.id === activeId ? ' aria-current="page"' : "";
    return `<a class="sidebar-link${isActive}" href="${item.href}"${ariaCurrent}>
      <svg viewBox="0 0 24 24" aria-hidden="true">${item.icon}</svg>
      <span class="sidebar-link-label" data-i18n="nav.${item.id}">${item.id}</span>
    </a>`;
  }

  return `<nav class="sidebar" id="sidebar" aria-label="主导航">
    <div class="sidebar-brand">
      <div class="sidebar-brand-icon" aria-hidden="true">${taijiSvg}</div>
      <span class="sidebar-brand-text">${brandText}</span>
    </div>

    <div class="sidebar-section-label" data-i18n="nav.core" aria-hidden="true">Core</div>
    <div class="sidebar-nav" role="list">
      ${NAV_CONFIG.core.map(renderLink).join("\n      ")}
    </div>

    <div class="sidebar-section-label" data-i18n="nav.system" aria-hidden="true">System</div>
    <div class="sidebar-nav" role="list">
      ${NAV_CONFIG.system.map(renderLink).join("\n      ")}
    </div>

    <div class="sidebar-footer" role="list">
      ${NAV_CONFIG.footer.map(renderLink).join("\n      ")}
    </div>
  </nav>

  <button class="sidebar-toggle" id="sidebar-toggle" title="Toggle sidebar" aria-label="切换侧边栏" aria-expanded="true">
    <svg viewBox="0 0 16 16" aria-hidden="true"><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="14" y2="12"/></svg>
  </button>

  <button class="theme-toggle" id="theme-toggle" title="切换主题" aria-label="切换亮色/暗色主题">
    <svg class="theme-icon-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
    <svg class="theme-icon-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  </button>`;
}

/**
 * 初始化侧边栏交互(折叠/展开)
 * 调用时机: DOMContentLoaded 或页面底部
 */
function initSidebarInteraction() {
  const sidebar = document.getElementById("sidebar");
  const toggle = document.getElementById("sidebar-toggle");
  const main = document.getElementById("page-main");
  if (!sidebar || !toggle) return;

  toggle.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    toggle.classList.toggle("collapsed");
    if (main) main.classList.toggle("sidebar-collapsed");
    const isExpanded = !sidebar.classList.contains("collapsed");
    toggle.setAttribute("aria-expanded", String(isExpanded));
  });

  // Theme toggle
  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    const saved = localStorage.getItem("theme");
    if (saved === "light") document.documentElement.classList.add("light-theme");
    themeToggle.addEventListener("click", () => {
      document.documentElement.classList.toggle("light-theme");
      const isLight = document.documentElement.classList.contains("light-theme");
      localStorage.setItem("theme", isLight ? "light" : "dark");
    });
  }
}

/**
 * 注入侧边栏到页面
 * @param {Object} [options] — 传递给 renderSidebar
 */
function injectSidebar(options = {}) {
  // 在 body 开头插入 sidebar HTML
  const wrapper = document.querySelector(".page-wrapper") || document.body;
  wrapper.insertAdjacentHTML("afterbegin", renderSidebar(options));
  // 绑定交互
  initSidebarInteraction();
}

// 导出到全局
window.renderSidebar = renderSidebar;
window.initSidebarInteraction = initSidebarInteraction;
window.injectSidebar = injectSidebar;
