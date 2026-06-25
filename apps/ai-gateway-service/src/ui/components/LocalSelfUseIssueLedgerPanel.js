import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { localSelfUseIssueLedgerCopy } from "../copy/localSelfUseIssueLedgerCopy.js";
import { readJson } from "../../entrypoints/entrypointUtils.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));

export function renderLocalSelfUseIssueLedgerPanel() {
  const ledger = readJson("local-self-use/v1/issues/issue-ledger.json") || {};
  const policy = ledger.severityPolicy || {};
  return `
              <section class="model-routing-panel" id="local-self-use-issue-ledger-panel" data-phase="Phase988" data-readonly-panel="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase988</div>
                    <h3>${escapeHtml(localSelfUseIssueLedgerCopy.title)}</h3>
                  </div>
                  <span class="tour-chip">read-only</span>
                </div>
                <p class="surface-muted">${escapeHtml(localSelfUseIssueLedgerCopy.subtitle)}</p>
                <div class="radar-grid">
                  <span>P0 <strong>${escapeHtml((policy.P0 || []).join(", "))}</strong></span>
                  <span>P1 <strong>${escapeHtml((policy.P1 || []).join(", "))}</strong></span>
                  <span>P2 <strong>${escapeHtml((policy.P2 || []).join(", "))}</strong></span>
                  <span>P3 <strong>${escapeHtml((policy.P3 || []).join(", "))}</strong></span>
                </div>
                <p class="surface-muted">${escapeHtml(localSelfUseIssueLedgerCopy.severitySummary)}</p>
                <ul class="surface-muted">
${localSelfUseIssueLedgerCopy.safetyLines.map((line) => `                  <li>${escapeHtml(line)}</li>`).join("\n")}
                </ul>
              </section>`;
}


function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}


