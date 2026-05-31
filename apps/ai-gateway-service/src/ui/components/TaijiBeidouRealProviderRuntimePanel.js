import { taijiBeidouRealProviderRuntimeCopy } from "../copy/taijiBeidouRealProviderRuntimeCopy.js";

function renderRows(rows) {
  return rows.map(([label, value]) => `<span>${label} <strong>${value}</strong></span>`).join("");
}

function renderPreviewActions(items) {
  return items.map((item) => `<span class="tour-chip">${item}</span>`).join("");
}

export function renderTaijiBeidouRealProviderRuntimePanel() {
  return `
              <section class="scenario-trial-panel" id="taiji-beidou-real-provider-runtime-panel" data-taiji-real-provider-runtime-panel="true" data-taiji-real-provider-runtime-read-only="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Guarded provider runtime preview</div>
                    <h3>${taijiBeidouRealProviderRuntimeCopy.title}</h3>
                    <p>${taijiBeidouRealProviderRuntimeCopy.subtitle}</p>
                  </div>
                  <span class="tour-chip">${taijiBeidouRealProviderRuntimeCopy.boundary}</span>
                </div>
                <div class="mission-card-grid">
                  <article class="mission-card" data-taiji-real-provider-section="status">
                    <strong>Gate Status</strong>
                    <div class="shield-list">${renderRows(taijiBeidouRealProviderRuntimeCopy.status)}</div>
                  </article>
                  <article class="mission-card" data-taiji-real-provider-section="ledger">
                    <strong>Evidence / Cost / Quota</strong>
                    <div class="shield-list">${renderRows(taijiBeidouRealProviderRuntimeCopy.ledger)}</div>
                  </article>
                  <article class="mission-card" data-taiji-real-provider-section="guards">
                    <strong>Runtime Guard</strong>
                    <div class="shield-list">${renderRows(taijiBeidouRealProviderRuntimeCopy.guards)}</div>
                  </article>
                </div>
                <div class="comparison-footer" data-taiji-real-provider-section="preview-actions">
                  ${renderPreviewActions(taijiBeidouRealProviderRuntimeCopy.previewActions)}
                </div>
              </section>`;
}


