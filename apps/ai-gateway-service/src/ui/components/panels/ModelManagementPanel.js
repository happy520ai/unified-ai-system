/**
 * Panel 5: ModelManagementPanel — 模型管理面板
 * 展示模型库、路由状态、质量概览。
 */

export function renderModelManagementPanel() {
  return `
    <section class="v5-panel v5-panel-model-management" id="panel-model-management" data-panel-id="model-management">
      <header class="v5-panel-header">
        <h2 class="v5-panel-title">模型管理</h2>
        <span class="v5-panel-subtitle" id="model-count-label">-- 个模型</span>
      </header>
      <div class="v5-panel-body">
        <div class="v5-card-grid v5-card-grid-3">
          <article class="v5-info-card" id="model-active">
            <div class="v5-info-card-icon">&#x1f916;</div>
            <div class="v5-info-card-content">
              <h3 class="v5-info-card-label">当前使用</h3>
              <p class="v5-info-card-value" id="model-active-name">--</p>
            </div>
          </article>
          <article class="v5-info-card" id="model-provider">
            <div class="v5-info-card-icon">&#x1f310;</div>
            <div class="v5-info-card-content">
              <h3 class="v5-info-card-label">当前供应商</h3>
              <p class="v5-info-card-value" id="model-provider-name">--</p>
            </div>
          </article>
          <article class="v5-info-card" id="model-route-mode">
            <div class="v5-info-card-icon">&#x1f500;</div>
            <div class="v5-info-card-content">
              <h3 class="v5-info-card-label">路由模式</h3>
              <p class="v5-info-card-value" id="model-route-value">固定</p>
            </div>
          </article>
        </div>
        <div class="v5-section" id="model-list-section">
          <h3 class="v5-section-title">模型列表</h3>
          <div class="v5-model-list" id="model-list">
            <div class="v5-empty-state" id="model-list-empty">
              <p>模型数据加载中...</p>
            </div>
          </div>
        </div>
      </div>
    </section>`;
}
