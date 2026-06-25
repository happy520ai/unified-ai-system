/**
 * Panel 4: MonitoringPanel — 系统监控面板
 * 聚合健康指标、运行时间、资源使用率。
 */

export function renderMonitoringPanel() {
  return `
    <section class="v5-panel v5-panel-monitoring" id="panel-monitoring" data-panel-id="monitoring">
      <header class="v5-panel-header">
        <h2 class="v5-panel-title">系统监控</h2>
        <span class="v5-panel-subtitle" id="monitoring-last-update">最近更新: --</span>
      </header>
      <div class="v5-panel-body">
        <div class="v5-card-grid v5-card-grid-4">
          <article class="v5-metric-card" id="metric-health">
            <div class="v5-metric-indicator v5-indicator-ok" id="health-indicator"></div>
            <div class="v5-metric-content">
              <h3 class="v5-metric-label">健康状态</h3>
              <p class="v5-metric-value" id="health-value">正常</p>
            </div>
          </article>
          <article class="v5-metric-card" id="metric-uptime">
            <div class="v5-metric-indicator v5-indicator-info"></div>
            <div class="v5-metric-content">
              <h3 class="v5-metric-label">运行时间</h3>
              <p class="v5-metric-value" id="uptime-value">--</p>
            </div>
          </article>
          <article class="v5-metric-card" id="metric-memory">
            <div class="v5-metric-indicator v5-indicator-info"></div>
            <div class="v5-metric-content">
              <h3 class="v5-metric-label">内存使用</h3>
              <p class="v5-metric-value" id="memory-value">--</p>
            </div>
          </article>
          <article class="v5-metric-card" id="metric-requests">
            <div class="v5-metric-indicator v5-indicator-info"></div>
            <div class="v5-metric-content">
              <h3 class="v5-metric-label">今日请求</h3>
              <p class="v5-metric-value" id="requests-value">--</p>
            </div>
          </article>
        </div>
        <div class="v5-section" id="monitoring-services-section">
          <h3 class="v5-section-title">服务状态</h3>
          <div class="v5-service-list" id="monitoring-service-list">
            <div class="v5-service-row">
              <span class="v5-service-name">AI Gateway</span>
              <span class="v5-service-status v5-status-ok" id="service-gateway-status">运行中</span>
            </div>
            <div class="v5-service-row">
              <span class="v5-service-name">知识库</span>
              <span class="v5-service-status v5-status-ok" id="service-knowledge-status">运行中</span>
            </div>
            <div class="v5-service-row">
              <span class="v5-service-name">模型服务</span>
              <span class="v5-service-status v5-status-ok" id="service-model-status">运行中</span>
            </div>
          </div>
        </div>
      </div>
    </section>`;
}
