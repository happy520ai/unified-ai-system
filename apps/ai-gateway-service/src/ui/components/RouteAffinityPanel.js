export function renderRouteAffinityPanel() {
  return `
              <section class="scenario-trial-panel" id="route-affinity-panel" data-phase1487-route-affinity-panel="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase1487 · route explanation</div>
                    <h3>Route Affinity Explanation</h3>
                    <p>Shows why the synthetic field leans toward Tianshu, God Mode, or Security Shield without changing runtime routing.</p>
                  </div>
                  <span class="tour-chip">explainable · dry-run · /chat unchanged</span>
                </div>
                <div class="comparison-grid">
                  <article class="comparison-card is-recommended" data-route-affinity-candidate="tianshu">
                    <div class="comparison-badge">Candidate</div>
                    <strong>Tianshu</strong>
                    <p>routeAffinityScore=0.870993 from planner, route, dryRun, and evidence concepts.</p>
                    <small>selectedSyntheticRoute only; no provider request.</small>
                  </article>
                  <article class="comparison-card" data-route-affinity-candidate="god-mode">
                    <div class="comparison-badge">Review</div>
                    <strong>God Mode</strong>
                    <p>Use when conflict or synthesis pressure is visible in the field.</p>
                    <small>preview reviewer map only.</small>
                  </article>
                  <article class="comparison-card" data-route-affinity-candidate="security-shield">
                    <div class="comparison-badge">Guard</div>
                    <strong>Security Shield</strong>
                    <p>Explains blocked secret, provider bypass, deploy, release, and mutation paths.</p>
                    <small>dangerous actions remain enabled.</small>
                  </article>
                </div>
              </section>`;
}


