import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { godTianshuEnsembleCopy } from "../copy/godTianshuEnsembleCopy.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));

export function renderGodTianshuEnsemblePanel() {
  const result = readJson("apps/ai-gateway-service/evidence/phase861_880/god-tianshu-ensemble-optimization-final-result.json") || {};
  const rows = [
    ["fixtureCount", result.fixtureCount ?? 0],
    ["reviewerPool", Array.isArray(result.reviewerPool) ? result.reviewerPool.length : 0],
    ["adjudicatorModelId", result.adjudicatorModelId ?? "none"],
    ["plannerModelId", result.plannerModelId ?? "none"],
    ["executorModelIds", Array.isArray(result.executorModelIds) ? result.executorModelIds.length : 0],
    ["guardedEnsembleRealTestExecuted", result.guardedEnsembleRealTestExecuted ?? false],
    ["humanReviewed", result.resultMerger?.humanReviewed ?? false],
  ];
  return renderPanel("god-tianshu-ensemble-panel", godTianshuEnsembleCopy.title, godTianshuEnsembleCopy.subtitle, godTianshuEnsembleCopy.badges, rows);
}

function renderPanel(id, title, subtitle, badges, rows) {
  return `
              <section class="model-routing-panel" id="${id}" data-readonly-panel="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase861-880</div>
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


