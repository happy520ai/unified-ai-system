import { taijiBeidouAutoRuntimeCopy } from "../copy/taijiBeidouAutoRuntimeCopy.js";

function renderRows(rows) {
  return rows.map(([label, value]) => `<span>${label} <strong>${value}</strong></span>`).join("");
}

function renderPreviewControls(items) {
  return items.map((item) => `<span class="tour-chip">${item}</span>`).join("");
}

export function renderTaijiBeidouAutoRuntimePanel() {
  return `
              <section class="scenario-trial-panel" id="taiji-beidou-auto-runtime-panel" data-taiji-auto-runtime-panel="true" data-taiji-auto-runtime-read-only="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Beidou auto runtime preview</div>
                    <h3>${taijiBeidouAutoRuntimeCopy.title}</h3>
                    <p>${taijiBeidouAutoRuntimeCopy.subtitle}</p>
                  </div>
                  <span class="tour-chip">${taijiBeidouAutoRuntimeCopy.boundary}</span>
                </div>
                <div class="mission-card-grid">
                  <article class="mission-card" data-taiji-auto-section="status">
                    <strong>Auto Runtime Status</strong>
                    <div class="shield-list">${renderRows(taijiBeidouAutoRuntimeCopy.status)}</div>
                  </article>
                  <article class="mission-card" data-taiji-auto-section="counts">
                    <strong>Runtime Counts</strong>
                    <div class="shield-list">${renderRows(taijiBeidouAutoRuntimeCopy.counts)}</div>
                  </article>
                  <article class="mission-card" data-taiji-auto-section="guards">
                    <strong>Runtime Guard</strong>
                    <div class="shield-list">${renderRows(taijiBeidouAutoRuntimeCopy.guards)}</div>
                  </article>
                </div>
                <div class="comparison-footer" data-taiji-auto-section="preview-controls">
                  ${renderPreviewControls(taijiBeidouAutoRuntimeCopy.controls)}
                </div>
              </section>`;
}


