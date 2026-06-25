import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { localSelfUseEvidenceLedgerCopy } from "../copy/localSelfUseEvidenceLedgerCopy.js";
import { readJson } from "../../entrypoints/entrypointUtils.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));

export function renderLocalSelfUseEvidenceLedgerPanel() {
  const ledger = readJson("local-self-use/v1/evidence-ledger.json") || {};
  const entries = Array.isArray(ledger.entries) ? ledger.entries : [];
  return `
              <section class="model-routing-panel" id="local-self-use-evidence-ledger-panel" data-phase="Phase987" data-readonly-panel="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase987</div>
                    <h3>${escapeHtml(localSelfUseEvidenceLedgerCopy.title)}</h3>
                  </div>
                  <span class="tour-chip">read-only</span>
                </div>
                <p class="surface-muted">${escapeHtml(localSelfUseEvidenceLedgerCopy.subtitle)}</p>
                <div class="radar-grid">
                  <span>schema <strong>${escapeHtml((ledger.schema || []).join(", "))}</strong></span>
                  <span>entryCount <strong>${entries.length}</strong></span>
                  <span>providerCallsMadeThisPhase <strong>false</strong></span>
                  <span>secretDisplayed <strong>false</strong></span>
                </div>
                <ul class="surface-muted">
${localSelfUseEvidenceLedgerCopy.safetyLines.map((line) => `                  <li>${escapeHtml(line)}</li>`).join("\n")}
                </ul>
              </section>`;
}


function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}


