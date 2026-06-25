/**
 * Helper functions for ForgeDashboard.
 * Extracted pure functions, formatters, and section generators.
 */

// Import CSS/JS generators from separate module to keep this file under 500 lines
import { generateCSS, generateJS } from './render-helpers.js';

// Re-export for backward compatibility
export { generateCSS, generateJS };

// ── HTML Generation Helpers ─────────────────────────────────────────────────

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str - input string
 * @returns {string} escaped string
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Format a timestamp into a short human-readable string.
 * @param {string|number} ts - ISO string or epoch ms
 * @returns {string} formatted time
 */
export function formatTime(ts) {
  if (!ts) return '--';
  const d = typeof ts === 'string' ? new Date(ts) : new Date(ts);
  if (isNaN(d.getTime())) return '--';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return hh + ':' + mm + ':' + ss;
}

/**
 * Format milliseconds into a human-readable duration.
 * @param {number} ms - duration in milliseconds
 * @returns {string} formatted duration
 */
export function formatDuration(ms) {
  if (ms == null || ms < 0) return '--';
  if (ms < 1000) return ms + 'ms';
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return m + 'm ' + rs + 's';
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return h + 'h ' + rm + 'm';
}

/**
 * Format a currency amount.
 * @param {number} amount - dollar amount
 * @returns {string} formatted cost
 */
export function formatCost(amount) {
  if (amount == null) return '$0.00';
  return '$' + Number(amount).toFixed(4);
}

// ── Section Generators ──────────────────────────────────────────────────────

/**
 * Generate the Goals Overview card HTML.
 * @param {object} data - dashboard data
 * @returns {string} HTML fragment
 */
export function renderGoalsOverview(data) {
  const goals = data.goals || [];
  const active = goals.filter(g => g.status === 'running' || g.status === 'compiled').length;
  const completed = goals.filter(g => g.status === 'completed').length;
  const failed = goals.filter(g => g.status === 'failed').length;

  let listHtml = '';
  const recent = goals.slice(0, 10);
  if (recent.length === 0) {
    listHtml = '<div class="empty-state">No goals recorded yet.</div>';
  } else {
    for (const g of recent) {
      const dotClass = g.status === 'completed' ? 'completed'
        : g.status === 'running' ? 'running'
          : g.status === 'failed' ? 'failed' : 'pending';
      listHtml += '<div class="goal-item">'
        + '<span class="dot ' + dotClass + '"></span>'
        + '<span class="goal-text">' + escapeHtml(g.text || g.id) + '</span>'
        + '<span class="goal-time">' + formatTime(g.created_at) + '</span>'
        + '</div>';
    }
  }

  return '<div class="card">'
    + '<h2>Goals Overview</h2>'
    + '<div class="stat-row">'
    + '<div class="stat info"><div class="value" id="count-active">' + active + '</div><div class="label">Active</div></div>'
    + '<div class="stat success"><div class="value" id="count-completed">' + completed + '</div><div class="label">Completed</div></div>'
    + '<div class="stat error"><div class="value" id="count-failed">' + failed + '</div><div class="label">Failed</div></div>'
    + '</div>'
    + listHtml
    + '</div>';
}

/**
 * Generate the Active Goal Detail card HTML.
 * @param {object} data - dashboard data
 * @returns {string} HTML fragment
 */
export function renderActiveGoal(data) {
  const active = (data.goals || []).find(
    g => g.status === 'running' || g.status === 'compiled',
  );

  if (!active) {
    return '<div class="card">'
      + '<h2>Active Goal</h2>'
      + '<div class="empty-state">No active goal. Submit a goal to begin.</div>'
      + '</div>';
  }

  const taskCount = active.totalTasks || 0;
  const completedTasks = active.completedTasks || 0;
  const pct = taskCount > 0 ? Math.round((completedTasks / taskCount) * 100) : 0;
  const currentTask = active.currentTask || '--';
  const phase = active.phase || 'execution';

  let etaStr = '--';
  if (active.startedAt && completedTasks > 0 && taskCount > completedTasks) {
    const elapsed = Date.now() - new Date(active.startedAt).getTime();
    const avgPerTask = elapsed / completedTasks;
    const remaining = taskCount - completedTasks;
    etaStr = formatDuration(remaining * avgPerTask);
  }

  return '<div class="card">'
    + '<h2>Active Goal</h2>'
    + '<div style="margin-bottom:8px;font-weight:600;">' + escapeHtml(active.text || active.id) + '</div>'
    + '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">'
    + 'Phase: <strong>' + escapeHtml(phase) + '</strong> &middot; '
    + 'Task: <strong>' + escapeHtml(currentTask) + '</strong>'
    + '</div>'
    + '<div class="progress-bar-outer"><div class="progress-bar-inner" style="width:' + pct + '%;"></div></div>'
    + '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-secondary);">'
    + '<span>' + completedTasks + ' / ' + taskCount + ' tasks</span>'
    + '<span>' + pct + '% &middot; ETA: ' + etaStr + '</span>'
    + '</div>'
    + '</div>';
}

