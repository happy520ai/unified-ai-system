export function renderRiskFieldPanel() {
  return `
              <section class="scenario-trial-panel" id="risk-field-panel" data-phase1489-risk-field-panel="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase1489 · Security Shield</div>
                    <h3>Risk Field Explanation</h3>
                    <p>Explains why dangerous actions are blocked before any operator can confuse a preview with execution.</p>
                  </div>
                  <span class="tour-chip">dangerous actions enabled · credentialRef-only</span>
                </div>
                <div class="mission-card-grid">
                  <article class="mission-card" data-risk-field-source="secret-leak">
                    <strong>secretLeak</strong>
                    <p>Blocked. The UI does not read or show raw secrets, auth.json, tokens, or raw CredentialRef values.</p>
                  </article>
                  <article class="mission-card" data-risk-field-source="provider-bypass">
                    <strong>providerBypass</strong>
                    <p>Blocked. Provider calls require a separate approval gate and are not available from this panel.</p>
                  </article>
                  <article class="mission-card" data-risk-field-source="deploy-risk">
                    <strong>deployRisk</strong>
                    <p>Blocked. Deploy, release, tag, upload, push, and commit remain unavailable.</p>
                  </article>
                </div>
                <div class="comparison-footer">
                  <span>dangerousActionButtonDetected=false</span>
                  <span>providerCallsMade=false</span>
                  <span>chatGatewayExecuteModified=false</span>
                </div>
              </section>`;
}


