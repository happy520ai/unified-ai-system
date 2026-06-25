import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { providerCallAuthenticityCopy } from "../copy/providerCallAuthenticityCopy.js";
import { readJson } from "../../entrypoints/entrypointUtils.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));

export function renderProviderCallAuthenticityPanel() {
  const result = readJson("apps/ai-gateway-service/evidence/phase901_910/provider-call-authenticity-final-result.json") || {};
  const rows = [
    ["providerCallsMade claim", result.previousProviderCallsMade],
    ["external API confirmed", result.externalProviderApiCallConfirmed],
    ["classification", result.authenticityClassification || "unknown"],
    ["network attempt recorded", result.networkAttemptRecorded],
    ["response source", result.responseSource || "unknown"],
    ["mock detected", result.mockResponseUsed],
    ["simulated detected", result.simulatedResponseUsed],
    ["dry-run detected", result.dryRunOnly],
    ["local executor only", result.localExecutorOnly],
    ["correction required", result.correctionRequired],
    ["credentialRef-only", result.credentialRefOnly],
    ["rawSecretRead", result.rawSecretRead],
    ["authJsonRead", result.authJsonRead],
  ];
  return `
              <section class="model-routing-panel" id="provider-call-authenticity-panel" data-phase="Phase901-910" data-readonly-panel="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase901-910</div>
                    <h3>${escapeHtml(providerCallAuthenticityCopy.title)}</h3>
                  </div>
                  <span class="tour-chip">read-only</span>
                </div>
                <p class="surface-muted">${escapeHtml(providerCallAuthenticityCopy.subtitle)}</p>
                <div class="radar-grid">
${rows.map(([label, value]) => `                  <span>${escapeHtml(label)} <strong>${escapeHtml(value)}</strong></span>`).join("\n")}
                </div>
                <div class="codex-context-badges">
                  ${providerCallAuthenticityCopy.badges.map((badge) => `<span>${escapeHtml(badge)}</span>`).join("")}
                </div>
                <ul class="surface-muted">
${providerCallAuthenticityCopy.safetyLines.map((line) => `                  <li>${escapeHtml(line)}</li>`).join("\n")}
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


