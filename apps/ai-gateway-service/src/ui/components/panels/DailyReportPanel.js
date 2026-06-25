/**
 * Panel 1: DailyReportPanel — 日报面板
 * 聚合每日系统状态、信号卡、关键指标。
 */

export function renderDailyReportPanel() {
  return `
    <section class="v5-panel v5-panel-daily-report" id="panel-daily-report" data-panel-id="daily-report">
      <header class="v5-panel-header">
        <h2 class="v5-panel-title">今日日报</h2>
        <span class="v5-panel-subtitle" id="daily-report-date"></span>
      </header>
      <div class="v5-panel-body">
        <div class="v5-card-grid v5-card-grid-3">
          <article class="v5-info-card" id="daily-system-status">
            <div class="v5-info-card-icon">&#x1f7e2;</div>
            <div class="v5-info-card-content">
              <h3 class="v5-info-card-label">系统状态</h3>
              <p class="v5-info-card-value" id="daily-system-value">一切正常</p>
            </div>
          </article>
          <article class="v5-info-card" id="daily-task-count">
            <div class="v5-info-card-icon">&#x1f4cb;</div>
            <div class="v5-info-card-content">
              <h3 class="v5-info-card-label">今日任务</h3>
              <p class="v5-info-card-value" id="daily-task-value">--</p>
            </div>
          </article>
          <article class="v5-info-card" id="daily-pending">
            <div class="v5-info-card-icon">&#x23f3;</div>
            <div class="v5-info-card-content">
              <h3 class="v5-info-card-label">待处理</h3>
              <p class="v5-info-card-value" id="daily-pending-value">--</p>
            </div>
          </article>
        </div>
        <div class="v5-section" id="daily-signal-list">
          <h3 class="v5-section-title">关键信号</h3>
          <ul class="v5-signal-list" id="daily-signals">
            <li class="v5-signal-item v5-signal-ok">
              <span class="v5-signal-dot"></span>
              <span class="v5-signal-text">系统运行正常，无异常告警</span>
            </li>
          </ul>
        </div>
        <div class="v5-section" id="daily-summary-section">
          <h3 class="v5-section-title">今日摘要</h3>
          <p class="v5-summary-text" id="daily-summary-text">加载中...</p>
        </div>
      </div>
    </section>`;
}
