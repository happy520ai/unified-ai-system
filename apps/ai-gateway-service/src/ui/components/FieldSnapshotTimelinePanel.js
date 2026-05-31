export function renderFieldSnapshotTimelinePanel() {
  return `
              <section class="scenario-trial-panel" id="field-snapshot-timeline-panel" data-phase1493-field-snapshot-timeline="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase1493 · timeline</div>
                    <h3>Field Snapshot Timeline</h3>
                    <p>Shows how a local dry-run snapshot moves through benchmark, explanation, risk review, and seal.</p>
                  </div>
                  <span class="tour-chip">timeline preview · no runtime mutation</span>
                </div>
                <div class="mission-flow">
                  <span>Phase1477 snapshot</span><span>Phase1478 route</span><span>Phase1480 risk</span><span>Phase1483 sleep</span><span>Phase1485 seal</span>
                </div>
              </section>`;
}


