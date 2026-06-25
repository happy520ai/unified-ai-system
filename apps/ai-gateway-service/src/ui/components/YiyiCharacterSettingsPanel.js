import {
  getYiyiCharacterCanon,
  getYiyiEmotionBehaviorCanonMap,
  getYiyiScenarioLines,
} from "../copy/yiyiCopy.js";

function renderPills(items) {
  return items.map((item) => `<span>${item}</span>`).join("");
}

function renderScenarioLines(lines) {
  return lines.slice(0, 6).map((item) => `
    <article class="yiyi-setting-line-card" data-yiyi-scenario-line="${item.scenarioId}">
      <strong>${item.scenarioId}</strong>
      <p>${item.lines.join(" ")}</p>
      <small>${item.emotionState} · ${item.behaviorState} · providerCallsMade=false</small>
    </article>
  `).join("");
}

export function renderYiyiCharacterSettingsPanel() {
  const canon = getYiyiCharacterCanon();
  const scenarioLines = getYiyiScenarioLines();
  const canonMap = getYiyiEmotionBehaviorCanonMap();
  if (!canon) {
    return `
      <section class="yiyi-character-settings" id="yiyi-character-settings-panel" data-yiyi-character-settings="missing">
        <div class="eyebrow">Character Canon</div>
        <strong>Yiyi character canon missing</strong>
      </section>`;
  }

  const traits = renderPills(canon.personalityProfile.traits);
  const speechRules = renderPills(canon.speechStyle.rules);
  const safetyRules = renderPills([
    "canExecuteActions=false",
    "canReadSecrets=false",
    "canCallProviders=false",
    "canDeploy=false",
    "canModifyEvidence=false",
    "canForgeApproval=false",
    "noMedicalClaim=true",
    "noTherapyClaim=true",
    "noSensitiveHealthInference=true",
  ]);
  const emotionStates = renderPills([...new Set(canonMap.map((item) => item.emotionState))]);
  const behaviorStates = renderPills([...new Set(canonMap.map((item) => item.behaviorState))]);

  return `
    <section class="yiyi-character-settings" id="yiyi-character-settings-panel" data-yiyi-character-settings="true">
      <div class="yiyi-settings-head">
        <div>
          <div class="eyebrow">Character Canon</div>
          <h4>依依人物设定</h4>
          <p>${canon.coreCanon.summary}</p>
        </div>
        <span class="yiyi-version-pill">${canon.identity.version}</span>
      </div>

      <div class="yiyi-settings-grid">
        <article class="yiyi-setting-card" id="yiyi-canon-section" data-yiyi-canon-visible="true">
          <strong>Identity / Core Canon</strong>
          <p>${canon.identity.displayName} · ${canon.identity.role}</p>
          <small>${canon.identity.authorityLevel}</small>
        </article>
        <article class="yiyi-setting-card" data-yiyi-personality-visible="true">
          <strong>Personality</strong>
          <div class="yiyi-token-row">${traits}</div>
        </article>
        <article class="yiyi-setting-card" data-yiyi-speech-style-visible="true">
          <strong>Speech Style</strong>
          <div class="yiyi-token-row">${speechRules}</div>
        </article>
        <article class="yiyi-setting-card" data-yiyi-emotion-behavior-visible="true">
          <strong>Emotion / Behavior Map</strong>
          <div class="yiyi-token-row">${emotionStates}</div>
          <div class="yiyi-token-row">${behaviorStates}</div>
        </article>
      </div>

      <div class="yiyi-scenario-lines" id="yiyi-scenario-lines-panel" data-yiyi-scenario-lines-visible="true">
        <div class="yiyi-settings-subhead">
          <strong>Scenario Lines</strong>
          <span>short · gentle · no real execution claim</span>
        </div>
        <div class="yiyi-setting-line-grid">${renderScenarioLines(scenarioLines)}</div>
      </div>

      <div class="yiyi-setting-card yiyi-safety-boundary" id="yiyi-character-safety-boundary" data-yiyi-safety-boundary-visible="true">
        <strong>Safety Boundary</strong>
        <div class="yiyi-token-row">${safetyRules}</div>
      </div>

      <div class="yiyi-persona-editor" id="yiyi-persona-editor-dry-run" data-persona-editor-dry-run="true">
        <div class="yiyi-settings-subhead">
          <strong>Persona Editor Dry-run</strong>
          <span>preview only · no backend save · no provider call</span>
        </div>
        <textarea id="yiyi-persona-entry-input" rows="3">依依说话要温柔一点，遇到用户失败时不要责怪，而是鼓励用户再试一次。</textarea>
        <div class="yiyi-controls">
          <button type="button" class="ghost" id="yiyi-persona-classify-button">Classify / Preview</button>
          <span class="yiyi-safety-pill">providerCallsMade=false</span>
          <span class="yiyi-safety-pill">secretValueExposed=false</span>
        </div>
        <div class="yiyi-persona-result" id="yiyi-persona-dry-run-result" data-unsafe-entry-rejected-visible="true">
          classification=editable_profile · decision=accepted_as_candidate · safetyPassed=true
        </div>
      </div>
    </section>`;
}