/**
 * Generate the Agent Pool card HTML.
 * @param {object} data - dashboard data
 * @returns {string} HTML fragment
 */
export function renderPool(data) {
  const pool = data.pool || {};
  const workerCount = pool.workerCount || 0;
  const activeWorkers = pool.activeWorkers || 0;
  const queueDepth = pool.queueDepth || 0;
  const maxConcurrent = pool.maxConcurrent || 0;
  const workers = pool.workers || [];

  let tableHtml = '';
  if (workers.length > 0) {
    tableHtml = '<table><thead><tr><th>Worker</th><th>Status</th><th>Goal</th><th>Task</th></tr></thead><tbody>';
    for (const w of workers.slice(0, 8)) {
      tableHtml += '<tr>'
        + '<td>' + escapeHtml(w.id || '--') + '</td>'
        + '<td><span class="badge ' + (w.status === 'busy' ? 'degraded' : 'healthy') + '">' + escapeHtml(w.status || 'idle') + '</span></td>'
        + '<td>' + escapeHtml(w.goalId || '--') + '</td>'
        + '<td>' + escapeHtml(w.taskName || '--') + '</td>'
        + '</tr>';
    }
    tableHtml += '</tbody></table>';
  } else {
    tableHtml = '<div class="empty-state">No workers active.</div>';
  }

  return '<div class="card">'
    + '<h2>Agent Pool</h2>'
    + '<div class="stat-row">'
    + '<div class="stat info"><div class="value">' + workerCount + '</div><div class="label">Workers</div></div>'
    + '<div class="stat warning"><div class="value">' + activeWorkers + '</div><div class="label">Active</div></div>'
    + '<div class="stat"><div class="value">' + queueDepth + '</div><div class="label">Queued</div></div>'
    + '<div class="stat"><div class="value">' + maxConcurrent + '</div><div class="label">Max Concurrent</div></div>'
    + '</div>'
    + tableHtml
    + '</div>';
}

/**
 * Generate the Performance card HTML with a CSS-only bar chart.
 * @param {object} data - dashboard data
 * @returns {string} HTML fragment
 */
export function renderPerformance(data) {
  const analytics = data.analytics || {};
  const successRate = analytics.successRate != null
    ? Math.round(analytics.successRate * 100) : 0;
  const avgDuration = analytics.avgDurationMs != null
    ? formatDuration(analytics.avgDurationMs) : '--';
  const throughput = analytics.throughput != null
    ? analytics.throughput.toFixed(1) : '0.0';
  const series = analytics.throughputSeries || [];

  // Build bar chart from throughput series
  let barsHtml = '';
  if (series.length > 0) {
    const maxVal = Math.max(...series.map(s => s.value), 1);
    for (const s of series.slice(-12)) {
      const h = Math.max(2, Math.round((s.value / maxVal) * 56));
      barsHtml += '<div class="bar" style="height:' + h + 'px;" title="'
        + escapeHtml(s.label || '') + ': ' + s.value + '">'
        + '<span class="bar-label">' + escapeHtml(s.label || '') + '</span>'
        + '</div>';
    }
  }

  return '<div class="card">'
    + '<h2>Performance</h2>'
    + '<div class="stat-row">'
    + '<div class="stat success"><div class="value">' + successRate + '%</div><div class="label">Success Rate</div></div>'
    + '<div class="stat info"><div class="value">' + avgDuration + '</div><div class="label">Avg Duration</div></div>'
    + '<div class="stat"><div class="value">' + throughput + '</div><div class="label">Goals/min</div></div>'
    + '</div>'
    + (barsHtml ? '<div class="bar-chart">' + barsHtml + '</div>' : '')
    + '</div>';
}

/**
 * Generate the Cost card HTML.
 * @param {object} data - dashboard data
 * @returns {string} HTML fragment
 */
