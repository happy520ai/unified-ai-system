/**
 * Panel 2: ApprovalPanel — 审批面板
 * 展示待审批事项、自动化命令卡片。
 */

export function renderApprovalPanel() {
  return `
    <section class="v5-panel v5-panel-approval" id="panel-approval" data-panel-id="approval">
      <header class="v5-panel-header">
        <h2 class="v5-panel-title">待审批</h2>
        <span class="v5-panel-badge" id="approval-count-badge">0</span>
      </header>
      <div class="v5-panel-body">
        <div class="v5-section" id="approval-pending-section">
          <h3 class="v5-section-title">等你确认</h3>
          <div class="v5-approval-list" id="approval-list">
            <div class="v5-empty-state" id="approval-empty">
              <p>当前没有待审批事项</p>
            </div>
          </div>
        </div>
        <div class="v5-section" id="approval-recent-section">
          <h3 class="v5-section-title">最近处理</h3>
          <ul class="v5-history-list" id="approval-recent-list">
            <li class="v5-history-item">
              <span class="v5-history-status v5-status-done">&#x2713;</span>
              <span class="v5-history-text">暂无记录</span>
            </li>
          </ul>
        </div>
      </div>
    </section>`;
}
