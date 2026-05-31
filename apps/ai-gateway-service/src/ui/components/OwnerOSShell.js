import { renderOwnerDailyReportSurface } from "./OwnerDailyReportSurface.js";
import { renderOwnerAutomationCommandPalette } from "./OwnerAutomationCommandPalette.js";
import { renderOwnerAutomationResultCard } from "./OwnerAutomationResultCard.js";
import { renderOwnerHeroCommand } from "./OwnerHeroCommand.js";
import { renderOwnerPrimaryAction } from "./OwnerPrimaryAction.js";
import { renderOwnerTaskInput } from "./OwnerTaskInput.js";
import { renderOwnerSignalCard } from "./OwnerSignalCard.js";
import { renderOwnerNeuralSkillPreviewPanel } from "./OwnerNeuralSkillPreviewPanel.js";
import { renderFiveCapabilityActivationPanel } from "./FiveCapabilityActivationPanel.js";

function renderStateRail(states) {
  return states.map((state) => `<span>${state}</span>`).join("");
}

function renderReadinessMatrix(items) {
  return items
    .map(
      (item) => `
                    <div class="owner-readiness-item owner-readiness-${item.tone}">
                      <span>${item.label}</span>
                      <strong>${item.value}</strong>
                    </div>`,
    )
    .join("");
}

export function renderOwnerOSShell(copy) {
  return `
              <section class="owner-os-shell owner-boss-view" id="owner-boss-view-panel" data-owner-os-shell="true" data-owner-boss-view-entry="true" data-owner-boss-mode="one-button" aria-label="小天总控 OS">
                <span class="owner-os-ambient" aria-hidden="true"></span>
                <div class="owner-os-content">
${renderOwnerHeroCommand(copy)}
${renderOwnerTaskInput(copy)}
${renderOwnerPrimaryAction(copy)}
                  <div class="owner-readiness-matrix" data-owner-readiness-matrix="true" aria-label="真实可用状态矩�?>
${renderReadinessMatrix(copy.readinessItems)}
                  </div>
                  <div class="owner-os-feedback">
                    <div class="owner-feedback-line" id="owner-boss-view-feedback" role="status" aria-live="polite">
                      ${copy.waitingFeedback}
                    </div>
                    <div class="owner-state-rail" aria-label="按钮状�?>
${renderStateRail(copy.feedbackStates)}
                    </div>
                  </div>

                  <div class="owner-summary-grid" data-owner-daily-report="true" aria-label="老板日报三项结果">
${renderOwnerSignalCard({
  id: "owner-today-completed-card",
  kind: "today-completed",
  kicker: copy.completedKicker,
  title: copy.completedTitle,
  items: copy.completedItems,
})}
${renderOwnerSignalCard({
  id: "owner-problems-found-card",
  kind: "problems-found",
  kicker: copy.problemsKicker,
  title: copy.problemsTitle,
  items: copy.problemsItems,
})}
${renderOwnerSignalCard({
  id: "owner-next-action-card",
  kind: "next-action",
  kicker: copy.nextKicker,
  title: copy.nextTitle,
  items: copy.nextItems,
})}
                  </div>

${renderOwnerDailyReportSurface(copy)}
${renderFiveCapabilityActivationPanel()}
${renderOwnerNeuralSkillPreviewPanel()}
${renderOwnerAutomationResultCard(copy.ownerAutomationFileActionResult)}
${renderOwnerAutomationCommandPalette(copy.ownerAutomationCommandPalette)}

                  <div class="owner-action-log" aria-label="按钮反馈记录">
                    <strong>按钮反馈</strong>
                    <ul data-owner-action-log>
                      <li>未开始。点击主按钮后，这里会显示小天已经开始检查、检查完成、是否发现问题，以及下一步�?/li>
                    </ul>
                  </div>
                </div>
              </section>`;
}


