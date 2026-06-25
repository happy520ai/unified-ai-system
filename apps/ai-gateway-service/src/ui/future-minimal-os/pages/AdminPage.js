import { renderStatusPill, renderKPITile, renderDataTable } from "./components/NeonComponents.js";
import { renderBadge, renderProgressBar } from "./components/NeonFeedbackComponents.js";

/**
 * Admin Page — Neon glassmorphism admin interface
 */
export function renderAdminPage({ users = [], systemStatus = {} }) {
  const defaultUsers = users.length
    ? users
    : [
        { name: "Admin", role: "Administrator", status: "active", lastLogin: "2026-06-05 14:32" },
        { name: "Developer", role: "Developer", status: "active", lastLogin: "2026-06-05 12:15" },
        { name: "Analyst", role: "Analyst", status: "inactive", lastLogin: "2026-06-04 09:45" },
        { name: "Viewer", role: "Viewer", status: "active", lastLogin: "2026-06-05 08:20" },
      ];

  const status = systemStatus.cpu
    ? systemStatus
    : { cpu: 42, memory: 67, disk: 55, uptime: "99.97%" };

  const userTableColumns = ["Name", "Role", "Status", "Last Login"];
  const userTableRows = defaultUsers.map((u) => [
    u.name,
    renderBadge({ text: u.role, variant: u.role === "Administrator" ? "error" : "info" }),
    renderStatusPill({ status: u.status === "active" ? "online" : "warning", label: u.status }),
    u.lastLogin,
  ]);

  return `
    <div class="admin-page" role="main" aria-label="Admin dashboard">
      <header class="admin-header">
        <h1 class="admin-header__title neon-text-cyan">Admin</h1>
        <p class="admin-header__subtitle">System administration and user management</p>
      </header>

      <section class="admin-kpi-grid stagger-enter" aria-label="System metrics">
        ${renderKPITile({ value: `${status.cpu}%`, delta: status.cpu > 80 ? "High" : "Normal", deltaDir: status.cpu > 80 ? "down" : "up", label: "CPU Usage" })}
        ${renderKPITile({ value: `${status.memory}%`, delta: status.memory > 80 ? "High" : "Normal", deltaDir: status.memory > 80 ? "down" : "up", label: "Memory" })}
        ${renderKPITile({ value: `${status.disk}%`, delta: status.disk > 80 ? "High" : "Normal", deltaDir: status.disk > 80 ? "down" : "up", label: "Disk" })}
        ${renderKPITile({ value: status.uptime, delta: "+0.02%", deltaDir: "up", label: "Uptime" })}
      </section>

      <section class="admin-system-section" aria-label="System status">
        <h2 class="admin-section-title">System Status</h2>
        <div class="admin-system-grid">
          <div class="admin-system-item">
            <span class="admin-system-label">CPU</span>
            ${renderProgressBar({ value: status.cpu, max: 100, label: "" })}
          </div>
          <div class="admin-system-item">
            <span class="admin-system-label">Memory</span>
            ${renderProgressBar({ value: status.memory, max: 100, label: "" })}
          </div>
          <div class="admin-system-item">
            <span class="admin-system-label">Disk</span>
            ${renderProgressBar({ value: status.disk, max: 100, label: "" })}
          </div>
        </div>
      </section>

      <section class="admin-users-section" aria-label="User management">
        <div class="admin-users-header">
          <h2 class="admin-section-title">Users</h2>
          ${renderBadge({ text: `${defaultUsers.length} users`, variant: "info" })}
        </div>
        ${renderDataTable({
          columns: userTableColumns,
          rows: userTableRows,
          ariaLabel: "Users table",
        })}
      </section>

      <section class="admin-alerts-section" aria-label="Recent alerts">
        <h2 class="admin-section-title">Recent Alerts</h2>
        <div class="admin-alerts-list">
          <div class="admin-alert-item">
            ${renderStatusPill({ status: "critical", label: "Critical" })}
            <span class="admin-alert-message">High CPU usage detected (92%)</span>
            <span class="admin-alert-time">2 minutes ago</span>
          </div>
          <div class="admin-alert-item">
            ${renderStatusPill({ status: "warning", label: "Warning" })}
            <span class="admin-alert-message">Memory usage approaching threshold (78%)</span>
            <span class="admin-alert-time">15 minutes ago</span>
          </div>
          <div class="admin-alert-item">
            ${renderStatusPill({ status: "online", label: "Resolved" })}
            <span class="admin-alert-message">Disk space recovered after cleanup</span>
            <span class="admin-alert-time">1 hour ago</span>
          </div>
        </div>
      </section>
    </div>
  `;
}
