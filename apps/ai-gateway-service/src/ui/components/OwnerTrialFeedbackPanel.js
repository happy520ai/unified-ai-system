import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ownerTrialFeedbackCopy } from "../copy/ownerTrialFeedbackCopy.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));

export function renderOwnerTrialFeedbackPanel() {
  const inputPath = "local-self-use/v1/owner-trial/owner-feedback.input.json";
  const inputExists = existsSync(resolve(repoRoot, inputPath));
  return `
              <section class="model-routing-panel" id="owner-trial-feedback-panel" data-readonly-panel="true" data-owner-feedback-collected="${inputExists ? "pending-authenticity-check" : "false"}">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase1151-1160</div>
                    <h3>${escapeHtml(ownerTrialFeedbackCopy.title)}</h3>
                  </div>
                  <span class="tour-chip">${inputExists ? "input detected" : "waiting for owner"}</span>
                </div>
                <p class="surface-muted">${escapeHtml(ownerTrialFeedbackCopy.subtitle)}</p>
                <p class="surface-muted">${escapeHtml(inputExists ? ownerTrialFeedbackCopy.statusReady : ownerTrialFeedbackCopy.statusMissing)}</p>
                <ul class="surface-muted">
${ownerTrialFeedbackCopy.guide.map((line) => `                  <li>${escapeHtml(line)}</li>`).join("\n")}
                </ul>
                <div class="codex-context-badges">
${ownerTrialFeedbackCopy.boundaries.map((line) => `                  <span>${escapeHtml(line)}</span>`).join("\n")}
                </div>
              </section>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}


