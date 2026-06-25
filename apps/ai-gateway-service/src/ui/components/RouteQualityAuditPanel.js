import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { routeQualityAuditCopy } from "../copy/routeQualityAuditCopy.js";
import { readJson } from "../../entrypoints/entrypointUtils.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));

export function renderRouteQualityAuditPanel() {
  const result = readJson("apps/ai-gateway-service/evidence/phase931_940/quality-result-audit-final-result.json") || {};
  const rows = [
    ["realRouteEvidenceCount", result.realRouteEvidenceCount],
    ["totalProviderRequestsFromSource", 5],
    ["newProviderRequestsThisPhase", result.newProviderRequestsThisPhase],
    ["externalProviderApiCallConfirmed", result.phase916930ExternalProviderApiConfirmed],
    ["eligible pool scope", `${result.phase916930EligibleTestPoolCount ?? "unknown"} strict test pool / ${result.globalSelectableModelBaseline ?? "unknown"} global baseline`],
    ["quality audit ready", result.routeQualityAuditReady],
    ["mode comparison ready", result.modeComparisonAuditReady],
    ["fallback reliability ready", result.fallbackReliabilityAuditReady],
    ["tuning plan ready", result.routePolicyTuningPlanReady],
    ["next test plan status", result.nextRealRouteTestPlanReady ? "planned-no-execution" : "not-ready"],
  ];
  return `
              <section class="model-routing-panel" id="route-quality-audit-panel" data-phase="Phase931-940" data-readonly-panel="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase931-940</div>
                    <h3>${escapeHtml(routeQualityAuditCopy.title)}</h3>
                  </div>
                  <span class="tour-chip">read-only</span>
                </div>
                <p class="surface-muted">${escapeHtml(routeQualityAuditCopy.subtitle)}</p>
                <div class="radar-grid">
${rows.map(([label, value]) => `                  <span>${escapeHtml(label)} <strong>${escapeHtml(value)}</strong></span>`).join("\n")}
                </div>
                <div class="codex-context-badges">
                  ${routeQualityAuditCopy.badges.map((badge) => `<span>${escapeHtml(badge)}</span>`).join("")}
                </div>
                <ul class="surface-muted">
${routeQualityAuditCopy.safetyLines.map((line) => `                  <li>${escapeHtml(line)}</li>`).join("\n")}
                </ul>
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


