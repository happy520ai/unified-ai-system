export function renderTianshuCapabilityAtomPreviewPanel() {
  return `
              <section class="mission-panel" id="tianshu-capability-atom-preview" data-tianshu-capability-atom-preview="true" aria-label="Tianshu capability atom readout preview">
                <div class="panel-heading">
                  <div>
                    <div class="eyebrow">Phase1941P-1950P</div>
                    <h3>Tianshu Capability Atom Readout</h3>
                  </div>
                  <span class="tour-chip">experiment · dry-run only</span>
                </div>
                <div class="mission-card-grid">
                  <article class="mission-card">
                    <strong>Capability Atom</strong>
                    <p>Atoms describe capability contracts, dependencies, evidence refs, and risk. They do not store executable code.</p>
                  </article>
                  <article class="mission-card">
                    <strong>Recommended atoms</strong>
                    <p>owner_daily_status_check · evidence_replay_summary · secret_safety_check · ui_smoke_check</p>
                  </article>
                  <article class="mission-card">
                    <strong>Blocked capability</strong>
                    <p>provider_stability_check remains blocked: provider_stability_not_verified.</p>
                  </article>
                  <article class="mission-card">
                    <strong>Boundary</strong>
                    <p>executionAllowed=false · providerCallsMade=false · arbitraryCodeExecuted=false · chatGatewayExecuteModified=false</p>
                  </article>
                </div>
              </section>`;
}
