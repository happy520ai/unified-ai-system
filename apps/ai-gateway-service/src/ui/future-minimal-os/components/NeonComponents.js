/**
 * KPI Tile Component — Neon glassmorphism tile for key metrics
 * Usage: renderKPITile({ value: "$1.2M", delta: "+12.4%", deltaDir: "up", label: "Revenue" })
 */
export function renderKPITile({ value, delta = "", deltaDir = "up", label = "", id = "" }) {
  const deltaClass = deltaDir === "up" ? "kpi-tile__delta--up" : "kpi-tile__delta--down";
  const deltaArrow = deltaDir === "up" ? "▲" : "▼";
  const ariaLabel = `${label}: ${value}${delta ? `, ${deltaDir === "up" ? "up" : "down"} ${delta}` : ""}`;

  return `
    <div class="kpi-tile" ${id ? `id="${id}"` : ""} role="status" aria-label="${ariaLabel}">
      <span class="kpi-tile__value">${value}</span>
      ${delta ? `<span class="kpi-tile__delta ${deltaClass}" aria-hidden="true">${deltaArrow} ${delta}</span>` : ""}
      ${label ? `<span class="kpi-tile__label">${label}</span>` : ""}
    </div>
  `;
}

/**
 * Status Pill Component — Neon glowing status indicator
 * Usage: renderStatusPill({ status: "online", label: "System Online" })
 */
export function renderStatusPill({ status = "info", label = "", id = "" }) {
  const statusClass = `status-pill--${status}`;
  const dots = {
    online: "●",
    warning: "●",
    critical: "●",
    info: "●",
  };
  const ariaLabel = `Status: ${label || status}`;

  return `
    <span class="status-pill ${statusClass}" ${id ? `id="${id}"` : ""} role="status" aria-label="${ariaLabel}">
      ${dots[status] || "●"} ${label}
    </span>
  `;
}

/**
 * Data Table Component — Neon-enhanced table
 * Usage: renderDataTable({ columns: [...], rows: [...] })
 */
export function renderDataTable({ columns = [], rows = [], id = "", ariaLabel = "Data table" }) {
  const headerRow = columns.map((col) => `<th scope="col">${col}</th>`).join("");
  const bodyRows = rows
    .map(
      (row) => `
    <tr>
      ${row.map((cell) => `<td>${cell}</td>`).join("")}
    </tr>`
    )
    .join("");

  return `
    <table class="future-data-table" ${id ? `id="${id}"` : ""} role="table" aria-label="${ariaLabel}">
      <thead>
        <tr>${headerRow}</tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
  `;
}

/**
 * Scanline Overlay Component — Subtle CRT effect
 * Usage: renderScanlineOverlay()
 */
export function renderScanlineOverlay() {
  return `<div class="future-scanline-overlay" role="presentation" aria-hidden="true"></div>`;
}

// Re-export overlay components
export { renderModal, renderDrawer, renderTabBar } from "./NeonOverlayComponents.js";

// Re-export feedback components
export { renderToast, renderTooltip, renderDropdown, renderProgressBar, renderBadge } from "./NeonFeedbackComponents.js";
