export function renderEvidenceCoherencePanel() {
  return `
              <section class="scenario-trial-panel" id="evidence-coherence-panel" data-phase1488-evidence-coherence-panel="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase1488 · Evidence Replay</div>
                    <h3>Evidence Coherence Explanation</h3>
                    <p>Connects field snapshot, evidence refs, and replay status. It shows traceability, not factual proof.</p>
                  </div>
                  <span class="tour-chip">Evidence Replay visible · local evidence only</span>
                </div>
                <div class="mission-card-grid">
                  <article class="mission-card" data-evidence-coherence-card="snapshot">
                    <strong>Field Snapshot</strong>
                    <p>Activated concepts, suppressed concepts, unstable concepts, and compact readout are visible.</p>
                    <small>phase1476_1485 snapshot evidence</small>
                  </article>
                  <article class="mission-card" data-evidence-coherence-card="replay">
                    <strong>Evidence Replay</strong>
                    <p>Replay path: field snapshot -> route explanation -> Security Shield -> verifier seal.</p>
                    <small>external upload=false</small>
                  </article>
                  <article class="mission-card" data-evidence-coherence-card="claim-boundary">
                    <strong>Claim Boundary</strong>
                    <p>realSemanticValidationClaimed=false and productionReadyClaimed=false remain visible.</p>
                    <small>dry-run result is not human feedback.</small>
                  </article>
                </div>
              </section>`;
}


