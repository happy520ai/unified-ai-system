/**
 * Panel 7: WorkforceManagementPanel — 员工管理面板
 * 展示员工金字塔、能力激活、岗位配置。
 */

export function renderWorkforceManagementPanel() {
  return `
    <section class="v5-panel v5-panel-workforce-management" id="panel-workforce-management" data-panel-id="workforce-management">
      <header class="v5-panel-header">
        <h2 class="v5-panel-title">员工管理</h2>
      </header>
      <div class="v5-panel-body">
        <div class="v5-card-grid v5-card-grid-3">
          <article class="v5-stat-card">
            <span class="v5-stat-number" id="wm-total-agents">--</span>
            <span class="v5-stat-label">总员工数</span>
          </article>
          <article class="v5-stat-card">
            <span class="v5-stat-number" id="wm-active-agents">--</span>
            <span class="v5-stat-label">激活中</span>
          </article>
          <article class="v5-stat-card">
            <span class="v5-stat-number" id="wm-capability-count">--</span>
            <span class="v5-stat-label">能力项</span>
          </article>
        </div>
        <div class="v5-section" id="wm-pyramid-section">
          <h3 class="v5-section-title">员工层级</h3>
          <div class="v5-pyramid" id="wm-pyramid">
            <div class="v5-pyramid-level" data-level="L6">
              <span class="v5-pyramid-label">L6 战略</span>
              <span class="v5-pyramid-bar"></span>
            </div>
            <div class="v5-pyramid-level" data-level="L5">
              <span class="v5-pyramid-label">L5 架构</span>
              <span class="v5-pyramid-bar"></span>
            </div>
            <div class="v5-pyramid-level" data-level="L4">
              <span class="v5-pyramid-label">L4 实施</span>
              <span class="v5-pyramid-bar"></span>
            </div>
            <div class="v5-pyramid-level" data-level="L3">
              <span class="v5-pyramid-label">L3 执行</span>
              <span class="v5-pyramid-bar"></span>
            </div>
            <div class="v5-pyramid-level" data-level="L2">
              <span class="v5-pyramid-label">L2 基础</span>
              <span class="v5-pyramid-bar"></span>
            </div>
            <div class="v5-pyramid-level" data-level="L1">
              <span class="v5-pyramid-label">L1 入门</span>
              <span class="v5-pyramid-bar"></span>
            </div>
          </div>
        </div>
        <div class="v5-section" id="wm-capability-section">
          <h3 class="v5-section-title">五大能力</h3>
          <div class="v5-capability-list" id="wm-capabilities">
            <div class="v5-capability-item">
              <span class="v5-capability-name">规划分析</span>
              <span class="v5-capability-status" id="cap-planning">--</span>
            </div>
            <div class="v5-capability-item">
              <span class="v5-capability-name">代码生成</span>
              <span class="v5-capability-status" id="cap-coding">--</span>
            </div>
            <div class="v5-capability-item">
              <span class="v5-capability-name">知识检索</span>
              <span class="v5-capability-status" id="cap-knowledge">--</span>
            </div>
            <div class="v5-capability-item">
              <span class="v5-capability-name">质量审查</span>
              <span class="v5-capability-status" id="cap-review">--</span>
            </div>
            <div class="v5-capability-item">
              <span class="v5-capability-name">安全审计</span>
              <span class="v5-capability-status" id="cap-security">--</span>
            </div>
          </div>
        </div>
      </div>
    </section>`;
}
