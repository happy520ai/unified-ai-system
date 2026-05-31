export function renderSystemStatusDock(copy) {
  return `
                <footer class="future-status-dock" data-system-status-dock="true" aria-label="Safety status dock">
                  ${copy.dock.map((item) => `
                    <div>
                      <span>${item.label}</span>
                      <strong>${item.value}</strong>
                    </div>`).join("")}
                </footer>`;
}
