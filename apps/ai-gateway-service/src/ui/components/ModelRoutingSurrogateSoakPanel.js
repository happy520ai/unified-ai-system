import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { modelRoutingSurrogateSoakCopy } from "../copy/modelRoutingSurrogateSoakCopy.js";
import { readJson } from "../../entrypoints/entrypointUtils.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));

export function renderModelRoutingSurrogateSoakPanel() {
  const result = readJson("apps/ai-gateway-service/evidence/phase841_860/real-routing-surrogate-soak-final-result.json") || {};
  const rows = [
    ["scenarioCount", result.scenarioCount ?? 0],
    ["passCount", result.passCount ?? 0],
    ["blockedCount", result.blockedCount ?? 0],
    ["fallbackCount", result.fallbackCount ?? 0],
    ["codexSurrogateReviewed", result.codexSurrogateReviewed ?? false],
    ["humanReviewed", result.humanReviewed ?? false],
    ["realSevenDaySoakCompleted", result.realSevenDaySoakCompleted ?? false],
  ];
  return renderPanel("model-routing-surrogate-soak-panel", modelRoutingSurrogateSoakCopy.title, modelRoutingSurrogateSoakCopy.subtitle, modelRoutingSurrogateSoakCopy.badges, rows);
}

function renderPanel(id, title, subtitle, badges, rows) {
  return `
              <section class="model-routing-panel" id="${id}" data-readonly-panel="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase841-860</div>
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


function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


