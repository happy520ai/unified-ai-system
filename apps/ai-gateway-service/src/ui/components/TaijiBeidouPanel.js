import { taijiBeidouCopy } from "../copy/taijiBeidouCopy.js";

function renderRows(rows) {
  return rows.map(([label, value]) => `<span>${label} <strong>${value}</strong></span>`).join("");
}

export function renderTaijiBeidouPanel() {
  return `
              <section class="scenario-trial-panel" id="taiji-beidou-panel" data-taiji-beidou-panel="true" data-taiji-beidou-read-only="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Beidou kernel preview</div>
                    <h3>${taijiBeidouCopy.title}</h3>
                    <p>${taijiBeidouCopy.subtitle}</p>
                  </div>
                  <span class="tour-chip">${taijiBeidouCopy.boundary}</span>
                </div>
                <div class="mission-card-grid">
                  <article class="mission-card" data-taiji-section="engine-status">
                    <strong>Engine Status</strong>
                    <div class="shield-list">${renderRows(taijiBeidouCopy.engineStatus)}</div>
                  </article>
                  <article class="mission-card" data-taiji-section="capability-neurons">
                    <strong>Capability Neurons</strong>
                    <div class="shield-list">${renderRows(taijiBeidouCopy.capabilityNeurons)}</div>
                  </article>
                  <article class="mission-card" data-taiji-section="immune-guard">
                    <strong>Immune Guard</strong>
                    <div class="shield-list">${renderRows(taijiBeidouCopy.immuneGuard)}</div>
                  </article>
                </div>
                <div class="comparison-grid">
                  <article class="comparison-card" data-taiji-section="homeostasis">
                    <div class="comparison-badge">Homeostasis</div>
                    <strong>Budget / Lease / TTL</strong>
                    <div class="shield-list">${renderRows(taijiBeidouCopy.homeostasis)}</div>
                  </article>
                  <article class="comparison-card" data-taiji-section="codex-token-saving-subgateway">
                    <div class="comparison-badge">Codex Token-Saving Subgateway</div>
                    <strong>Long-task preflight</strong>
                    <div class="shield-list">${renderRows(taijiBeidouCopy.codexSubgateway)}</div>
                  </article>
                </div>
                <div class="comparison-footer">
                  <span>runtimeAutoEnabled=false</span>
                  <span>providerCallsMade=false</span>
                  <span>secretRead=false</span>
                  <span>chatBehaviorChanged=false</span>
                  <span>chatGatewayExecuteBehaviorChanged=false</span>
                </div>
              </section>`;
}


