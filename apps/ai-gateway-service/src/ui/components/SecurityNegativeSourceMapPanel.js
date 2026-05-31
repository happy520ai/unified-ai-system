export function renderSecurityNegativeSourceMapPanel() {
  return `
              <section class="scenario-trial-panel" id="security-negative-source-map-panel" data-phase1497-security-negative-source-map="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase1497 · negative source map</div>
                    <h3>Security Shield Negative Source Map</h3>
                    <p>Maps suppressed concepts to blocked actions so the operator can see why the system refuses risk.</p>
                  </div>
                  <span class="tour-chip">Security Shield explanation required</span>
                </div>
                <div class="comparison-footer">
                  <span>secretLeak -> block raw secret reads</span>
                  <span>providerBypass -> block ungated Provider calls</span>
                  <span>deployRisk -> block deploy / release / tag / upload</span>
                  <span>stale -> require context freshness check</span>
                </div>
              </section>`;
}


