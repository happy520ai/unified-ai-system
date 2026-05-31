import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { routeQualityRound2Copy } from "../copy/routeQualityRound2Copy.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));

export function renderRouteQualityRound2Panel() {
  const result = readJson("apps/ai-gateway-service/evidence/phase941_960/real-route-quality-test-round2-final-result.json") || {};
  const rows = [
    ["approval status", result.round2ApprovalPresent ? "present" : "missing"],
    ["total requests", result.totalProviderRequests ?? 0],
    ["max requests", 20],
    ["cost estimate", result.estimatedCostUsdTotal ?? 0],
    ["budget status", result.budgetExceeded ? "exceeded" : "within-limit-or-blocked"],
    ["normal/god/tianshu/fallback", `${Boolean(result.normalModeRound2Passed)} / ${Boolean(result.godModeRound2Passed)} / ${Boolean(result.tianshuModeRound2Passed)} / ${Boolean(result.fallbackRound2Passed)}`],
    ["external authenticity", result.externalProviderApiCallConfirmed],
    ["quality score", result.averageQualityScore ?? 0],
    ["blocked/failure policy", result.failedModelsExcluded ? "excluded" : "check-required"],
    ["tuning recommendation", result.routePolicyTuningRecommendationReady ? "ready" : "blocked"],
  ];
  return `
              <section class="model-routing-panel" id="route-quality-round2-panel" data-phase="Phase941-960" data-readonly-panel="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase941-960</div>
                    <h3>${escapeHtml(routeQualityRound2Copy.title)}</h3>
                  </div>
                  <span class="tour-chip">read-only</span>
                </div>
                <p class="surface-muted">${escapeHtml(routeQualityRound2Copy.subtitle)}</p>
                <div class="radar-grid">
${rows.map(([label, value]) => `                  <span>${escapeHtml(label)} <strong>${escapeHtml(value)}</strong></span>`).join("\n")}
                </div>
                <div class="codex-context-badges">
                  ${routeQualityRound2Copy.badges.map((badge) => `<span>${escapeHtml(badge)}</span>`).join("")}
                </div>
                <ul class="surface-muted">
${routeQualityRound2Copy.safetyLines.map((line) => `                  <li>${escapeHtml(line)}</li>`).join("\n")}
                </ul>
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


