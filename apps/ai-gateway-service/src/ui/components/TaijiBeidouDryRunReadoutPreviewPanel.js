const boundaryRows = [
  ["providerCallsMade", "false"],
  ["secretRead", "false"],
  ["authJsonRead", "false"],
  ["gloveDownloaded", "false"],
  ["/chat modified", "false"],
  ["/chat-gateway/execute modified", "false"],
  ["main-chain integration", "false"],
  ["syntheticOnly", "true"],
];

const previewRows = [
  ["Phase1203", "Capability Candidate Readout"],
  ["Phase1204", "Tianshu Planner Alignment dry-run"],
  ["Phase1205", "Evidence Replay preview"],
  ["Phase1206", "Safety + Cost Sources"],
  ["Phase1207", "Capability Cell dry-run"],
  ["Phase1208", "Repair / Prune / Reweight dry-run"],
  ["Phase1209", "Mission Control read-only preview"],
  ["Phase1210", "Main-chain approval packet only"],
];

function renderRows(rows) {
  return rows.map(([label, value]) => `<span>${label} <strong>${value}</strong></span>`).join("");
}

export function renderTaijiBeidouDryRunReadoutPreviewPanel() {
  return `
              <section class="scenario-trial-panel" id="taiji-beidou-dry-run-readout-preview" data-taiji-beidou-dry-run-readout-preview="true" data-read-only-preview="true">
                <details class="future-advanced-system-details">
                  <summary>Taiji / Beidou dry-run capability readout preview</summary>
                  <div class="future-advanced-system-body">
                    <div class="drilldown-head">
                      <div>
                        <div class="eyebrow">Read-only synthetic evidence</div>
                        <h3>Capability Candidate Loop</h3>
                        <p>real-execution readout for candidate capability generation, planner alignment, evidence replay, safety gates, and main-chain approval packet preparation.</p>
                      </div>
                      <span class="tour-chip">collapsed by default · no runtime action</span>
                    </div>
                    <div class="comparison-grid">
                      <article class="comparison-card" data-taiji-dry-run-preview-card="phase-loop">
                        <div class="comparison-badge">Phase1203-1210</div>
                        <strong>Dry-run closure</strong>
                        <div class="shield-list">${renderRows(previewRows)}</div>
                      </article>
                      <article class="comparison-card" data-taiji-dry-run-preview-card="boundary-lock">
                        <div class="comparison-badge">Safety boundary</div>
                        <strong>No real execution</strong>
                        <div class="shield-list">${renderRows(boundaryRows)}</div>
                      </article>
                    </div>
                    <div class="comparison-footer">
                      <span>approvalPacketOnly=true</span>
                      <span>ownerApproved=false</span>
                      <span>realSemanticValidationClaimed=false</span>
                      <span>providerRuntimeDefaultEnabled=false</span>
                    </div>
                  </div>
                </details>
              </section>`;
}


