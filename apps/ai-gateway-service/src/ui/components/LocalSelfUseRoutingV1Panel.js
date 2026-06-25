import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { localSelfUseRoutingV1Copy } from "../copy/localSelfUseRoutingV1Copy.js";
import { renderLocalSelfUseEvidenceLedgerPanel } from "./LocalSelfUseEvidenceLedgerPanel.js";
import { renderLocalSelfUseIssueLedgerPanel } from "./LocalSelfUseIssueLedgerPanel.js";
import { renderSevenDaySoakEntryPanel } from "./SevenDaySoakEntryPanel.js";
import { readJson } from "../../entrypoints/entrypointUtils.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));

export function renderLocalSelfUseRoutingV1Panel() {
  const result = readJson("apps/ai-gateway-service/evidence/phase971_1000/local-self-use-routing-system-v1-final-result.json") || {};
  const rows = [
    ["localSelfUseReady", result.localSelfUseReady],
    ["routingSystemV1Ready", result.routingSystemV1Ready],
    ["Normal / God / Tianshu", `${Boolean(result.normalModeReady)} / ${Boolean(result.godModeReady)} / ${Boolean(result.tianshuModeReady)}`],
    ["providerRouteGuardReady", result.providerRouteGuardReady],
    ["round2GodBlockerClearedBySupplement", result.round2GodBlockerClearedBySupplement],
    ["routePolicyAppliedToRuntime", result.routePolicyAppliedToRuntime],
    ["evidence / issue / journal", `${Boolean(result.evidenceLedgerReady)} / ${Boolean(result.issueLedgerReady)} / ${Boolean(result.dailyUseJournalReady)}`],
    ["realSevenDaySoakCompleted", result.realSevenDaySoakCompleted],
    ["serverInfrastructureReady", result.serverInfrastructureReady],
    ["productionDeployExecuted", result.productionDeployExecuted],
  ];
  return `
              <section class="model-routing-panel" id="local-self-use-routing-v1-panel" data-phase="Phase971-1000" data-readonly-panel="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase971-1000</div>
                    <h3>${escapeHtml(localSelfUseRoutingV1Copy.title)}</h3>
                  </div>
                  <span class="tour-chip">read-only</span>
                </div>
                <p class="surface-muted">${escapeHtml(localSelfUseRoutingV1Copy.subtitle)}</p>
                <div class="radar-grid">
${rows.map(([label, value]) => `                  <span>${escapeHtml(label)} <strong>${escapeHtml(value)}</strong></span>`).join("\n")}
                </div>
                <div class="codex-context-badges">
                  ${localSelfUseRoutingV1Copy.badges.map((badge) => `<span>${escapeHtml(badge)}</span>`).join("")}
                </div>
                <ul class="surface-muted">
${localSelfUseRoutingV1Copy.safetyLines.map((line) => `                  <li>${escapeHtml(line)}</li>`).join("\n")}
                </ul>
              </section>
${renderLocalSelfUseEvidenceLedgerPanel()}
${renderLocalSelfUseIssueLedgerPanel()}
${renderSevenDaySoakEntryPanel()}`;
}


function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}


