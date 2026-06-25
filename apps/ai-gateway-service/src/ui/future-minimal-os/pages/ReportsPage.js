import { renderStatusPill, renderKPITile, renderDataTable } from "./components/NeonComponents.js";
import { renderProgressBar, renderBadge } from "./components/NeonFeedbackComponents.js";

/**
 * Reports Page — Neon glassmorphism reports interface
 */
export function renderReportsPage({ reports = [], kpis = [] }) {
  const defaultKpis = kpis.length
    ? kpis
    : [
        { value: "1,247", delta: "+12.4%", deltaDir: "up", label: "Total Reports" },
        { value: "89.2%", delta: "+3.1%", deltaDir: "up", label: "Success Rate" },
        { value: "2.4s", delta: "-8.7%", deltaDir: "down", label: "Avg Response" },
        { value: "99.97%", delta: "+0.02%", deltaDir: "up", label: "Uptime" },
      ];

  const defaultReports = reports.length
    ? reports
    : [
        { name: "Daily Analytics", status: "completed", date: "2026-06-05", type: "Automated" },
        { name: "User Activity", status: "running", date: "2026-06-05", type: "Scheduled" },
        { name: "Performance Audit", status: "completed", date: "2026-06-04", type: "Manual" },
        { name: "Security Scan", status: "failed", date: "2026-06-04", type: "Automated" },
      ];

  const statusMap = {
    completed: "online",
    running: "info",
    failed: "critical",
    pending: "warning",
  };

  const tableColumns = ["Name", "Status", "Date", "Type"];
  const tableRows = defaultReports.map((r) => [
    r.name,
    `<span class="status-pill status-pill--${statusMap[r.status] || "info"}">${r.status}</span>`,
    r.date,
    r.type,
  ]);

  return `
    <div class="reports-page" role="main" aria-label="Reports dashboard">
      <header class="reports-header">
        <h1 class="reports-header__title neon-text-cyan">Reports</h1>
        <p class="reports-header__subtitle">Analytics and insights for your AI system</p>
      </header>

      <section class="reports-kpi-grid stagger-enter" aria-label="Key metrics">
        ${defaultKpis.map((kpi) => renderKPITile(kpi)).join("")}
      </section>

      <section class="reports-table-section" aria-label="Recent reports">
        <div class="reports-table-header">
          <h2 class="reports-table-title">Recent Reports</h2>
          ${renderBadge({ text: `${defaultReports.length} reports`, variant: "info" })}
        </div>
        ${renderDataTable({
          columns: tableColumns,
          rows: tableRows,
          ariaLabel: "Reports table",
        })}
      </section>

      <section class="reports-progress-section" aria-label="Running reports">
        <h2 class="reports-progress-title">Active Reports</h2>
        <div class="reports-progress-list">
          ${defaultReports
            .filter((r) => r.status === "running")
            .map(
              (r) => `
            <div class="reports-progress-item">
              <span class="reports-progress-name">${r.name}</span>
              ${renderProgressBar({ value: 65, max: 100, label: "Progress" })}
            </div>`
            )
            .join("") || '<p class="reports-empty">No active reports</p>'}
        </div>
      </section>
    </div>
  `;
}
