/* ============================================================
   interact.js — Global Interaction System
   Toast notifications, modals, confirmations, button handlers
   ============================================================ */

/* ── XSS Prevention: escape HTML entities ── */
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
window.escapeHtml = escapeHtml;

const Interact = window.Interact = {
  /* ── Toast Notification System ── */
  toastContainer: null,

  /* ── Shared Provider Icon Map ── */
  PROVIDER_ICONS: {
    // 🇨🇳 Chinese
    deepseek:'🐋', moonshot:'🌙', baichuan:'🏔', minimax:'🐚', stepfun:'⚡', zeroone:'0️⃣',
    zhipu:'🔷', iflytek:'🎙', internlm:'📚', sensetime:'👁', kunlun:'⛰', netease:'🎮',
    xiaomi:'📱', baai:'🧠', volcengine:'🌋', siliconflow:'💎', baidu:'🔍', tencent:'🐧',
    alibaba:'☁️', modelscope:'🔭', publicwelfare:'💚',
    // 🌍 Global
    openai:'🟢', anthropic:'🟤', google:'🔴', mistral:'🌀', cohere:'🔶', ai21:'🧪',
    groq:'🟠', cerebras:'⚡', sambanova:'🟡', nvidia:'💚', together:'🤝', fireworks:'🎆',
    deepinfra:'🏗', friendli:'💜', novita:'🌟', lepton:'⚛️', openrouter:'🟣',
    huggingface:'🤗', perplexity:'🔮', replicate:'🧬', anyscale:'📐', octoai:'🐙',
    cloudflare:'☁️', azure:'🔵', aws:'📦', vertex:'🔺', ibm:'🔷', oracle:'🔴',
    lambda:'λ', coreweave:'🧊', agnes:'💜', codeium:'💻', bloom:'🌸',
  },

  initToast() {
    if (this.toastContainer) return;
    this.toastContainer = document.createElement('div');
    this.toastContainer.id = 'toast-container';
    this.toastContainer.setAttribute('role', 'alert');
    this.toastContainer.setAttribute('aria-live', 'assertive');
    this.toastContainer.setAttribute('aria-atomic', 'true');
    this.toastContainer.style.cssText = `
      position: fixed; top: 24px; right: 24px; z-index: 9999;
      display: flex; flex-direction: column; gap: 8px;
      pointer-events: none;
    `;
    document.body.appendChild(this.toastContainer);
  },

  toast(message, type = 'info', duration = 3000) {
    this.initToast();
    const colors = {
      success: { bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.25)', text: '#34d399', icon: '✓' },
      error: { bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)', text: '#f87171', icon: '✕' },
      warning: { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.25)', text: '#fbbf24', icon: '⚠' },
      info: { bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.25)', text: '#60a5fa', icon: 'ℹ' },
    };
    const c = colors[type] || colors.info;
    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.style.cssText = `
      pointer-events: auto; display: flex; align-items: center; gap: 10px;
      padding: 12px 20px; border-radius: 14px;
      background: ${c.bg}; border: 1px solid ${c.border};
      backdrop-filter: blur(40px) saturate(180%);
      -webkit-backdrop-filter: blur(40px) saturate(180%);
      color: ${c.text}; font-size: 14px; font-weight: 500;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      transform: translateX(120%); opacity: 0;
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;
    el.innerHTML = `<span style="font-size:16px" aria-hidden="true">${c.icon}</span><span>${escapeHtml(message)}</span>`;
    this.toastContainer.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = 'translateX(0)';
      el.style.opacity = '1';
    });
    setTimeout(() => {
      el.style.transform = 'translateX(120%)';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 400);
    }, duration);
  },

  /* ── Confirmation Dialog ── */
  confirm(title, message, onConfirm, type = 'default') {
    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', title);
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9998;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.3s ease;
    `;
    const isDanger = type === 'danger';
    const btnColor = isDanger ? '#f87171' : '#7c6aef';
    const btnBg = isDanger ? 'rgba(248,113,113,0.15)' : 'rgba(124,106,239,0.15)';
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: rgba(12,12,18,0.92); backdrop-filter: blur(80px) saturate(200%);
      border: 1px solid rgba(255,255,255,0.08); border-radius: 24px;
      padding: 32px; max-width: 420px; width: calc(100% - 32px);
      box-shadow: 0 16px 80px rgba(0,0,0,0.6);
      transform: scale(0.95) translateY(8px);
      transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1);
    `;
    const cancelText = I18N ? I18N.t('common.cancel') : 'Cancel';
    const confirmText = I18N ? I18N.t('common.confirm') : 'Confirm';
    modal.innerHTML = `
      <h3 style="font-size:18px;font-weight:600;color:rgba(255,255,255,0.92);margin-bottom:12px">${escapeHtml(title)}</h3>
      <p style="font-size:14px;color:rgba(255,255,255,0.56);line-height:1.6;margin-bottom:28px">${escapeHtml(message)}</p>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="confirm-cancel" style="
          padding:8px 20px;border-radius:10px;font-size:14px;font-weight:500;cursor:pointer;
          background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.56);border:1px solid rgba(255,255,255,0.08);
        ">${cancelText}</button>
        <button class="confirm-ok" style="
          padding:8px 20px;border-radius:10px;font-size:14px;font-weight:500;cursor:pointer;
          background:${btnBg};color:${btnColor};border:1px solid ${btnColor}33;
        ">${confirmText}</button>
      </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    // Focus trap: focus the confirm button
    const confirmBtn = overlay.querySelector('.confirm-ok');
    if (confirmBtn) confirmBtn.focus();
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      modal.style.transform = 'scale(1) translateY(0)';
    });
    const close = () => {
      overlay.style.opacity = '0';
      modal.style.transform = 'scale(0.95) translateY(8px)';
      setTimeout(() => overlay.remove(), 300);
    };
    overlay.querySelector('.confirm-cancel').onclick = close;
    overlay.querySelector('.confirm-ok').onclick = () => { close(); if (onConfirm) onConfirm(); };
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    const escHandler = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);
  },

  /* ── Loading Simulation ── */
  simulateAction(btn, successMsg, durationMs = 1200) {
    const original = btn.textContent;
    const originalStyle = btn.style.opacity;
    btn.style.opacity = '0.6';
    btn.style.pointerEvents = 'none';
    const loadingText = I18N ? I18N.t('common.loading') : 'Loading...';
    btn.textContent = loadingText;
    setTimeout(() => {
      btn.textContent = original;
      btn.style.opacity = originalStyle;
      btn.style.pointerEvents = '';
      this.toast(successMsg || (I18N ? I18N.t('common.success') : 'Success'), 'success');
    }, durationMs);
  },

  /* ── Copy to Clipboard ── */
  copy(text) {
    navigator.clipboard.writeText(text).then(() => {
      this.toast(I18N ? I18N.t('common.copied') : 'Copied', 'success');
    }).catch(() => {
      this.toast(I18N ? I18N.t('common.error') : 'Failed', 'error');
    });
  },

  /* ── Generic Tab Switching ── */
  initTabs() {
    const isZh = () => (typeof I18N !== 'undefined' ? I18N.current === 'zh' : true);
    const modeColors = {
      standard: { color: '#7c6aef', glow: 'rgba(124,106,239,0.15)' },
      god:      { color: '#f59e0b', glow: 'rgba(245,158,11,0.15)' },
      tianshu:  { color: '#06b6d4', glow: 'rgba(6,182,212,0.18)' },
    };
    const modeDescs = {
      standard: { zh: '标准模式 — 太极路由自动选择最佳模型', en: 'Standard — Auto-route selects the best single model', color: '#7c6aef' },
      god:      { zh: '上帝模式 — 多模型并行审查 + 太极评分', en: 'God Mode — Multi-model parallel review + Taiji scoring', color: '#f59e0b' },
      tianshu:  { zh: '天枢模式 — 规划模型 + 执行模型协同', en: 'Tianshu — Planner + executor model coordination', color: '#06b6d4' },
    };
    document.querySelectorAll('.tabs').forEach(tabBar => {
      const tabs = tabBar.querySelectorAll('.tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const target = tab.getAttribute('data-tab');
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          // Find sibling panes
          const parent = tabBar.parentElement;
          parent.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.getAttribute('data-pane') === target);
          });
          // Update mode description for dashboard AI assistant
          if (modeDescs[target]) {
            const desc = parent.querySelector('[data-i18n="dashboard.modeDesc"]');
            if (desc) {
              const lang = isZh() ? 'zh' : 'en';
              desc.textContent = modeDescs[target][lang];
              desc.style.color = modeDescs[target].color;
            }
          }
          // ── Sci-fi mode switch effect ──
          const mc = modeColors[target];
          if (mc) {
            const panel = document.getElementById('ai-assistant-panel') || tabBar.closest('.glass-panel-static');
            if (panel) {
              // Set mode color CSS variables
              panel.style.setProperty('--mode-color', mc.color);
              panel.style.setProperty('--mode-glow', mc.glow);
              // Trigger scan line animation (restart by removing/re-adding class)
              panel.classList.remove('mode-switching');
              void panel.offsetWidth; // force reflow to restart animation
              panel.classList.add('mode-switching');
              // Clean up animation class after it finishes
              clearTimeout(panel._modeSwitchTimer);
              panel._modeSwitchTimer = setTimeout(() => {
                panel.classList.remove('mode-switching');
              }, 1400);
            }
          }
        });
      });
    });
  },

  /* ── Search Filter ── */
  initSearch() {
    document.querySelectorAll('[data-search-target]').forEach(input => {
      const targetSelector = input.getAttribute('data-search-target');
      input.addEventListener('input', () => {
        const query = input.value.toLowerCase().trim();
        document.querySelectorAll(targetSelector).forEach(card => {
          const text = card.textContent.toLowerCase();
          card.style.display = text.includes(query) ? '' : 'none';
        });
      });
    });
  },

  /* ── Intersection Observer for Reveals ── */
  initReveal() {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal:not(.visible)').forEach(el => obs.observe(el));
  },

  /* ── Button Click Delegation ── */
  initButtons() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      this.handleAction(action, btn);
    });
  },

  handleAction(action, btn) {
    switch (action) {
      case 'toggle-lang':
        I18N.toggle();
        this.toast(I18N.current === 'zh' ? '已切换为中文' : 'Switched to English', 'info');
        break;
      case 'save':
        this.saveCurrentState(btn);
        break;
      case 'export':
        this.exportBackup(btn);
        break;
      case 'import':
        this.importBackup(btn);
        break;
      case 'reset-config':
        this.resetConfiguration(btn);
        break;
      case 'clear-kb':
        this.clearKnowledgeBase(btn);
        break;
      case 'create-plan':
        this.createWorkforcePlan(btn);
        break;
      case 'test-rag':
        this.testRagFunctionality(btn);
        break;
      case 'add-provider':
        this.toast(I18N.current === 'zh' ? '提供商配置面板即将开放' : 'Provider setup coming soon', 'info');
        break;
      case 'hotspot-refresh':
        this.refreshHotspot();
        break;
      case 'open-model-config':
        this.openModelConfig();
        break;
      case 'close-model-config':
        this.closeModelConfig();
        break;
      case 'config-back':
        this.configBackToProviders();
        break;
      case 'toggle-key-visibility':
        this.configToggleKeyVisibility();
        break;
      case 'config-test':
        this.configTestConnection();
        break;
      case 'config-save':
        this.configSaveKey();
        break;
      case 'copy-log':
        const terminal = btn.closest('.terminal')?.querySelector('.terminal-body') || btn.parentElement.nextElementSibling;
        if (terminal) this.copy(terminal.textContent.trim());
        break;
      case 'new-task':
        this.simulateAction(btn, I18N.current === 'zh' ? '新任务已创建' : 'New task created');
        break;
      case 'review-all':
        this.simulateAction(btn, I18N.current === 'zh' ? '所有补丁已标记为已审查' : 'All patches marked as reviewed');
        break;
      case 'manage-rules':
        this.toast(I18N.current === 'zh' ? '权限管理面板即将开放' : 'Permission management panel coming soon', 'info');
        break;
      case 'export-logs':
        this.exportBackup(btn);
        break;
      case 'login':
        btn.closest('form')?.addEventListener('submit', (ev) => ev.preventDefault(), { once: true });
        this.toast(I18N.current === 'zh' ? '登录功能演示模式' : 'Login is demo-only', 'info');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 1200);
        break;
      case 'go-dashboard':
        window.location.href = 'dashboard.html';
        break;
      default:
        this.toast(`Action: ${action}`, 'info');
    }
  },

  /* ── Provider & Model Selector (now serves auto-router data) ── */
  providersData: null,
  selectedProvider: 'nvidia',
  selectedModel: '',

  initProviders() {
    // Fetch provider data for auto-router and config modal (no more dropdowns)
    fetch('/providers')
      .then(r => {
        if (r.status === 404) throw new Error('route_not_available');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(json => {
        if (json.success) {
          this.providersData = json.providers;
          // Pre-select first configured provider as fallback
          const configured = json.providers.find(p => p.hasKey);
          if (configured) {
            this.selectedProvider = configured.id;
            this.selectedModel = configured.defaultModel || configured.models?.[0] || '';
          }
        }
      })
      .catch(e => {
        if (e.message !== 'route_not_available') console.warn('[Interact] /providers:', e.message);
      });
  },

  updateModels(providerId) {
    if (!this.providersData) return;
    const provider = this.providersData.find(p => p.id === providerId);
    if (!provider) return;
    this.selectedModel = provider.defaultModel || provider.models?.[0] || '';
  },

  /* ── Free Model Hotspot ── */
  hotspotData: null,
  hotspotFilter: 'all',
  hotspotSearchText: '',

  initHotspot() {
    const section = document.getElementById('hotspot-section');
    if (!section) return;

    // Load hotspot data
    this.loadHotspotData();

    // Filter chip clicks
    const filters = document.getElementById('hotspot-filters');
    if (filters) {
      filters.addEventListener('click', (e) => {
        const btn = e.target.closest('.hotspot-filter');
        if (!btn) return;
        filters.querySelectorAll('.hotspot-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.hotspotFilter = btn.dataset.filter;
        this.renderHotspotModels();
      });
    }

    // Search input
    const search = document.getElementById('hotspot-search');
    if (search) {
      search.addEventListener('input', () => {
        this.hotspotSearchText = search.value.toLowerCase().trim();
        this.renderHotspotModels();
      });
    }

    // Configure button clicks (event delegation)
    const models = document.getElementById('hotspot-models');
    if (models) {
      models.addEventListener('click', (e) => {
        const configBtn = e.target.closest('[data-config-provider]');
        if (configBtn) {
          e.preventDefault();
          this.openModelConfig(configBtn.dataset.configProvider);
        }
      });
    }

    // Auto-refresh every 60 seconds
    this.hotspotAutoRefreshInterval = setInterval(() => {
      this.loadHotspotData(true); // silent refresh
    }, 60000);
  },

  loadHotspotData(silent = false) {
    fetch('/hotspot')
      .then(r => {
        if (r.status === 404) throw new Error('route_not_available');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(json => {
        if (json.success && json.models) {
          this.hotspotData = json;
          this.updateHotspotSummary(json.summary);
          this.updateHotspotRefreshTime(json.fetchedAt);
          this.updateSourceStatus(json.summary);
          this.renderHotspotModels();
        } else if (!silent) {
          const el = document.getElementById('hotspot-models');
          if (el) el.innerHTML = `<div class="text-body-sm text-tertiary" style="text-align:center;padding:40px 0;">${json.error || (I18N.current === 'zh' ? '暂无热点数据' : 'No hotspot data yet')}</div>`;
        }
      })
      .catch(e => {
        if (!silent) {
          const el = document.getElementById('hotspot-models');
          const is404 = e.message === 'route_not_available';
          const msg = is404
            ? (I18N.current === 'zh' ? '热点数据服务暂不可用' : 'Hotspot service unavailable')
            : (I18N.current === 'zh' ? '无法加载热点数据' : 'Failed to load hotspot data');
          if (el) el.innerHTML = `<div class="text-body-sm text-tertiary" style="text-align:center;padding:40px 0;">${msg}</div>`;
        }
      });
  },

  updateHotspotSummary(s) {
    if (!s) return;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('hotspot-total', s.totalDeduped || s.totalRanked || 0);
    set('hotspot-chat', s.chatCapable || 0);
    set('hotspot-reasoning', s.reasoningCapable || 0);
    set('hotspot-coding', s.codingCapable || 0);
    set('hotspot-chinese', s.chineseOptimized || 0);
    // Update permanent/limited filter badges
    const permBtn = document.querySelector('[data-filter="permanent"]');
    const limBtn = document.querySelector('[data-filter="limited"]');
    if (permBtn && s.permanentFree !== undefined) permBtn.textContent = `🟢 永久免费 (${s.permanentFree})`;
    if (limBtn && s.limitedFree !== undefined) limBtn.textContent = `🟡 限时免费 (${s.limitedFree})`;
  },

  updateSourceStatus(s) {
    const el = document.getElementById('hotspot-source-status');
    if (!el || !s) return;
    const ok = s.sourcesOk || 0;
    const total = s.totalSources || 0;
    el.textContent = `${ok}/${total} sources`;
    el.style.color = ok === total ? '#34d399' : (ok > 0 ? '#fbbf24' : '#f87171');
  },

  updateHotspotRefreshTime(ts) {
    const el = document.getElementById('hotspot-refresh-time');
    if (!el || !ts) return;
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffH = Math.floor(diffMs / 3600000);
    const diffM = Math.floor(diffMs / 60000);
    let timeStr;
    if (diffH > 24) timeStr = d.toLocaleDateString();
    else if (diffH > 0) timeStr = `${diffH}h ago`;
    else timeStr = `${diffM}m ago`;
    const prefix = I18N.current === 'zh' ? '更新于' : 'Updated';
    el.textContent = `${prefix} ${timeStr}`;
  },

  renderHotspotModels() {
    const el = document.getElementById('hotspot-models');
    if (!el || !this.hotspotData) return;
    const models = this.hotspotData.models || [];
    const filter = this.hotspotFilter;
    const search = this.hotspotSearchText;

    // Apply filters
    let filtered = models.filter(m => {
      if (filter === 'permanent' && m.freeType !== 'permanent') return false;
      if (filter === 'limited' && m.freeType !== 'limited') return false;
      if (filter === 'chat' && !m.capabilities?.chat) return false;
      if (filter === 'reasoning' && !m.capabilities?.reasoning) return false;
      if (filter === 'coding' && !m.capabilities?.coding) return false;
      if (filter === 'vision' && !m.capabilities?.vision) return false;
      if (filter === 'chinese' && !m.capabilities?.chineseOptimized) return false;
      if (filter === 'trending' && !m.trending) return false;
      if (search) {
        const name = (m.modelId || m.displayName || '').toLowerCase();
        const prov = (m.sourceName || m.provider || '').toLowerCase();
        if (!name.includes(search) && !prov.includes(search)) return false;
      }
      return true;
    });

    // Limit display to first 80
    const showing = filtered.slice(0, 80);

    if (showing.length === 0) {
      el.innerHTML = `<div class="text-body-sm text-tertiary" style="text-align:center;padding:40px 0;">${I18N.current === 'zh' ? '没有匹配的模型' : 'No matching models'}</div>`;
    } else {
      const freeTypeIcons = { permanent: '🟢', limited: '🟡', trial: '🔵', open_source: '⚪' };
      const freeTypeLabels = { permanent: '永久', limited: '限时', trial: '试用', open_source: '开源' };
      el.innerHTML = showing.map(m => {
        const name = escapeHtml(m.displayName || m.modelId || 'Unknown');
        const modelId = escapeHtml(m.modelId || '');
        const sourceName = escapeHtml(m.sourceName || m.sourceId || '');
        const ctx = m.contextLength ? (m.contextLength >= 1000 ? Math.floor(m.contextLength / 1000) + 'K' : m.contextLength) : '--';
        const caps = m.capabilities || {};
        const ft = m.freeType || 'limited';
        const badges = [];
        // Free type badge
        badges.push(`<span class="hotspot-badge hotspot-badge-freetype hotspot-badge-${ft}">${freeTypeIcons[ft] || '🟡'} ${freeTypeLabels[ft] || '限时'}</span>`);
        if (caps.chat) badges.push('<span class="hotspot-badge hotspot-badge-chat">chat</span>');
        if (caps.reasoning) badges.push('<span class="hotspot-badge hotspot-badge-reasoning">reason</span>');
        if (caps.coding) badges.push('<span class="hotspot-badge hotspot-badge-coding">code</span>');
        if (caps.vision) badges.push('<span class="hotspot-badge hotspot-badge-vision">vision</span>');
        if (caps.chineseOptimized) badges.push('<span class="hotspot-badge hotspot-badge-chinese">中文</span>');
        if (caps.embedding) badges.push('<span class="hotspot-badge hotspot-badge-embedding">embed</span>');
        if (caps.longContext) badges.push('<span class="hotspot-badge hotspot-badge-long">long</span>');
        if (m.trending) badges.push('<span class="hotspot-badge hotspot-badge-trending">🔥</span>');
        const providerKey = escapeHtml((m.sourceId || '').replace('-free', '').replace('-trending', '').replace('-inference', ''));
        const registerBtn = `<button class="hotspot-register-btn" data-config-provider="${providerKey}">${I18N.current === 'zh' ? '配置' : 'Configure'}</button>`;
        return `<div class="hotspot-model-card" title="${modelId}">
          <div class="hotspot-model-info">
            <div class="hotspot-model-name">${name}</div>
            <div class="hotspot-model-provider">${sourceName}</div>
          </div>
          <div class="hotspot-model-badges">${badges.join('')}</div>
          <div class="hotspot-model-ctx">${ctx}</div>
          ${registerBtn}
        </div>`;
      }).join('');
    }

    // Update showing count
    const showEl = document.getElementById('hotspot-showing');
    if (showEl) {
      const label = I18N.current === 'zh' ? `显示 ${showing.length}/${filtered.length} 个模型` : `Showing ${showing.length}/${filtered.length} models`;
      showEl.textContent = label;
    }
  },

  refreshHotspot() {
    const section = document.getElementById('hotspot-section');
    if (section) section.classList.add('hotspot-refreshing');
    const btn = document.getElementById('hotspot-refresh-btn');
    if (btn) btn.disabled = true;

    fetch('/hotspot/refresh', { method: 'POST' })
      .then(r => {
        if (r.status === 404) throw new Error('route_not_available');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(json => {
        if (json.success) {
          this.toast(I18N.current === 'zh' ? `热点已刷新，发现 ${json.total} 个免费模型` : `Hotspot refreshed: ${json.total} free models`, 'success');
          this.loadHotspotData();
        } else {
          this.toast(json.reason === 'already_refreshing'
            ? (I18N.current === 'zh' ? '正在刷新中...' : 'Already refreshing...')
            : (I18N.current === 'zh' ? '刷新失败: ' + (json.error || '') : 'Refresh failed: ' + (json.error || '')),
            'warning');
        }
      })
      .catch(e => {
        const msg = e.message === 'route_not_available'
          ? (I18N.current === 'zh' ? '热点刷新服务暂不可用' : 'Hotspot refresh unavailable')
          : (I18N.current === 'zh' ? '刷新失败' : 'Refresh failed');
        this.toast(msg, 'error');
      })
      .finally(() => {
        if (section) section.classList.remove('hotspot-refreshing');
        if (btn) btn.disabled = false;
      });
  },

  /* ── Model Configuration Modal ── */
  configProviders: null,
  configSelectedProvider: null,
  configTestedModels: null,

  initModelConfig() {
    const modal = document.getElementById('model-config-modal');
    if (!modal) return;

    // Direct button binding — event delegation via data-action also handles this,
    // so we skip binding here to avoid double-fire. This block is intentionally empty.
    // The button works via: (1) data-action event delegation, (2) inline onclick fallback.

    fetch('/providers').then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(json => {
      if (json.success) {
        this.configProviders = json.providers;
        this.renderProviderGrid(json.providers);
        this.updateModelCountBadge(json.providers.length);
      }
    }).catch(e => console.warn('[Interact] model-config providers:', e.message));
  },

  updateModelCountBadge(count) {
    const badge = document.getElementById('model-count-badge');
    if (badge) badge.textContent = count;
  },

  renderProviderGrid(providers) {
    const grid = document.getElementById('config-provider-grid');
    if (!grid) return;
    const icons = this.PROVIDER_ICONS;
    grid.innerHTML = providers.map(p => {
      const hasKey = p.hasKey;
      const icon = icons[p.id] || '⚪';
      const region = p.region === 'cn' ? '🇨🇳' : '🌐';
      return `<div class="config-provider-card" data-provider-id="${escapeHtml(p.id)}" data-region="${escapeHtml(p.region || '')}" data-has-key="${hasKey}">
        <div class="provider-status-dot ${hasKey ? 'configured' : ''}"></div>
        <div class="provider-icon">${icon}</div>
        <div class="provider-info">
          <div class="provider-name">${escapeHtml(p.name)}</div>
          <div class="provider-meta">${p.models?.length || 0} models ${region}</div>
        </div>
      </div>`;
    }).join('');

    grid.onclick = (e) => {
      const card = e.target.closest('.config-provider-card');
      if (!card) return;
      this.selectConfigProvider(card.dataset.providerId);
    };

    // Combined search + region filter
    const filterProviders = () => {
      const search = document.getElementById('config-provider-search');
      const q = search ? search.value.toLowerCase().trim() : '';
      const activeTab = document.querySelector('.config-region-tab.active');
      const region = activeTab ? activeTab.dataset.region : 'all';
      let shown = 0, total = 0;
      grid.querySelectorAll('.config-provider-card').forEach(card => {
        total++;
        const name = card.querySelector('.provider-name')?.textContent?.toLowerCase() || '';
        const cardRegion = card.dataset.region || '';
        const cardConfigured = card.dataset.hasKey === 'true';
        const matchSearch = !q || name.includes(q);
        const matchRegion = region === 'all' ||
          (region === 'cn' && cardRegion === 'cn') ||
          (region === 'global' && cardRegion === 'global') ||
          (region === 'configured' && cardConfigured);
        const visible = matchSearch && matchRegion;
        card.style.display = visible ? '' : 'none';
        if (visible) shown++;
      });
      const countEl = document.getElementById('config-provider-count');
      if (countEl) countEl.textContent = `${shown} / ${total} providers`;
    };

    const search = document.getElementById('config-provider-search');
    if (search) search.oninput = filterProviders;

    // Region tab click
    const tabs = document.getElementById('config-region-tabs');
    if (tabs) {
      tabs.onclick = (e) => {
        const tab = e.target.closest('.config-region-tab');
        if (!tab) return;
        tabs.querySelectorAll('.config-region-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        filterProviders();
      };
    }

    // Initial count
    filterProviders();
  },

  selectConfigProvider(providerId) {
    this.configSelectedProvider = providerId;
    this.configTestedModels = null;
    const provider = this.configProviders?.find(p => p.id === providerId);
    if (!provider) return;

    document.getElementById('config-step-provider').style.display = 'none';
    document.getElementById('config-step-key').style.display = '';
    document.getElementById('config-save-btn').style.display = '';
    document.getElementById('config-models-section').style.display = 'none';
    document.getElementById('config-test-result').textContent = '';
    document.getElementById('config-test-result').className = 'text-caption text-tertiary mt-2';

    const icons = this.PROVIDER_ICONS;
    const header = document.getElementById('config-provider-header');
    if (header) {
      header.innerHTML = `<div class="provider-icon-lg">${icons[providerId] || '⚪'}</div>
        <div class="provider-detail"><h3>${escapeHtml(provider.name)}</h3>
        <p>${escapeHtml(provider.baseUrl)} · ${provider.models?.length || 0} models · ${provider.region === 'cn' ? '中国' : 'Global'}</p></div>`;
    }

    const keyInput = document.getElementById('config-api-key');
    if (keyInput) { keyInput.value = provider.apiKey || ''; keyInput.type = 'password'; }

    const signupLink = document.getElementById('config-signup-link');
    if (signupLink) {
      fetch('/hotspot/signup-urls').then(r => r.json()).then(j => {
        if (j.success && j.urls[providerId]) signupLink.href = j.urls[providerId];
      }).catch(() => {});
    }
  },

  configBackToProviders() {
    document.getElementById('config-step-provider').style.display = '';
    document.getElementById('config-step-key').style.display = 'none';
    document.getElementById('config-save-btn').style.display = 'none';
    this.configSelectedProvider = null;
  },

  configToggleKeyVisibility() {
    const input = document.getElementById('config-api-key');
    if (input) input.type = input.type === 'password' ? 'text' : 'password';
  },

  configTestConnection() {
    const providerId = this.configSelectedProvider;
    const apiKey = document.getElementById('config-api-key')?.value;
    if (!providerId || !apiKey) {
      this.toast(I18N.current === 'zh' ? '请输入 API Key' : 'Please enter API Key', 'warning');
      return;
    }
    const provider = this.configProviders?.find(p => p.id === providerId);
    const resultEl = document.getElementById('config-test-result');
    const testBtn = document.getElementById('config-test-btn');
    resultEl.textContent = I18N.current === 'zh' ? '⏳ 正在测试连接...' : '⏳ Testing...';
    resultEl.className = 'text-caption config-test-loading mt-2';
    if (testBtn) testBtn.disabled = true;

    fetch('/provider-config/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId, apiKey, baseUrl: provider?.baseUrl }),
    }).then(r => {
      if (r.status === 404) throw new Error('route_not_available');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(json => {
      if (testBtn) testBtn.disabled = false;
      if (json.success && json.modelCount > 0) {
        resultEl.textContent = (I18N.current === 'zh' ? `✅ 连接成功！发现 ${json.modelCount} 个模型 (${json.durationMs}ms)` : `✅ Connected! ${json.modelCount} models (${json.durationMs}ms)`);
        resultEl.className = 'text-caption config-test-success mt-2';
        this.configTestedModels = json.models;
        this.renderConfigModels(json.models);
      } else if (json.success) {
        resultEl.textContent = (I18N.current === 'zh' ? `✅ 连接成功 (${json.durationMs}ms)` : `✅ Connected (${json.durationMs}ms)`);
        resultEl.className = 'text-caption config-test-success mt-2';
      } else {
        resultEl.textContent = (I18N.current === 'zh' ? `❌ 失败: ${json.error || 'HTTP ' + json.httpStatus}` : `❌ Failed: ${json.error || 'HTTP ' + json.httpStatus}`);
        resultEl.className = 'text-caption config-test-error mt-2';
      }
    }).catch(e => {
      if (testBtn) testBtn.disabled = false;
      const prefix = e.message === 'route_not_available'
        ? (I18N.current === 'zh' ? '❌ 配置测试服务暂不可用' : '❌ Config test service unavailable')
        : (I18N.current === 'zh' ? '❌ ' : '❌ ');
      resultEl.textContent = prefix + (e.message !== 'route_not_available' ? ' ' + e.message : '');
      resultEl.className = 'text-caption config-test-error mt-2';
    });
  },

  renderConfigModels(models) {
    const section = document.getElementById('config-models-section');
    const list = document.getElementById('config-models-list');
    if (!section || !list) return;
    section.style.display = '';
    list.innerHTML = models.map(m => `<div class="config-model-item">
      <span class="model-id">${escapeHtml(typeof m === 'string' ? m : m.id || m.name || JSON.stringify(m))}</span>
      <span class="model-badge-free">FREE</span>
    </div>`).join('');
  },

  configSaveKey() {
    const providerId = this.configSelectedProvider;
    const apiKey = document.getElementById('config-api-key')?.value;
    if (!providerId || !apiKey) return;
    const saveBtn = document.getElementById('config-save-btn');
    if (saveBtn) saveBtn.disabled = true;
    const payload = { providerId, apiKey };
    if (this.configTestedModels?.length) payload.models = this.configTestedModels;

    fetch('/provider-config/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(r => {
      if (r.status === 404) throw new Error('route_not_available');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(json => {
      if (saveBtn) saveBtn.disabled = false;
      if (json.success) {
        this.toast(I18N.current === 'zh'
          ? `✅ ${providerId} 已保存！${json.totalProviders} 个提供商，${json.totalModels} 个模型`
          : `✅ ${providerId} saved! ${json.totalProviders} providers, ${json.totalModels} models`, 'success');
        if (this.configProviders) {
          const p = this.configProviders.find(p => p.id === providerId);
          if (p) { p.apiKey = apiKey; if (this.configTestedModels?.length) p.models = this.configTestedModels; }
        }
        this.updateModelCountBadge(json.totalProviders);
        this.renderProviderGrid(this.configProviders);
        this.initProviders();
        this.closeModelConfig();
      } else {
        this.toast((I18N.current === 'zh' ? '保存失败: ' : 'Save failed: ') + json.error, 'error');
      }
    }).catch(e => {
      if (saveBtn) saveBtn.disabled = false;
      const msg = e.message === 'route_not_available'
        ? (I18N.current === 'zh' ? '保存服务暂不可用' : 'Save service unavailable')
        : ((I18N.current === 'zh' ? '异常: ' : 'Error: ') + e.message);
      this.toast(msg, 'error');
    });
  },

  /* ── Real Action Handlers (replacing simulateAction) ── */
  saveCurrentState(btn) {
    // Save provider configuration to backend
    if (btn) btn.disabled = true;
    fetch('/provider-config/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providers: this.configProviders || [] }),
    }).then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(json => {
      if (btn) btn.disabled = false;
      if (json.success) {
        this.toast(I18N.current === 'zh' ? '✅ 配置已保存' : '✅ Configuration saved', 'success');
      } else {
        this.toast((I18N.current === 'zh' ? '保存失败: ' : 'Save failed: ') + json.error, 'error');
      }
    }).catch(e => {
      if (btn) btn.disabled = false;
      this.toast((I18N.current === 'zh' ? '异常: ' : 'Error: ') + e.message, 'error');
    });
  },

  exportBackup(btn) {
    // Export audit logs / backup data from backend
    if (btn) btn.disabled = true;
    fetch('/enterprise/audit/export?format=jsonl', {
      method: 'GET',
    }).then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.blob();
    }).then(blob => {
      if (btn) btn.disabled = false;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audit-export-' + new Date().toISOString().slice(0, 10) + '.jsonl';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      this.toast(I18N.current === 'zh' ? '✅ 审计日志已导出' : '✅ Audit logs exported', 'success');
    }).catch(e => {
      if (btn) btn.disabled = false;
      this.toast((I18N.current === 'zh' ? '导出失败: ' : 'Export failed: ') + e.message, 'error');
    });
  },

  importBackup(btn) {
    // Import backup file via file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.jsonl';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (btn) btn.disabled = true;
      const formData = new FormData();
      formData.append('backup', file);
      fetch('/enterprise/backup/restore', {
        method: 'POST',
        body: formData,
      }).then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(json => {
        if (btn) btn.disabled = false;
        if (json.success) {
          this.toast(I18N.current === 'zh' ? '✅ 备份已恢复' : '✅ Backup restored', 'success');
        } else {
          this.toast((I18N.current === 'zh' ? '恢复失败: ' : 'Restore failed: ') + json.error, 'error');
        }
      }).catch(e => {
        if (btn) btn.disabled = false;
        this.toast((I18N.current === 'zh' ? '异常: ' : 'Error: ') + e.message, 'error');
      });
    };
    input.click();
  },

  resetConfiguration(btn) {
    // Reset provider configuration to defaults
    if (btn) btn.disabled = true;
    fetch('/provider-config/reset', {
      method: 'POST',
    }).then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(json => {
      if (btn) btn.disabled = false;
      if (json.success) {
        this.toast(I18N.current === 'zh' ? '✅ 配置已重置' : '✅ Configuration reset', 'success');
        // Reload providers after reset
        this.initProviders();
      } else {
        this.toast((I18N.current === 'zh' ? '重置失败: ' : 'Reset failed: ') + json.error, 'error');
      }
    }).catch(e => {
      if (btn) btn.disabled = false;
      this.toast((I18N.current === 'zh' ? '异常: ' : 'Error: ') + e.message, 'error');
    });
  },

  clearKnowledgeBase(btn) {
    // Clear all knowledge base entries
    if (btn) btn.disabled = true;
    fetch('/knowledge/clear', {
      method: 'POST',
    }).then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(json => {
      if (btn) btn.disabled = false;
      if (json.success) {
        this.toast(I18N.current === 'zh' ? '✅ 知识库已清空' : '✅ Knowledge base cleared', 'success');
      } else {
        this.toast((I18N.current === 'zh' ? '清空失败: ' : 'Clear failed: ') + json.error, 'error');
      }
    }).catch(e => {
      if (btn) btn.disabled = false;
      this.toast((I18N.current === 'zh' ? '异常: ' : 'Error: ') + e.message, 'error');
    });
  },

  createWorkforcePlan(btn) {
    // Create workforce plan via POST /workforce/plan
    const goalInput = document.querySelector('#workforce-goal-input') || document.querySelector('input[placeholder*="goal"]');
    const goal = goalInput?.value?.trim();
    if (!goal) {
      this.toast(I18N.current === 'zh' ? '❌ 请输入任务目标' : '❌ Please enter a goal', 'error');
      return;
    }
    if (btn) btn.disabled = true;
    fetch('/workforce/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal }),
    }).then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(json => {
      if (btn) btn.disabled = false;
      if (json.plan) {
        this.toast(I18N.current === 'zh' ? '✅ 计划已生成' : '✅ Plan generated', 'success');
        // Render plan in UI if there's a plan container
        const planContainer = document.getElementById('workforce-plan-container');
        if (planContainer && json.plan.markdown) {
          planContainer.innerHTML = `<div class="plan-content">${json.plan.markdown}</div>`;
        }
      } else {
        this.toast((I18N.current === 'zh' ? '计划生成失败: ' : 'Plan generation failed: ') + json.error, 'error');
      }
    }).catch(e => {
      if (btn) btn.disabled = false;
      this.toast((I18N.current === 'zh' ? '异常: ' : 'Error: ') + e.message, 'error');
    });
  },

  testRagFunctionality(btn) {
    // Test RAG by sending a query to /knowledge/retrieve
    const testQuery = I18N.current === 'zh' ? '测试检索' : 'test retrieval';
    if (btn) btn.disabled = true;
    fetch('/knowledge/retrieve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: testQuery, topK: 3 }),
    }).then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(json => {
      if (btn) btn.disabled = false;
      if (json.hits && json.hits.length > 0) {
        this.toast(I18N.current === 'zh'
          ? `✅ RAG 测试成功！找到 ${json.hits.length} 条结果`
          : `✅ RAG test passed! Found ${json.hits.length} results`, 'success');
      } else {
        this.toast(I18N.current === 'zh' ? '⚠️ 未找到相关知识' : '⚠️ No relevant knowledge found', 'warning');
      }
    }).catch(e => {
      if (btn) btn.disabled = false;
      this.toast((I18N.current === 'zh' ? 'RAG 测试失败: ' : 'RAG test failed: ') + e.message, 'error');
    });
  },

  openModelConfig(preselectProvider) {
    const modal = document.getElementById('model-config-modal');
    if (!modal) { console.error('[Interact] modal #model-config-modal not found'); return; }
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    document.getElementById('config-step-provider').style.display = '';
    document.getElementById('config-step-key').style.display = 'none';
    document.getElementById('config-save-btn').style.display = 'none';
    if (preselectProvider) this.selectConfigProvider(preselectProvider);
  },

  closeModelConfig() {
    const modal = document.getElementById('model-config-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
  },

  /* ── Page Transition System ── */
  pageTransition: {
    overlay: null,

    init() {
      // Create overlay element
      this.overlay = document.createElement('div');
      this.overlay.className = 'page-transition-overlay';
      document.body.appendChild(this.overlay);

      // Add .page-content class to main content for reveal animation
      const main = document.querySelector('.main-content') || document.querySelector('main') || document.body;
      main.classList.add('page-content');

      // Intercept internal navigation for smooth transitions
      document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href]');
        if (!link) return;
        const href = link.getAttribute('href');
        // Only intercept same-origin .html links
        if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript')) return;
        if (!href.endsWith('.html') && href !== '/' && !href.startsWith('/')) return;

        e.preventDefault();
        this.navigate(href);
      });
    },

    navigate(url) {
      if (this.overlay) {
        this.overlay.classList.add('active');
        setTimeout(() => { window.location.href = url; }, 180);
      } else {
        window.location.href = url;
      }
    }
  },

  /* ── Scroll Reveal Observer ── */
  scrollReveal: {
    observer: null,

    init() {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            this.observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

      document.querySelectorAll('.reveal, .reveal-left').forEach(el => {
        this.observer.observe(el);
      });
    }
  },

  /* ── Number Count-Up Animation ── */
  animateNumber(element, target, options = {}) {
    const duration = options.duration || 800;
    const easing = options.easing || (t => 1 - Math.pow(1 - t, 3)); // ease-out cubic
    const prefix = options.prefix || '';
    const suffix = options.suffix || '';
    const decimals = options.decimals || 0;

    const start = parseFloat(element.textContent.replace(/[^0-9.-]/g, '')) || 0;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);
      const current = start + (target - start) * easedProgress;

      element.textContent = prefix + current.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + suffix;

      if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
  },

  /* ── Auto-animate elements with [data-animate-number] ── */
  initNumberAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseFloat(el.dataset.animateNumber);
          if (!isNaN(target)) {
            Interact.animateNumber(el, target, {
              prefix: el.dataset.prefix || '',
              suffix: el.dataset.suffix || '',
              decimals: parseInt(el.dataset.decimals) || 0,
              duration: parseInt(el.dataset.duration) || 800,
            });
          }
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.3 });

    document.querySelectorAll('[data-animate-number]').forEach(el => observer.observe(el));
  },

  /* ── Button Ripple Effect ── */
  initRipple() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-primary, .btn-secondary, [data-ripple]');
      if (!btn) return;

      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      const ripple = document.createElement('span');
      ripple.className = 'ripple-effect';
      ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;

      btn.style.position = btn.style.position || 'relative';
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 500);
    });
  },

  /* ── Safe API Fetch Helper ── */
  async safeFetch(url, options = {}) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeout || 8000);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn(`API ${url}: ${e.message}`);
      return null;
    }
  },

  /* ── Sidebar Collapse/Expand ── */
  sidebar: {
    collapsed: false,

    init() {
      const sidebar = document.querySelector('.nav-sidebar');
      if (!sidebar) return;

      // Create toggle button
      const toggle = document.createElement('button');
      toggle.className = 'sidebar-toggle';
      toggle.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
      toggle.addEventListener('click', () => this.toggle());
      sidebar.appendChild(toggle);
    },

    toggle() {
      this.collapsed = !this.collapsed;
      const sidebar = document.querySelector('.nav-sidebar');
      const main = document.querySelector('.main-content');
      if (sidebar) sidebar.classList.toggle('collapsed', this.collapsed);
      if (main) main.style.marginLeft = this.collapsed
        ? `calc(var(--sidebar-collapsed) + var(--space-4) + var(--space-4))`
        : '';
    }
  },

  /* ── Keyboard Shortcuts ── */
  shortcuts: {
    handlers: new Map(),

    init() {
      document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + K -> Command Palette
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
          e.preventDefault();
          this.fire('cmd-k');
        }
        // Escape -> Close modals/overlays
        if (e.key === 'Escape') {
          this.fire('escape');
          // Close any active modal
          document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
        }
      });
    },

    on(key, handler) { this.handlers.set(key, handler); },
    fire(key) { const h = this.handlers.get(key); if (h) h(); }
  },

  /* ── Initialize All ── */
  init() {
    const steps = [
      ['initTabs', () => this.initTabs()],
      ['initSearch', () => this.initSearch()],
      ['initReveal', () => this.initReveal()],
      ['initButtons', () => this.initButtons()],
      ['initProviders', () => this.initProviders()],
      ['initHotspot', () => this.initHotspot()],
      ['initModelConfig', () => this.initModelConfig()],
      // Premium features
      ['pageTransition', () => this.pageTransition.init()],
      ['scrollReveal', () => this.scrollReveal.init()],
      ['initNumberAnimations', () => this.initNumberAnimations()],
      ['initRipple', () => this.initRipple()],
      ['sidebar', () => this.sidebar.init()],
      ['shortcuts', () => this.shortcuts.init()],
    ];
    steps.forEach(([name, fn]) => {
      try { fn(); } catch (e) { console.error(`[Interact] ${name} failed:`, e); }
    });
  },
};

// Global convenience aliases
window.showToast = function(msg, type, dur) { return Interact.toast(msg, type, dur); };
window.safeFetch = Interact.safeFetch;

// Auto-init on DOM ready
document.addEventListener('DOMContentLoaded', () => Interact.init());
