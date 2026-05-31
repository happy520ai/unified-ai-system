import { getYiyiModelBrainReadiness } from "../yiyi/model-brain/yiyiModelBrainReadiness.js";
import { runYiyiModelBrainDryRun } from "../yiyi/model-brain/yiyiModelBrainDryRunAdapter.js";

export function renderYiyiModelBrainPanel() {
  const readiness = getYiyiModelBrainReadiness();
  const dryRun = runYiyiModelBrainDryRun({ scenario: "provider_unconfigured" });
  const unsafe = runYiyiModelBrainDryRun({ scenario: "unsafe_model_output_rewritten" });

  return `
    <section class="yiyi-model-brain-panel" id="yiyi-model-brain-panel" data-yiyi-model-brain-status-visible="true">
      <div class="yiyi-settings-head">
        <div>
          <div class="eyebrow">Yiyi Model Brain</div>
          <h4>Model-backed dry-run readiness</h4>
          <p>brainMode=${readiness.brainMode} · modelBackedRuntimeEnabled=false · directProviderCallAllowed=false</p>
        </div>
        <span class="yiyi-version-pill" data-model-backed-dry-run-visible="true">model-backed dry-run</span>
      </div>

      <div class="yiyi-brain-grid">
        <article class="yiyi-setting-card" id="yiyi-model-brain-dry-run" data-yiyi-model-brain-dry-run="true">
          <strong>Selected Brain Route</strong>
          <p>${readiness.selectedBrainRoute}</p>
          <small>fallbackBrainMode=${readiness.fallbackBrainMode} · providerCallsMade=false</small>
        </article>
        <article class="yiyi-setting-card" id="yiyi-credentialref-gate" data-credentialref-gate-visible="true">
          <strong>credentialRef Gate</strong>
          <p>model library required · credentialRef required · rawSecretAccessed=false</p>
          <small>credentialRefChecked=${dryRun.credentialRefChecked} · modelSelectedRef=${dryRun.modelSelectedRef || "null"}</small>
        </article>
        <article class="yiyi-setting-card" id="yiyi-provider-policy-gate" data-provider-policy-gate-visible="true">
          <strong>Provider Policy Gate</strong>
          <p>provider must be user-configured and allowed for yiyi_brain.</p>
          <small>directProviderCallAllowed=false · providerCallsMade=false</small>
        </article>
      </div>

      <div class="yiyi-brain-grid">
        <article class="yiyi-setting-card" id="yiyi-quota-budget-gate" data-quota-budget-gate-visible="true">
          <strong>Quota / Budget Gate</strong>
          <p>realBillingAllowed=false · invoiceGenerated=false · estimatedCostVisible=mock only</p>
          <small>fallback if quota or budget is blocked</small>
        </article>
        <article class="yiyi-setting-card" id="yiyi-output-safety-gate" data-output-safety-gate-visible="true">
          <strong>Output Safety Gate</strong>
          <p>allowed fields only · unsafe output rewritten · no hidden prompt leak</p>
          <small>unsafeOutputRewritten=${unsafe.outputSafetyRewritten}</small>
        </article>
        <article class="yiyi-setting-card" id="yiyi-provider-test-authorization-gate" data-provider-test-authorization-gate-visible="true">
          <strong>Provider Test Gate</strong>
          <p>${readiness.providerTestMode} · missing authorization blocks real tests</p>
          <small>maxRequests=0 · maxCost=0 · actionExecuted=false</small>
        </article>
      </div>
    </section>`;
}


