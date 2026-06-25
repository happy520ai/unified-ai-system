import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { taijiBeidouRealLocalDogfoodingIntakeCopy } from "../copy/taijiBeidouRealLocalDogfoodingIntakeCopy.js";
import { readJson } from "../../entrypoints/entrypointUtils.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));
const evidencePath = "apps/ai-gateway-service/evidence/phase1451-1475-real-local-dogfooding-intake/real-local-dogfooding-intake-result.json";

export function renderTaijiBeidouRealLocalDogfoodingIntakePanel() {
  const result = readJson(evidencePath) || {};
  const intakeRows = [
    ["realDailyLedgerCount", result.realDailyLedgerCount ?? 0],
    ["realWeeklyReviewCount", result.realWeeklyReviewCount ?? 0],
    ["realOwnerFeedbackCount", result.realOwnerFeedbackCount ?? 0],
    ["realRecordCount", result.realOwnerDogfoodingRecordCount ?? 0],
    ["lastLedgerDate", result.lastLedgerDate ?? "none"],
    ["nextReviewGate", result.nextReviewGate ?? "one_month_owner_review_required"],
  ];
  const issueRows = [
    ["P0", result.p0IssueCount ?? 0],
    ["P1", result.p1IssueCount ?? 0],
    ["P2", result.p2IssueCount ?? 0],
    ["P3", result.p3IssueCount ?? 0],
    ["safetyBrakeEngaged", result.safetyBrakeEngaged ?? false],
    ["lowRiskRepairsExecuted", result.lowRiskRepairsExecuted ?? false],
  ];

  return `
              <section class="scenario-trial-panel" id="taiji-beidou-real-local-dogfooding-intake-panel" data-taiji-real-local-dogfooding-intake-panel="true" data-taiji-real-local-dogfooding-read-only="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase1451-1475</div>
                    <h3>${escapeHtml(taijiBeidouRealLocalDogfoodingIntakeCopy.title)}</h3>
                    <p>${escapeHtml(taijiBeidouRealLocalDogfoodingIntakeCopy.subtitle)}</p>
                  </div>
                  <span class="tour-chip">${escapeHtml(taijiBeidouRealLocalDogfoodingIntakeCopy.boundary)}</span>
                </div>
                <div class="mission-card-grid">
                  <article class="mission-card" data-taiji-dogfooding-intake-section="status">
                    <strong>Status</strong>
                    <div class="shield-list">${renderRows(taijiBeidouRealLocalDogfoodingIntakeCopy.status)}</div>
                  </article>
                  <article class="mission-card" data-taiji-dogfooding-intake-section="records">
                    <strong>Real Owner Records</strong>
                    <div class="shield-list">${renderRows(intakeRows)}</div>
                  </article>
                  <article class="mission-card" data-taiji-dogfooding-intake-section="issues">
                    <strong>Issue Severity</strong>
                    <div class="shield-list">${renderRows(issueRows)}</div>
                  </article>
                </div>
                <div class="comparison-grid">
                  <article class="comparison-card" data-taiji-dogfooding-intake-section="safety">
                    <div class="comparison-badge">Boundary</div>
                    <strong>No provider or secret expansion</strong>
                    <div class="shield-list">${renderRows(taijiBeidouRealLocalDogfoodingIntakeCopy.safety)}</div>
                  </article>
                  <article class="comparison-card" data-taiji-dogfooding-intake-section="severity-policy">
                    <div class="comparison-badge">Repair policy</div>
                    <strong>P0/P1 stay gated</strong>
                    <div class="shield-list">${renderRows(taijiBeidouRealLocalDogfoodingIntakeCopy.severity)}</div>
                  </article>
                </div>
                <div class="comparison-footer" data-taiji-dogfooding-intake-section="next-gates">
                  ${renderChips(taijiBeidouRealLocalDogfoodingIntakeCopy.nextGates)}
                </div>
              </section>`;
}

function renderRows(rows) {
  return rows.map(([label, value]) => `<span>${escapeHtml(label)} <strong>${escapeHtml(value)}</strong></span>`).join("");
}

function renderChips(items) {
  return items.map((item) => `<span class="tour-chip">${escapeHtml(item)}</span>`).join("");
}


function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


