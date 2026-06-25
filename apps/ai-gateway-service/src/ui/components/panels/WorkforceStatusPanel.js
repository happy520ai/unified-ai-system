/**
 * Panel 3: WorkforceStatusPanel — 员工状态面板
 * 展示当前员工运行状态、任务分配。
 */

export function renderWorkforceStatusPanel() {
  return `
    <section class="v5-panel v5-panel-workforce-status" id="panel-workforce-status" data-panel-id="workforce-status">
      <header class="v5-panel-header">
        <h2 class="v5-panel-title">员工状态</h2>
        <span class="v5-panel-subtitle" id="workforce-active-count">-- 在线</span>
      </header>
      <div class="v5-panel-body">
        <div class="v5-card-grid v5-card-grid-2">
          <article class="v5-stat-card">
            <span class="v5-stat-number" id="workforce-active">0</span>
            <span class="v5-stat-label">运行中</span>
          </article>
          <article class="v5-stat-card">
            <span class="v5-stat-number" id="workforce-idle">0</span>
            <span class="v5-stat-label">待命</span>
          </article>
          <article class="v5-stat-card">
            <span class="v5-stat-number" id="workforce-busy">0</span>
            <span class="v5-stat-label">繁忙</span>
          </article>
          <article class="v5-stat-card">
            <span class="v5-stat-number" id="workforce-offline">0</span>
            <span class="v5-stat-label">离线</span>
          </article>
        </div>
        <div class="v5-section" id="workforce-activity-section">
          <h3 class="v5-section-title">最近活动</h3>
          <ul class="v5-activity-list" id="workforce-activity-list">
            <li class="v5-activity-item">
              <span class="v5-activity-time">--:--</span>
              <span class="v5-activity-text">暂无活动</span>
            </li>
          </ul>
        </div>
      </div>
    </section>`;
}
