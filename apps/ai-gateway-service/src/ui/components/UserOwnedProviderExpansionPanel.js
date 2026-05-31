import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { userOwnedProviderExpansionCopy } from "../copy/userOwnedProviderExpansionCopy.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));

export const userOwnedProviderExpansionPanelMarkers = Object.freeze([
  "User-owned Provider Expansion",
  "credentialRef-only",
  "realDiscoveryExecuted",
  "realSmokeExecuted",
  "selectable unchanged",
]);

export function renderUserOwnedProviderExpansionPanel() {
  const finalResult = readJson("apps/ai-gateway-service/evidence/phase781_800/user-owned-provider-expansion-final-result.json");
  const readiness = readJson("apps/ai-gateway-service/evidence/phase781_800/provider-credential-readiness-gate-result.json");
  const discoveryApproval = readJson("provider-expansion/discovery/discovery-approval-intake-result.json");
  const smokeApproval = readJson("provider-expansion/smoke/smoke-approval-intake-result.json");
  const badges = userOwnedProviderExpansionCopy.boundaryBadges
    .map((badge) => `<span>${escapeHtml(badge)}</span>`)
    .join("");
  const metricRows = [
    ["provider readiness", readiness?.credentialReady === true ? "credential_ready" : "approval or credentialRef required"],
    ["credentialRef-only status", finalResult?.credentialRefOnly ?? true],
    ["discovery approval status", discoveryApproval?.status ?? "not_executed_no_approval"],
    ["smoke approval status", smokeApproval?.status ?? "not_executed_no_approval"],
    ["discovered count", finalResult?.discoveredModelCount ?? 0],
    ["smoke pending count", finalResult?.smokePendingModelCount ?? 0],
    ["smoke passed count", finalResult?.smokePassedNewModelCount ?? 0],
    ["selectable candidate count", finalResult?.selectableCandidateModelCount ?? 0],
    ["blocked/high-risk count", finalResult?.currentHighRiskBlockedModelCount ?? 12],
    ["realDiscoveryExecuted", finalResult?.realDiscoveryExecuted ?? false],
    ["realSmokeExecuted", finalResult?.realSmokeExecuted ?? false],
    ["selectable unchanged", finalResult?.selectableModelCountUnchanged ?? true],
  ].map(([label, value]) => `
                    <span>${escapeHtml(label)} <strong>${escapeHtml(value)}</strong></span>`).join("");
  const safetyRows = userOwnedProviderExpansionCopy.safetyLines
    .map((line) => `
                    <li>${escapeHtml(line)}</li>`)
    .join("");

  return `
              <section class="user-owned-provider-expansion-panel" id="user-owned-provider-expansion-panel" data-phase="Phase781-800" data-user-owned-provider-expansion-panel="readonly">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase781-800</div>
                    <h3>${escapeHtml(userOwnedProviderExpansionCopy.title)}</h3>
                  </div>
                  <span class="tour-chip">read-only</span>
                </div>
                <p class="surface-muted">${escapeHtml(userOwnedProviderExpansionCopy.subtitle)}</p>
                <div class="radar-grid" data-user-owned-provider-expansion-metrics="true">
${metricRows}
                </div>
                <div class="codex-context-badges" data-user-owned-provider-expansion-boundaries="true">
                  ${badges}
                </div>
                <ul class="surface-muted" data-user-owned-provider-expansion-safety="true">
${safetyRows}
                </ul>
                <div class="comparison-footer">
                  <span>realDiscoveryExecuted=${escapeHtml(finalResult?.realDiscoveryExecuted ?? false)}</span>
                  <span>realSmokeExecuted=${escapeHtml(finalResult?.realSmokeExecuted ?? false)}</span>
                  <span>selectable unchanged</span>
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


