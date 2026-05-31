const railItems = [
  ["Home", `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.8 12 4l8 6.8V20a1 1 0 0 1-1 1h-4.6v-5.8H9.6V21H5a1 1 0 0 1-1-1v-9.2Z"/></svg>`],
  ["Missions", `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8l1.2 2.4H20a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6.4a1 1 0 0 1 1-1h2.8L8 3Zm.9 7.2h6.2v1.8H8.9v-1.8Zm0 4h4.8V16H8.9v-1.8Z"/></svg>`],
  ["History", `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a8 8 0 1 1-7.4 5H2l3.6-3.8L9.3 9H6.7A6 6 0 1 0 12 6v4.7l3.5 2.1-.9 1.5-4.4-2.6V4H12Z"/></svg>`],
  ["Providers", `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4.5 7.2v9.6L12 21l7.5-4.2V7.2L12 3Zm0 2.5 5 2.8-5 2.8-5-2.8 5-2.8Zm-5.5 5 4.4 2.5v5l-4.4-2.5v-5Zm6.6 7.5v-5l4.4-2.5v5l-4.4 2.5Z"/></svg>`],
  ["Settings", `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.8 3.2 3.6.8-.4 3.7 2.4 2.8-2.4 2.8.4 3.7-3.6.8L12 22l-1.8-3.2-3.6-.8.4-3.7-2.4-2.8L7 8.7 6.6 5l3.6-.8L12 2Zm0 7.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z"/></svg>`]
];

export function renderOsNavigationRail() {
  return `
                <nav class="future-os-rail" aria-label="Mission Control navigation">
                  <div class="future-rail-mark" aria-hidden="true">PME</div>
                  <div class="future-rail-items">
                    ${railItems.map(([label, iconMarkup], index) => `
                      <a class="${index === 0 ? "is-active" : ""}" href="#future-minimal-os-panel" aria-label="${label}" title="${label}">
                        <span class="future-rail-icon">${iconMarkup}</span>
                        <span class="future-rail-label">${label}</span>
                      </a>`).join("")}
                  </div>
                  <div class="future-rail-version" aria-hidden="true">Minimal OS<br>v1.0.0</div>
                </nav>`;
}
