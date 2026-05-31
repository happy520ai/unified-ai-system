export function renderCapabilityCellCandidatePanel() {
  return `
              <section class="scenario-trial-panel" id="capability-cell-candidate-panel" data-phase1491-capability-cell-candidate="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase1491-1492 · capability cells</div>
                    <h3>Capability Cell Candidate Registry</h3>
                    <p>Lists local candidate cells and dry-run accept / reject decisions without modifying runtime registry.</p>
                  </div>
                  <span class="tour-chip">registry preview · accept/reject dry-run</span>
                </div>
                <div class="comparison-grid">
                  <article class="comparison-card" data-capability-cell="route-explainer">
                    <div class="comparison-badge">Candidate</div>
                    <strong>route-affinity-explainer</strong>
                    <p>Status: dry-run accepted for UI explanation coverage.</p>
                    <small>runtimeRegistered=false</small>
                  </article>
                  <article class="comparison-card" data-capability-cell="risk-explainer">
                    <div class="comparison-badge">Candidate</div>
                    <strong>risk-field-explainer</strong>
                    <p>Status: dry-run accepted for Security Shield coverage.</p>
                    <small>runtimeRegistered=false</small>
                  </article>
                  <article class="comparison-card" data-capability-cell="provider-trigger">
                    <div class="comparison-badge">Rejected</div>
                    <strong>provider-trigger</strong>
                    <p>Status: rejected because this phase forbids Provider execution.</p>
                    <small>providerCallsMade=false</small>
                  </article>
                </div>
              </section>`;
}


