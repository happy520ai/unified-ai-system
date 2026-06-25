/**
 * CSS and JavaScript asset generators for ForgeDashboard.
 * Extracted to keep helpers.js under 500 lines.
 */

// ── CSS Variables & Styles ──────────────────────────────────────────────────

/**
 * Generate the full CSS for the dashboard.
 * Uses CSS custom properties for theming.
 * @returns {string} CSS content
 */
export function generateCSS() {
  return `
    :root {
      --bg-primary: #1a1a2e;
      --bg-card: #16213e;
      --bg-card-hover: #1a2744;
      --accent: #0f3460;
      --highlight: #e94560;
      --text-primary: #e0e0e0;
      --text-secondary: #a0a0b0;
      --success: #4caf50;
      --warning: #ff9800;
      --error: #f44336;
      --border: #2a2a4a;
      --radius: 8px;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.5;
      min-height: 100vh;
    }
    .header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 24px; background: var(--bg-card);
      border-bottom: 1px solid var(--border);
    }
    .header h1 { font-size: 20px; font-weight: 600; }
    .header .status-dot {
      display: inline-block; width: 10px; height: 10px;
      border-radius: 50%; margin-right: 8px;
    }
    .header .status-dot.connected { background: var(--success); }
    .header .status-dot.disconnected { background: var(--error); }
    .header .status-label { font-size: 13px; color: var(--text-secondary); }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      padding: 20px 24px;
      max-width: 1400px;
      margin: 0 auto;
    }
    @media (max-width: 800px) { .grid { grid-template-columns: 1fr; } }
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px 20px;
    }
    .card:hover { background: var(--bg-card-hover); }
    .card h2 {
      font-size: 14px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.5px; color: var(--text-secondary);
      margin-bottom: 12px; padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }
    .card.full-width { grid-column: 1 / -1; }
    .stat-row { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 10px; }
    .stat { text-align: center; }
    .stat .value { font-size: 28px; font-weight: 700; }
    .stat .label { font-size: 12px; color: var(--text-secondary); }
    .stat.success .value { color: var(--success); }
    .stat.warning .value { color: var(--warning); }
    .stat.error .value { color: var(--error); }
    .stat.info .value { color: #64b5f6; }
    .progress-bar-outer {
      width: 100%; height: 8px; background: var(--accent);
      border-radius: 4px; overflow: hidden; margin: 6px 0;
    }
    .progress-bar-inner {
      height: 100%; background: var(--success);
      transition: width 0.5s ease;
    }
    .goal-item {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 0; border-bottom: 1px solid var(--border);
      font-size: 13px;
    }
    .goal-item:last-child { border-bottom: none; }
    .goal-item .dot {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
    }
    .goal-item .dot.completed { background: var(--success); }
    .goal-item .dot.running { background: #64b5f6; }
    .goal-item .dot.failed { background: var(--error); }
    .goal-item .dot.pending { background: var(--text-secondary); }
    .goal-item .goal-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .goal-item .goal-time { color: var(--text-secondary); font-size: 11px; flex-shrink: 0; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th {
      text-align: left; padding: 6px 8px; font-weight: 600;
      color: var(--text-secondary); border-bottom: 1px solid var(--border);
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px;
    }
    td { padding: 6px 8px; border-bottom: 1px solid var(--border); }
    tr:last-child td { border-bottom: none; }
    .badge {
      display: inline-block; padding: 2px 8px; border-radius: 10px;
      font-size: 11px; font-weight: 600;
    }
    .badge.healthy { background: rgba(76,175,80,0.15); color: var(--success); }
    .badge.degraded { background: rgba(255,152,0,0.15); color: var(--warning); }
    .badge.critical { background: rgba(244,67,54,0.15); color: var(--error); }
    .bar-chart { display: flex; align-items: flex-end; gap: 4px; height: 60px; margin-top: 8px; }
    .bar-chart .bar {
      flex: 1; min-width: 12px; background: var(--accent);
      border-radius: 2px 2px 0 0; transition: height 0.3s ease;
      position: relative;
    }
    .bar-chart .bar:hover { background: var(--highlight); }
    .bar-chart .bar .bar-label {
      position: absolute; bottom: -16px; left: 50%; transform: translateX(-50%);
      font-size: 9px; color: var(--text-secondary); white-space: nowrap;
    }
    .event-item {
      display: flex; gap: 8px; padding: 4px 0;
      font-size: 12px; border-bottom: 1px solid var(--border);
    }
    .event-item:last-child { border-bottom: none; }
    .event-item .event-time { color: var(--text-secondary); flex-shrink: 0; width: 70px; }
    .event-item .event-type { font-weight: 600; flex-shrink: 0; min-width: 100px; }
    .event-item .event-msg { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .health-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
    .health-cell {
      padding: 8px 10px; border-radius: 4px; text-align: center;
      font-size: 12px; font-weight: 600;
    }
    .health-cell.healthy { background: rgba(76,175,80,0.15); color: var(--success); border: 1px solid rgba(76,175,80,0.3); }
    .health-cell.degraded { background: rgba(255,152,0,0.15); color: var(--warning); border: 1px solid rgba(255,152,0,0.3); }
    .health-cell.critical { background: rgba(244,67,54,0.15); color: var(--error); border: 1px solid rgba(244,67,54,0.3); }
    .health-cell .cell-name { font-size: 11px; font-weight: 400; opacity: 0.8; }
    .empty-state { color: var(--text-secondary); font-size: 13px; font-style: italic; padding: 12px 0; }
    .footer {
      text-align: center; padding: 16px; font-size: 11px;
      color: var(--text-secondary); border-top: 1px solid var(--border);
    }
  `;
}

// ── JavaScript for Auto-Refresh ─────────────────────────────────────────────

/**
 * Generate the inline JavaScript for the dashboard page.
 * Handles auto-refresh polling and DOM updates.
 * @param {number} refreshMs - polling interval in milliseconds
 * @returns {string} JavaScript content
 */
export function generateJS(refreshMs) {
  return `
    (function() {
      var refreshMs = ${refreshMs};
      var statusDot = document.getElementById('conn-dot');
      var statusLabel = document.getElementById('conn-label');
      var refreshTimer = null;

      function setConnected(ok) {
        if (statusDot) {
          statusDot.className = 'status-dot ' + (ok ? 'connected' : 'disconnected');
        }
        if (statusLabel) {
          statusLabel.textContent = ok ? 'Connected' : 'Reconnecting...';
        }
      }

      function fetchJSON(url) {
        return fetch(url, { cache: 'no-store' })
          .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); });
      }

      function updateGoals(data) {
        var el = document.getElementById('goals-data');
        if (el && data) { el.textContent = JSON.stringify(data); }
        var counts = document.getElementById('goal-counts');
        if (counts && data) {
          var active = (data.goals || []).filter(function(g) { return g.status === 'running' || g.status === 'compiled'; }).length;
          var done = (data.goals || []).filter(function(g) { return g.status === 'completed'; }).length;
          var failed = (data.goals || []).filter(function(g) { return g.status === 'failed'; }).length;
          var av = document.getElementById('count-active');
          var dv = document.getElementById('count-completed');
          var fv = document.getElementById('count-failed');
          if (av) av.textContent = active;
          if (dv) dv.textContent = done;
          if (fv) fv.textContent = failed;
        }
      }

      function poll() {
        fetchJSON('/api/status')
          .then(function(d) { setConnected(true); updateGoals(d); })
          .catch(function() { setConnected(false); });
      }

      refreshTimer = setInterval(poll, refreshMs);
      setConnected(true);
    })();
  `;
}
