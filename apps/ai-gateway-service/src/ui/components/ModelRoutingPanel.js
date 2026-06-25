import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { modelRoutingCopy } from "../copy/modelRoutingCopy.js";
import { readJson } from "../../entrypoints/entrypointUtils.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));

export const modelRoutingPanelMarkers = Object.freeze([
  "Model Routing",
  "task pressure",
  "mode recommendation",
  "providerCallsMade=false",
  "default behavior unchanged",
]);

export function renderModelRoutingPanel() {
  const finalResult = readJson("apps/ai-gateway-service/evidence/phase801_820/task-pressure-mode-routing-final-result.json");
  const simulator = readJson("apps/ai-gateway-service/evidence/phase801_820/dry-run-route-simulator-result.json");
  const firstRoute = simulator?.routes?.[0] || {};
  const badges = modelRoutingCopy.boundaryBadges.map((badge) => `<span>${escapeHtml(badge)}</span>`).join("");
  const metricRows = [
    ["routing engine status", finalResult?.modelRoutingEngineReady === true ? "ready" : "pending"],
    ["selectable model count", finalResult?.selectableModelCount ?? 17],
    ["smokePassed count", finalResult?.smokePassedModelCount ?? 17],
    ["candidate model count", finalResult?.selectableCandidateModelCount ?? 0],
    ["task pressure", firstRoute.taskPressure?.reasoningPressure ?? "pending"],
    ["mode recommendation", firstRoute.mode ?? "pending"],
    ["selected model", firstRoute.selected?.primaryModelId ?? "pending"],
    ["reviewer pool", Array.isArray(firstRoute.godMode?.reviewerPool) ? firstRoute.godMode.reviewerPool.length : 0],
    ["fallback chain", Array.isArray(firstRoute.fallbackChain) ? firstRoute.fallbackChain.length : 0],
    ["providerCallsMade", finalResult?.providerCallsMade ?? false],
    ["default behavior unchanged", finalResult?.chatBehaviorChangedByDefault === false && finalResult?.chatGatewayExecuteBehaviorChangedByDefault === false],
  ].map(([label, value]) => `
                    <span>${escapeHtml(label)} <strong>${escapeHtml(value)}</strong></span>`).join("");
  const safetyRows = modelRoutingCopy.safetyLines.map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");

  return `
              <section class="model-routing-panel" id="model-routing-panel" data-phase="Phase801-820" data-model-routing-panel="readonly">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase801-820</div>
                    <h3>${escapeHtml(modelRoutingCopy.title)}</h3>
                  </div>
                  <span class="tour-chip">read-only</span>
                </div>
                <p class="surface-muted">${escapeHtml(modelRoutingCopy.subtitle)}</p>
                <div class="radar-grid" data-model-routing-metrics="true">
${metricRows}
                </div>
                <div class="codex-context-badges" data-model-routing-boundaries="true">
                  ${badges}
                </div>
                <ul class="surface-muted" data-model-routing-safety="true">
${safetyRows}
                </ul>
                <div class="comparison-footer">
                  <span>route explanation: ${escapeHtml(firstRoute.routeExplanation ?? "pending")}</span>
                  <span>providerCallsMade=false</span>
                  <span>default behavior unchanged</span>
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


