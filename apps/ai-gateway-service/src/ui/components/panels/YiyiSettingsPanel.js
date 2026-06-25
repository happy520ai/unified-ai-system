/**
 * Panel 10: YiyiSettingsPanel — 依依设置面板
 * 展示人格配置、话术风格、交互偏好。
 */

export function renderYiyiSettingsPanel() {
  return `
    <section class="v5-panel v5-panel-yiyi-settings" id="panel-yiyi-settings" data-panel-id="yiyi-settings">
      <header class="v5-panel-header">
        <h2 class="v5-panel-title">依依设置</h2>
      </header>
      <div class="v5-panel-body">
        <div class="v5-card-grid v5-card-grid-2">
          <article class="v5-info-card" id="yiyi-persona">
            <div class="v5-info-card-icon">&#x1f464;</div>
            <div class="v5-info-card-content">
              <h3 class="v5-info-card-label">人格风格</h3>
              <p class="v5-info-card-value" id="yiyi-persona-value">默认</p>
            </div>
          </article>
          <article class="v5-info-card" id="yiyi-tone">
            <div class="v5-info-card-icon">&#x1f3b5;</div>
            <div class="v5-info-card-content">
              <h3 class="v5-info-card-label">话术风格</h3>
              <p class="v5-info-card-value" id="yiyi-tone-value">简洁专业</p>
            </div>
          </article>
        </div>
        <div class="v5-section" id="yiyi-preferences-section">
          <h3 class="v5-section-title">交互偏好</h3>
          <div class="v5-preference-list" id="yiyi-preferences">
            <div class="v5-preference-item">
              <span class="v5-preference-label">问候方式</span>
              <span class="v5-preference-value" id="yiyi-greeting-pref">按时段</span>
            </div>
            <div class="v5-preference-item">
              <span class="v5-preference-label">回复长度</span>
              <span class="v5-preference-value" id="yiyi-length-pref">适中</span>
            </div>
            <div class="v5-preference-item">
              <span class="v5-preference-label">术语过滤</span>
              <span class="v5-preference-value" id="yiyi-filter-pref">已开启</span>
            </div>
            <div class="v5-preference-item">
              <span class="v5-preference-label">自动建议</span>
              <span class="v5-preference-value" id="yiyi-suggest-pref">已开启</span>
            </div>
          </div>
        </div>
        <div class="v5-section" id="yiyi-forbidden-section">
          <h3 class="v5-section-title">术语守卫</h3>
          <p class="v5-section-desc">以下术语不会出现在第一屏对话中，已自动替换为中文表达。</p>
          <div class="v5-tag-list" id="yiyi-forbidden-tags">
            <span class="v5-tag">Provider</span>
            <span class="v5-tag">God Mode</span>
            <span class="v5-tag">Token</span>
            <span class="v5-tag">endpoint</span>
            <span class="v5-tag">dry-run</span>
          </div>
        </div>
      </div>
    </section>`;
}
