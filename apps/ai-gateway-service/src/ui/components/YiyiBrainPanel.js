import { getDefaultYiyiBrainPreview, runYiyiBrainMockAdapter } from "../yiyi/brain/yiyiBrainMockAdapter.js";
import { renderYiyiModelBrainPanel } from "./YiyiModelBrainPanel.js";

function renderScenarioButton(id, label) {
  return `<span class="yiyi-brain-scenario" data-yiyi-brain-scenario="${id}">${label}</span>`;
}

export function renderYiyiBrainPanel() {
  const preview = getDefaultYiyiBrainPreview();
  const providerPreview = runYiyiBrainMockAdapter({ scenario: "provider_unconfigured" });
  const evidencePreview = runYiyiBrainMockAdapter({ scenario: "evidence_replay_explain" });
  const unsafePreview = runYiyiBrainMockAdapter({
    scenario: "security_block_explain",
    draftBrainResponse: {
      speechBubble: "Unsafe draft",
      action: "deploy",
    },
  });

  return `
    <section class="yiyi-brain-panel" id="yiyi-brain-panel" data-yiyi-brain-panel="true">
      <div class="yiyi-settings-head">
        <div>
          <div class="eyebrow">Yiyi Brain Status</div>
          <h4>Yiyi Brain Orchestrator</h4>
          <p>brainMode=dry_run_mock · modelBacked=false · providerCallsMade=false · authorityLevel=presentation_and_guidance_only</p>
        </div>
        <span class="yiyi-version-pill" data-yiyi-brain-status-visible="true">dry-run mock</span>
      </div>

      <div class="yiyi-brain-grid">
        <article class="yiyi-setting-card" id="yiyi-brain-response-preview" data-yiyi-brain-response-preview="true">
          <strong>Brain Response Preview</strong>
          <p>${preview.response.speechBubble}</p>
          <small>emotionState=${preview.response.emotionState} · behaviorState=${preview.response.behaviorState}</small>
        </article>
        <article class="yiyi-setting-card" id="yiyi-brain-safe-suggestion" data-yiyi-safe-suggestion-visible="true">
          <strong>Safe Suggestion</strong>
          <p>${preview.response.safeSuggestion}</p>
          <small>recommendedPanel=${preview.response.recommendedPanel} · actionExecuted=false</small>
        </article>
        <article class="yiyi-setting-card" id="yiyi-brain-safety-gate" data-yiyi-brain-safety-gate-visible="true">
          <strong>Safety Gate Result</strong>
          <p>allowed output preview + unsafe output rewrite ready.</p>
          <small data-unsafe-brain-output-blocked-visible="true">decision=${unsafePreview.safetyGate.decision} · blockedReason=${unsafePreview.safetyGate.blockedReason}</small>
        </article>
      </div>

      <div class="yiyi-brain-scenarios" id="yiyi-brain-demo-scenarios">
        ${renderScenarioButton("welcome", "welcome")}
        ${renderScenarioButton("security_block_explain", "security block")}
        ${renderScenarioButton("provider_unconfigured", "provider unconfigured")}
        ${renderScenarioButton("evidence_replay_explain", "evidence replay")}
        ${renderScenarioButton("tianshu_plan_explain", "Tianshu explain")}
        ${renderScenarioButton("god_mode_explain", "God Mode explain")}
      </div>

      <div class="yiyi-brain-grid">
        <article class="yiyi-setting-card" id="yiyi-brain-provider-unconfigured" data-yiyi-brain-provider-unconfigured="true">
          <strong>Provider Unconfigured</strong>
          <p>${providerPreview.response.speechBubble}</p>
          <small>providerCallsMade=false · credentialRefRequired=true</small>
        </article>
        <article class="yiyi-setting-card" id="yiyi-brain-evidence-explain" data-yiyi-brain-evidence-explain="true">
          <strong>Evidence Explain</strong>
          <p>${evidencePreview.response.speechBubble}</p>
          <small>evidenceReference=${evidencePreview.response.evidenceReference}</small>
        </article>
      </div>
      ${renderYiyiModelBrainPanel()}
    </section>`;
}


