export function renderSleepCandidateReviewDrawer() {
  return `
              <section class="scenario-trial-panel" id="sleep-candidate-review-drawer" data-phase1490-sleep-candidate-review="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase1490 · review drawer</div>
                    <h3>Sleep Candidate Review</h3>
                    <p>Dry-run candidates for future compaction or prune review. Nothing is applied automatically.</p>
                  </div>
                  <span class="tour-chip">review-only · no auto-apply</span>
                </div>
                <div class="comparison-grid">
                  <article class="comparison-card" data-sleep-review="consolidation">
                    <div class="comparison-badge">Candidate</div>
                    <strong>sleepConsolidationCandidates</strong>
                    <p>Candidate concepts can be reviewed for future synthetic memory compaction.</p>
                  </article>
                  <article class="comparison-card" data-sleep-review="prune">
                    <div class="comparison-badge">Review</div>
                    <strong>pruneCandidates</strong>
                    <p>Suppressed or low-fit concepts are listed for operator review only.</p>
                  </article>
                </div>
                <button type="button" enabled aria-enabled="true" data-dangerous-action="false">Preview only · dry-run accept enabled</button>
              </section>`;
}


