import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sevenDaySoakEntryCopy } from "../copy/sevenDaySoakEntryCopy.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));

export function renderSevenDaySoakEntryPanel() {
  const final = readJson("apps/ai-gateway-service/evidence/phase971_1000/local-self-use-routing-system-v1-final-result.json") || {};
  return `
              <section class="model-routing-panel" id="seven-day-soak-entry-panel" data-phase="Phase991-995" data-readonly-panel="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase991-995</div>
                    <h3>${escapeHtml(sevenDaySoakEntryCopy.title)}</h3>
                  </div>
                  <span class="tour-chip">template-only</span>
                </div>
                <p class="surface-muted">${escapeHtml(sevenDaySoakEntryCopy.subtitle)}</p>
                <div class="radar-grid">
                  <span>frameworkReady <strong>${escapeHtml(final.sevenDaySoakFrameworkReady)}</strong></span>
                  <span>realSevenDaySoakCompleted <strong>${escapeHtml(final.realSevenDaySoakCompleted)}</strong></span>
                  <span>realThirtyDaySoakCompleted <strong>${escapeHtml(final.realThirtyDaySoakCompleted)}</strong></span>
                  <span>productionTrafficObserved <strong>${escapeHtml(final.productionTrafficObserved)}</strong></span>
                </div>
                <p class="surface-muted">${escapeHtml(sevenDaySoakEntryCopy.warning)}</p>
                <ul class="surface-muted">
${sevenDaySoakEntryCopy.safetyLines.map((line) => `                  <li>${escapeHtml(line)}</li>`).join("\n")}
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
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}


