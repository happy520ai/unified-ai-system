import { taijiBeidouProductionReadinessCopy } from "../copy/taijiBeidouProductionReadinessCopy.js";

function renderRows(rows) {
  return rows.map(([label, value]) => `<span>${label} <strong>${value}</strong></span>`).join("");
}

function renderChips(items) {
  return items.map((item) => `<span class="tour-chip">${item}</span>`).join("");
}

export function renderTaijiBeidouProductionReadinessPanel() {
  return `
              <section class="scenario-trial-panel" id="taiji-beidou-production-readiness-panel" data-taiji-production-readiness-panel="true" data-taiji-production-readiness-read-only="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Production readiness gate</div>
                    <h3>${taijiBeidouProductionReadinessCopy.title}</h3>
                    <p>${taijiBeidouProductionReadinessCopy.subtitle}</p>
                  </div>
                  <span class="tour-chip">${taijiBeidouProductionReadinessCopy.boundary}</span>
                </div>
                <div class="mission-card-grid">
                  <article class="mission-card" data-taiji-production-section="status">
                    <strong>Integration Status</strong>
                    <div class="shield-list">${renderRows(taijiBeidouProductionReadinessCopy.status)}</div>
                  </article>
                  <article class="mission-card" data-taiji-production-section="safeguards">
                    <strong>Safeguards</strong>
                    <div class="shield-list">${renderRows(taijiBeidouProductionReadinessCopy.safeguards)}</div>
                  </article>
                </div>
                <div class="comparison-footer" data-taiji-production-section="readonly-actions">
                  ${renderChips(taijiBeidouProductionReadinessCopy.operations)}
                </div>
              </section>`;
}