export function renderCost(data) {
  const cost = data.cost || {};
  const totalSpend = cost.totalSpend != null ? cost.totalSpend : 0;
  const budgetMax = cost.budgetMax != null ? cost.budgetMax : 0;
  const remaining = budgetMax > 0 ? Math.max(0, budgetMax - totalSpend) : 0;
  const costPerGoal = cost.costPerGoal != null ? cost.costPerGoal : 0;
  const tokensUsed = cost.tokensUsed != null ? cost.tokensUsed : 0;
  const pctUsed = budgetMax > 0 ? Math.min(100, Math.round((totalSpend / budgetMax) * 100)) : 0;

  return '<div class="card">'
    + '<h2>Cost &amp; Budget</h2>'
    + '<div class="stat-row">'
    + '<div class="stat warning"><div class="value">' + formatCost(totalSpend) + '</div><div class="label">Total Spend</div></div>'
    + '<div class="stat success"><div class="value">' + formatCost(remaining) + '</div><div class="label">Remaining</div></div>'
    + '<div class="stat"><div class="value">' + formatCost(costPerGoal) + '</div><div class="label">Per Goal</div></div>'
    + '</div>'
    + '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;">'
    + 'Tokens: ' + tokensUsed.toLocaleString()
    + (budgetMax > 0 ? ' &middot; Budget: ' + formatCost(budgetMax) : '')
    + '</div>'
    + (budgetMax > 0
      ? '<div class="progress-bar-outer"><div class="progress-bar-inner" style="width:' + pctUsed + '%;background:' + (pctUsed > 80 ? 'var(--warning)' : 'var(--success)') + ';"></div></div>'
        + '<div style="font-size:11px;color:var(--text-secondary);">' + pctUsed + '% of budget used</div>'
      : '')
    + '</div>';
}

/**
 * Generate the Health card HTML with module health grid.
 * @param {object} data - dashboard data
 * @returns {string} HTML fragment
 */
export function renderHealth(data) {
  const health = data.health || {};
  const modules = health.modules || {};
  const alerts = health.alerts || [];
  const overall = health.overall || 'healthy';

  let gridHtml = '';
  const moduleNames = Object.keys(modules);
  if (moduleNames.length === 0) {
    gridHtml = '<div class="empty-state">No modules registered.</div>';
  } else {
    gridHtml = '<div class="health-grid">';
    for (const name of moduleNames) {
      const mod = modules[name];
      const st = mod.status || 'healthy';
      gridHtml += '<div class="health-cell ' + st + '">'
        + '<div>' + escapeHtml(name) + '</div>'
        + '<div class="cell-name">' + escapeHtml(st) + '</div>'
        + '</div>';
    }
    gridHtml += '</div>';
  }

  let alertsHtml = '';
  if (alerts.length > 0) {
    alertsHtml = '<div style="margin-top:10px;">';
    for (const a of alerts.slice(0, 5)) {
      const cls = a.level === 'critical' || a.level === 'error' ? 'error'
        : a.level === 'warning' ? 'warning' : 'info';
      alertsHtml += '<div style="font-size:12px;padding:2px 0;color:var(--' + cls + ');">'
        + escapeHtml(a.level ? a.level.toUpperCase() : 'INFO') + ': '
        + escapeHtml(a.message || '')
        + '</div>';
    }
    alertsHtml += '</div>';
  }

  return '<div class="card">'
    + '<h2>System Health <span class="badge ' + overall + '" style="margin-left:8px;">' + overall + '</span></h2>'
    + gridHtml
    + alertsHtml
    + '</div>';
}

/**
 * Generate the Activity Log card HTML.
 * @param {object} data - dashboard data
 * @returns {string} HTML fragment
 */
export function renderActivityLog(data) {
  const events = data.events || [];

  if (events.length === 0) {
    return '<div class="card full-width">'
      + '<h2>Activity Log</h2>'
      + '<div class="empty-state">No recent activity.</div>'
      + '</div>';
  }

  let itemsHtml = '';
  for (const evt of events.slice(0, 20)) {
    const typeColor = (evt.event_type || '').includes('error') || (evt.event_type || '').includes('fail')
      ? 'var(--error)'
      : (evt.event_type || '').includes('complet')
        ? 'var(--success)'
        : (evt.event_type || '').includes('start')
          ? '#64b5f6'
          : 'var(--text-secondary)';
    itemsHtml += '<div class="event-item">'
      + '<span class="event-time">' + formatTime(evt.created_at || evt.timestamp) + '</span>'
      + '<span class="event-type" style="color:' + typeColor + ';">' + escapeHtml(evt.event_type || 'event') + '</span>'
      + '<span class="event-msg">' + escapeHtml(evt.message || evt.task_id || '') + '</span>'
      + '</div>';
  }

  return '<div class="card full-width">'
    + '<h2>Activity Log</h2>'
    + itemsHtml
    + '</div>';
}
