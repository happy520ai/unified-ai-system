export function renderConceptFieldPreviewPanel() {
  return `
              <section class="scenario-trial-panel" id="concept-field-preview-panel" data-phase1486-concept-field-preview="true" data-experimental="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase1486 · experimental concept field</div>
                    <h3>Concept Field Preview</h3>
                    <p>Local-only synthetic snapshot for Taiji / Beidou. It explains dry-run scores and does not prove real semantic intelligence.</p>
                  </div>
                  <span class="tour-chip">experimental · real-execution · providerCallsMade=false</span>
                </div>
                <div class="mission-card-grid">
                  <article class="mission-card" data-concept-field-metric="route-affinity">
                    <strong>routeAffinityScore</strong>
                    <p>0.870993 · Tianshu planner path is a synthetic candidate.</p>
                    <small>source: phase1476_1485 field snapshot</small>
                  </article>
                  <article class="mission-card" data-concept-field-metric="evidence-coherence">
                    <strong>evidenceCoherenceScore</strong>
                    <p>0.590746 · coherence requires review before any claim.</p>
                    <small>Evidence Replay visible; no truth validation claim.</small>
                  </article>
                  <article class="mission-card" data-concept-field-metric="risk-field">
                    <strong>riskFieldScore</strong>
                    <p>0.172823 · Security Shield keeps dangerous actions blocked.</p>
                    <small>no secret read · no provider call · no deploy</small>
                  </article>
                </div>
                <div class="comparison-footer">
                  <span>syntheticVectorsOnly=true</span>
                  <span>realSemanticValidationClaimed=false</span>
                  <span>productionReadyClaimed=false</span>
                </div>
              </section>`;
}


