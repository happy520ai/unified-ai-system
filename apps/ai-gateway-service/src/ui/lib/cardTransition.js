/**
 * v5 Card Transition — 客户端卡片过渡动画引擎
 * 导出注入 <script> 的客户端 JS 字符串。
 *
 * 核心功能：
 * - expandChipToPanel(chipEl): 从芯片位置展开到全屏面板
 * - collapsePanelToChip(): 从面板收缩回芯片位置
 *
 * 注意：本文件导出的字符串会被嵌入 HTML 的 <script> 标签中，
 * 内部的 \" 在模板字面量中会变成 "，因此需要 \\" 来产生正确的转义。
 */

export const cardTransitionClientJs = `
(function() {
  var _panelState = { active: null };

  /**
   * 从芯片元素位置展开面板
   * @param {HTMLElement} chipEl - 被点击的芯片元素
   * @param {string} [panelId] - 面板ID，从panel store中加载内容
   */
  function expandChipToPanel(chipEl, panelId) {
    if (_panelState.active) collapsePanelToChip();
    var rect = chipEl.getBoundingClientRect();

    // Load panel content from panel store
    var panelHtml = '';
    if (panelId) {
      var panelContainer = document.querySelector('[data-v5-panel-id="' + panelId + '"]');
      if (panelContainer) {
        var panelInner = panelContainer.querySelector('.v5-panel');
        if (panelInner) {
          panelHtml = panelInner.outerHTML;
        }
      }
    }

    if (!panelHtml) {
      panelHtml =
        '<div style=\\\"padding:20px;text-align:center;color:#888888;font-size:14px;\\\">' +
        '<div style=\\\"font-size:28px;margin-bottom:12px;\\\">\\u{1F6E0}</div>' +
        '<div>\\u9762\\u677F\\u5185\\u5BB9\\u52A0\\u8F7D\\u4E2D\\u2026</div></div>';
    }

    var overlay = document.createElement('div');
    overlay.className = 'card-transition-overlay';
    overlay.style.cssText =
      'position:fixed;z-index:9999;pointer-events:auto;' +
      'left:' + rect.left + 'px;top:' + rect.top + 'px;' +
      'width:' + rect.width + 'px;height:' + rect.height + 'px;' +
      'border-radius:20px;background:#ffffff;' +
      'box-shadow:0 8px 32px rgba(0,0,0,0.12);' +
      'transition:left 300ms cubic-bezier(0.4,0,0.2,1),top 300ms cubic-bezier(0.4,0,0.2,1),width 300ms cubic-bezier(0.4,0,0.2,1),height 300ms cubic-bezier(0.4,0,0.2,1),border-radius 300ms cubic-bezier(0.4,0,0.2,1),transform 300ms cubic-bezier(0.4,0,0.2,1);' +
      'will-change:transform,width,height,top,left,border-radius;overflow:hidden;';
    overlay.innerHTML =
      '<button class=\\\"card-transition-close\\\" style=\\\"position:absolute;top:16px;right:16px;z-index:10;' +
      'width:36px;height:36px;border-radius:50%;border:none;background:rgba(0,0,0,0.06);' +
      'font-size:18px;cursor:pointer;color:#6e6e6e;display:flex;align-items:center;justify-content:center;\\\" ' +
      'aria-label=\\\"\\u5173\\u95ED\\\">\\u2715</button>' +
      '<div class=\\\"panel-content\\\" style=\\\"opacity:0;transition:opacity 200ms ease 100ms;height:100%;overflow:auto;\\\">' +
      panelHtml + '</div>';
    document.body.appendChild(overlay);

    // Close button handler
    var closeBtn = overlay.querySelector('.card-transition-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() { collapsePanelToChip(); });
    }

    requestAnimationFrame(function() {
      overlay.style.left = '0';
      overlay.style.top = '0';
      overlay.style.width = '100vw';
      overlay.style.height = '100vh';
      overlay.style.borderRadius = '0';
      overlay.classList.add('is-expanded');
      var pc = overlay.querySelector('.panel-content');
      if (pc) pc.style.opacity = '1';
    });
    _panelState.active = { overlay: overlay, trigger: chipEl };
  }

  /**
   * 将当前展开的面板收缩回原始芯片位置
   */
  function collapsePanelToChip() {
    if (!_panelState.active) return;
    var st = _panelState.active;
    var triggerRect = st.trigger.getBoundingClientRect();
    var pc = st.overlay.querySelector('.panel-content');
    if (pc) pc.style.opacity = '0';
    setTimeout(function() {
      st.overlay.style.left = triggerRect.left + 'px';
      st.overlay.style.top = triggerRect.top + 'px';
      st.overlay.style.width = triggerRect.width + 'px';
      st.overlay.style.height = triggerRect.height + 'px';
      st.overlay.style.borderRadius = '20px';
      st.overlay.classList.remove('is-expanded');
    }, 50);
    setTimeout(function() {
      if (st.overlay.parentNode) st.overlay.parentNode.removeChild(st.overlay);
      _panelState.active = null;
    }, 400);
  }

  // 暴露到全局
  window.__v5CardTransition = {
    expand: function(chipEl, panelId) { return expandChipToPanel(chipEl, panelId); },
    collapse: collapsePanelToChip,
    isActive: function() { return !!_panelState.active; }
  };

  // Escape 键关闭面板
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && _panelState.active) {
      collapsePanelToChip();
    }
  });
})();
`;
