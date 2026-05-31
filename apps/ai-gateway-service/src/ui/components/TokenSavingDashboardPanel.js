export function renderTokenSavingDashboardPanel() {
  return `
              <section class="scenario-trial-panel" id="token-saving-dashboard-panel" data-phase1494-token-saving-dashboard="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase1494 · token saving</div>
                    <h3>Context Token Saving Dashboard</h3>
                    <p>Separates target metrics from achieved dry-run metrics so token-saving evidence is not overstated.</p>
                  </div>
                  <span class="tour-chip">targetMetrics vs achievedMetrics</span>
                </div>
                <div class="comparison-grid">
                  <article class="comparison-card" data-token-saving-section="targetMetrics">
                    <div class="comparison-badge">targetMetrics</div>
                    <strong>Target</strong>
                    <p>snapshotTokenReductionTarget=0.40 · fullRepoScan=false · stale=false required.</p>
                  </article>
                  <article class="comparison-card is-recommended" data-token-saving-section="achievedMetrics">
                    <div class="comparison-badge">achievedMetrics</div>
                    <strong>Achieved dry-run</strong>
                    <p>tokenReductionRatio=0.602125 from Phase1482 deterministic benchmark.</p>
                  </article>
                </div>
              </section>`;
}


