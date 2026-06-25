/**
 * Panel 6: ProviderConfigPanel — 运行配置面板
 * 展示 Provider 状态、密钥配置、适配器信息。
 */

export function renderProviderConfigPanel() {
  return `
    <section class="v5-panel v5-panel-provider-config" id="panel-provider-config" data-panel-id="provider-config">
      <header class="v5-panel-header">
        <h2 class="v5-panel-title">运行配置</h2>
      </header>
      <div class="v5-panel-body">
        <div class="v5-card-grid v5-card-grid-2">
          <article class="v5-info-card" id="config-provider-status">
            <div class="v5-info-card-icon">&#x1f511;</div>
            <div class="v5-info-card-content">
              <h3 class="v5-info-card-label">供应商状态</h3>
              <p class="v5-info-card-value" id="config-provider-value">--</p>
            </div>
          </article>
          <article class="v5-info-card" id="config-key-status">
            <div class="v5-info-card-icon">&#x1f512;</div>
            <div class="v5-info-card-content">
              <h3 class="v5-info-card-label">密钥配置</h3>
              <p class="v5-info-card-value" id="config-key-value">--</p>
            </div>
          </article>
        </div>
        <div class="v5-section" id="config-details-section">
          <h3 class="v5-section-title">配置详情</h3>
          <div class="v5-config-table" id="config-table">
            <div class="v5-config-row">
              <span class="v5-config-key">运行模式</span>
              <span class="v5-config-val" id="config-mode-value">--</span>
            </div>
            <div class="v5-config-row">
              <span class="v5-config-key">路由策略</span>
              <span class="v5-config-val" id="config-route-value">--</span>
            </div>
            <div class="v5-config-row">
              <span class="v5-config-key">默认供应商</span>
              <span class="v5-config-val" id="config-default-provider">--</span>
            </div>
            <div class="v5-config-row">
              <span class="v5-config-key">适配器版本</span>
              <span class="v5-config-val" id="config-adapter-version">--</span>
            </div>
          </div>
        </div>
      </div>
    </section>`;
}
