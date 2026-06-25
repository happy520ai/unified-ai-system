import { renderStatusPill } from "./components/NeonComponents.js";

/**
 * Enhanced System Status Dock with neon status pills
 */
export function renderSystemStatusDock(copy) {
  // Map dock items to status pills
  const statusMap = {
    "Online": "online",
    "Secure": "online",
    "Active": "online",
    "Warning": "warning",
    "Degraded": "warning",
    "Critical": "critical",
    "Error": "critical",
    "Processing": "info",
    "Loading": "info",
  };

  return `
                <footer class="future-status-dock" data-system-status-dock="true" aria-label="Safety status dock">
                  ${copy.dock.map((item) => {
                    const status = statusMap[item.value] || "info";
                    return `
                    <div>
                      <span>${item.label}</span>
                      ${renderStatusPill({ status, label: item.value })}
                    </div>`;
                  }).join("")}
                </footer>`;
}
