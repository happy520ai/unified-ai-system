import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { globalModelLibraryCopy } from "../copy/globalModelLibraryCopy.js";
import { readJson } from "../../entrypoints/entrypointUtils.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));
export const globalModelLibraryPanelMarkers = Object.freeze([
  "Global Model Library",
  "providerCallsMade=false",
  "secretRead=false",
  "selectable unchanged",
]);

export function renderGlobalModelLibraryPanel() {
  const metrics = readJson("apps/ai-gateway-service/evidence/model-library/model-expansion-metrics.json");
  const finalResult = readJson("apps/ai-gateway-service/evidence/phase761_780/global-model-library-expansion-final-result.json");
  const providerFamilyCount = metrics?.providerFamilyCount ?? finalResult?.providerFamilyCount ?? "pending";
  const catalogSeedModelCount = metrics?.catalogSeedModelCount ?? finalResult?.catalogSeedModelCount ?? "pending";
  const dryRunImportedModelCount = metrics?.dryRunImportedModelCount ?? finalResult?.dryRunImportedModelCount ?? "pending";
  const credentialMissingCount = metrics?.credentialMissingCount ?? "pending";
  const highRiskBlockedCount = metrics?.highRiskBlockedCount ?? finalResult?.currentHighRiskBlockedModelCount ?? "pending";
  const badges = globalModelLibraryCopy.boundaryBadges.map((badge) => `<span>${escapeHtml(badge)}</span>`).join("");
  const metricRows = [
    ["current matched count", metrics?.currentMatchedModelCount ?? 148],
    ["current selectable count", metrics?.currentSelectableModelCount ?? 17],
    ["current smokePassed count", metrics?.currentSmokePassedModelCount ?? 17],
    ["global catalog seed count", catalogSeedModelCount],
    ["provider family count", providerFamilyCount],
    ["credential missing count", credentialMissingCount],
    ["credential ready count", metrics?.credentialReadyCount ?? 0],
    ["smoke pending count", metrics?.smokePendingCount ?? 0],
    ["selectable candidate count", metrics?.selectableCandidateCount ?? 0],
    ["high-risk / blocked count", highRiskBlockedCount],
  ].map(([label, value]) => `
                    <span>${escapeHtml(label)} <strong>${escapeHtml(value)}</strong></span>`).join("");
  const safetyRows = globalModelLibraryCopy.safetyLines.map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");

  return `
              <section class="global-model-library-panel" id="global-model-library-panel" data-phase="Phase761-780" data-global-model-library-panel="readonly">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase761-780</div>
                    <h3>${escapeHtml(globalModelLibraryCopy.title)}</h3>
                  </div>
                  <span class="tour-chip">read-only</span>
                </div>
                <p class="surface-muted">${escapeHtml(globalModelLibraryCopy.subtitle)}</p>
                <div class="radar-grid" data-global-model-library-metrics="true">
${metricRows}
                </div>
                <div class="codex-context-badges" data-global-model-library-boundaries="true">
                  ${badges}
                </div>
                <ul class="surface-muted" data-global-model-library-safety="true">
${safetyRows}
                </ul>
                <div class="comparison-footer">
                  <span>no Provider call made</span>
                  <span>no secret read</span>
                  <span>selectable unchanged</span>
                </div>
              </section>`;
}


function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


