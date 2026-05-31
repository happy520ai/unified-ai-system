import { taijiBeidouLocalDogfoodingMainlineCopy } from "../copy/taijiBeidouLocalDogfoodingMainlineCopy.js";

function renderRows(rows) {
  return rows.map(([label, value]) => `<span>${label} <strong>${value}</strong></span>`).join("");
}

function renderChips(items) {
  return items.map((item) => `<span class="tour-chip">${item}</span>`).join("");
}

export function renderTaijiBeidouLocalDogfoodingMainlinePanel() {
  return `
              <section class="scenario-trial-panel" id="taiji-beidou-local-dogfooding-mainline-panel" data-taiji-local-dogfooding-mainline-panel="true" data-taiji-local-dogfooding-read-only="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase1306-1450</div>
                    <h3>${taijiBeidouLocalDogfoodingMainlineCopy.title}</h3>
                    <p>${taijiBeidouLocalDogfoodingMainlineCopy.subtitle}</p>
                  </div>
                  <span class="tour-chip">${taijiBeidouLocalDogfoodingMainlineCopy.boundary}</span>
                </div>
                <div class="mission-card-grid">
                  <article class="mission-card" data-taiji-local-mainline-section="default-enable">
                    <strong>Default Enable</strong>
                    <div class="shield-list">${renderRows(taijiBeidouLocalDogfoodingMainlineCopy.defaultEnable)}</div>
                  </article>
                  <article class="mission-card" data-taiji-local-mainline-section="capability-status">
                    <strong>Callable / Readable / Claimable</strong>
                    <div class="shield-list">${renderRows(taijiBeidouLocalDogfoodingMainlineCopy.capabilityStatus)}</div>
                  </article>
                  <article class="mission-card" data-taiji-local-mainline-section="stability">
                    <strong>Multi-provider Stability</strong>
                    <div class="shield-list">${renderRows(taijiBeidouLocalDogfoodingMainlineCopy.stability)}</div>
                  </article>
                </div>
                <div class="comparison-grid">
                  <article class="comparison-card" data-taiji-local-mainline-section="dogfooding">
                    <div class="comparison-badge">Local only</div>
                    <strong>Dogfooding Readiness</strong>
                    <div class="shield-list">${renderRows(taijiBeidouLocalDogfoodingMainlineCopy.dogfooding)}</div>
                  </article>
                  <article class="comparison-card" data-taiji-local-mainline-section="delayed-launch">
                    <div class="comparison-badge">Delayed launch</div>
                    <strong>Future Production Gate</strong>
                    <div class="comparison-footer">${renderChips(taijiBeidouLocalDogfoodingMainlineCopy.launchGate)}</div>
                  </article>
                </div>
              </section>`;
}


