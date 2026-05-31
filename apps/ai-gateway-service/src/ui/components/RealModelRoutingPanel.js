import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { realModelRoutingCopy } from "../copy/realModelRoutingCopy.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));

export function renderRealModelRoutingPanel() {
  const result = readJson("apps/ai-gateway-service/evidence/phase821_900/global-model-routing-system-final-result.json")
    || readJson("apps/ai-gateway-service/evidence/phase821_840/guarded-real-route-executor-result.json")
    || {};
  const rows = [
    ["guardedRealRoutingReady", result.guardedRealRoutingReady],
    ["normalModeRealRouteReady", result.normalModeRealRouteReady],
    ["godModeRealRouteReady", result.godModeRealRouteReady],
    ["tianshuModeRealRouteReady", result.tianshuModeRealRouteReady],
    ["fallbackRuntimeReady", result.fallbackRuntimeReady],
    ["totalProviderRequests", result.totalProviderRequests ?? 0],
    ["estimatedCostUsdTotal", result.estimatedCostUsdTotal ?? 0],
    ["providerCallsMade", result.providerCallsMade ?? false],
    ["blocker", result.blocker ?? "none"],
  ];
  return renderPanel("real-model-routing-panel", realModelRoutingCopy.title, realModelRoutingCopy.subtitle, realModelRoutingCopy.badges, rows, realModelRoutingCopy.safetyLines);
}

function renderPanel(id, title, subtitle, badges, rows, safetyLines) {
  return `
              <section class="model-routing-panel" id="${id}" data-phase="Phase821-840" data-readonly-panel="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase821-840</div>
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
                <ul class="surface-muted">
${safetyLines.map((line) => `                  <li>${escapeHtml(line)}</li>`).join("\n")}
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


