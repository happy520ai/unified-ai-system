export function renderOperatorReviewChecklistPanel() {
  return `
              <section class="scenario-trial-panel" id="operator-review-checklist-panel" data-phase1498-operator-review-checklist="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase1498 · operator checklist</div>
                    <h3>Operator Review Checklist</h3>
                    <p>Review gates before any future real action. This panel is local checklist UI only.</p>
                  </div>
                  <span class="tour-chip">local checklist · gated future work</span>
                </div>
                <div class="shield-list">
                  <span>Phase1476-1485 sealed <strong>true</strong></span>
                  <span>Provider call approved <strong>false</strong></span>
                  <span>Secret access required <strong>false</strong></span>
                  <span>Dangerous action available <strong>false</strong></span>
                  <span>Evidence Replay visible <strong>true</strong></span>
                  <span>Token Saving metrics separated <strong>true</strong></span>
                </div>
              </section>`;
}


