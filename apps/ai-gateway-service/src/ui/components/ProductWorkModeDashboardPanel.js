export function buildProductWorkModeDashboardSnapshot() {
  return {
    phaseId: "Phase3968A-ProductWorkModeDashboard",
    readOnly: true,
    controlledMutationHardCap: 56,
    productRealityBaseline: "Phase3958A sealed",
    ownerDailyUseStatus: "prepared_but_owner_record_missing",
    providerRealityMatrixStatus: "generated_without_provider_calls",
    credentialRefReadinessStatus: "checked_without_secret_read",
    deadButtonScanStatus: "scan_generated_report_only",
    selfEvolutionGovernanceStatus: "governed_dry_run_only",
    realProviderSmokeApproval: "owner_approval_required",
    blockers: ["owner_daily_use_record_missing", "owner_real_provider_smoke_approval_missing"],
    realActionButtonAdded: false,
    providerCallButtonAdded: false,
    deployButtonAdded: false,
    secretReadEntryAdded: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
  };
}

export function renderProductWorkModeDashboardPanel() {
  const snapshot = buildProductWorkModeDashboardSnapshot();
  return `
              <section class="drilldown-panel product-work-mode-dashboard" id="product-work-mode-dashboard-panel" data-phase3968a-product-work-mode-dashboard="true" data-product-work-mode-readonly="true" aria-label="Product Work Mode 状态面�?>
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Product Work Mode</div>
                    <h3>真实产品工作台状�?/h3>
                  </div>
                  <span class="tour-chip">read-only · no real action</span>
                </div>
                <div class="mission-card-grid">
                  <article class="mission-card"><strong>Controlled mutation hard cap</strong><p>${snapshot.controlledMutationHardCap} files. Further file-count expansion is blocked.</p></article>
                  <article class="mission-card"><strong>Product Reality Baseline</strong><p>${snapshot.productRealityBaseline}</p></article>
                  <article class="mission-card"><strong>Owner Daily Use</strong><p>${snapshot.ownerDailyUseStatus}</p></article>
                  <article class="mission-card"><strong>Provider Reality Matrix</strong><p>${snapshot.providerRealityMatrixStatus}</p></article>
                  <article class="mission-card"><strong>CredentialRef Readiness</strong><p>${snapshot.credentialRefReadinessStatus}</p></article>
                  <article class="mission-card"><strong>Dead Button Scan</strong><p>${snapshot.deadButtonScanStatus}</p></article>
                  <article class="mission-card"><strong>Self Evolution Governance</strong><p>${snapshot.selfEvolutionGovernanceStatus}</p></article>
                  <article class="mission-card"><strong>Real Provider Smoke</strong><p>${snapshot.realProviderSmokeApproval}</p></article>
                  <article class="mission-card"><strong>P0/P1/P2 blockers</strong><p>${snapshot.blockers.join(", ")}</p></article>
                </div>
                <div class="comparison-footer">
                  <span>realActionButtonAdded=false</span>
                  <span>providerCallButtonAdded=false</span>
                  <span>deployButtonAdded=false</span>
                  <span>secretReadEntryAdded=false</span>
                  <span>chatModified=false</span>
                  <span>chatGatewayExecuteModified=false</span>
                </div>
              </section>`;
}


