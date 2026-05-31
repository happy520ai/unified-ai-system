import { taijiBeidouProductionOpsCopy } from "../copy/taijiBeidouProductionOpsCopy.js";

function renderRows(rows) {
  return rows.map(([label, value]) => `<span>${label} <strong>${value}</strong></span>`).join("");
}

function renderChips(items) {
  return items.map((item) => `<span class="tour-chip">${item}</span>`).join("");
}

export function renderTaijiBeidouProductionOpsPanel() {
  return `
              <section class="scenario-trial-panel" id="taiji-beidou-production-ops-panel" data-taiji-production-ops-panel="true" data-taiji-production-ops-read-only="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Production ops readiness</div>
                    <h3>${taijiBeidouProductionOpsCopy.title}</h3>
                    <p>${taijiBeidouProductionOpsCopy.subtitle}</p>
                  </div>
                  <span class="tour-chip">${taijiBeidouProductionOpsCopy.boundary}</span>
                </div>
                <div class="mission-card-grid">
                  <article class="mission-card" data-taiji-production-ops-section="status">
                    <strong>Operation Status</strong>
                    <div class="shield-list">${renderRows(taijiBeidouProductionOpsCopy.status)}</div>
                  </article>
                  <article class="mission-card" data-taiji-production-ops-section="readiness">
                    <strong>Prepared Packs</strong>
                    <div class="shield-list">${renderRows(taijiBeidouProductionOpsCopy.readiness)}</div>
                  </article>
                  <article class="mission-card" data-taiji-production-ops-section="safeguards">
                    <strong>Default-enabled Safeguards</strong>
                    <div class="shield-list">${renderRows(taijiBeidouProductionOpsCopy.safeguards)}</div>
                  </article>
                </div>
                <div class="comparison-footer" data-taiji-production-ops-section="readonly-actions">
                  ${renderChips(taijiBeidouProductionOpsCopy.operations)}
                </div>
              </section>`;
}


