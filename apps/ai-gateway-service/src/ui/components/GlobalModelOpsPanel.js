import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { globalModelOpsCopy } from "../copy/globalModelOpsCopy.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));

export function renderGlobalModelOpsPanel() {
  const result = readJson("apps/ai-gateway-service/evidence/phase881_900/global-model-continuous-refresh-result.json") || {};
  const rows = [
    ["globalModelContinuousRefreshReady", result.globalModelContinuousRefreshReady ?? false],
    ["routingLearningReady", result.routingLearningReady ?? false],
    ["selectableDriftGuardPassed", result.selectableDriftGuardPassed ?? false],
    ["staleModels", Array.isArray(result.staleModels) ? result.staleModels.length : 0],
    ["retirementCandidates", Array.isArray(result.retirementCandidates) ? result.retirementCandidates.length : 0],
    ["providerApiCalled", result.providerAvailabilityWatch?.providerApiCalled ?? false],
    ["smokeRefreshApprovalRequired", result.smokeRefreshApprovalGate?.futureApprovalRequired ?? true],
  ];
  return renderPanel("global-model-ops-panel", globalModelOpsCopy.title, globalModelOpsCopy.subtitle, globalModelOpsCopy.badges, rows);
}

function renderPanel(id, title, subtitle, badges, rows) {
  return `
              <section class="model-routing-panel" id="${id}" data-readonly-panel="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase881-900</div>
                    <h3>${escapeHtml(title)}</h3>
                  </div>
                  <span class="tour-chip">read-only</span>
                </div>
                <p class="surface-muted">${escapeHtml(subtitle)}</p>
                <div class="radar-grid">
${rows.map(([label, value]) => `                  <span>${escapeHtml(label)} <strong>${escapeHtml(value)}</strong></span>`).join("\n")}
                </div>
                <div class="codex-context-badges">
                  ${badges.map((badge) => `<span>${escapeHtml(badge)}</span>`).join("")}
                </div>
              </section>`;
}

function readJson(relativePath) {
  const path = resolve(repoRoot, relativePath);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


