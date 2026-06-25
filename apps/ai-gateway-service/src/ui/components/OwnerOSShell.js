import { renderOwnerSignalCard } from "./OwnerSignalCard.js";

function renderStateRail(states) {
  return states.map((state) => `<span>${state}</span>`).join("");
}

export function renderOwnerOSShell(copy) {
  return `
              <section class="owner-os-shell owner-boss-view" id="owner-boss-view-panel" data-owner-os-shell="true" data-owner-boss-view-entry="true" data-owner-boss-mode="one-button" aria-label="小天总控 OS">
                <div class="owner-os-content">

                  <div class="wb-greeting">
                    <div class="wb-greeting-text">
                      <h2 class="wb-greeting-title" id="wb-greeting-title">总控台</h2>
                      <p class="wb-greeting-summary" id="wb-greeting-summary">正在加载系统状态…</p>
                    </div>
                    <div class="wb-greeting-actions">
                      <button type="button" class="primary wb-run-check-btn" data-owner-boss-action="run-today-check">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 8a6 6 0 1112 0A6 6 0 012 8z"/><path d="M6.5 5.5l4 2.5-4 2.5V5.5z"/></svg>
                        启动检查
                      </button>
                    </div>
                  </div>

                  <div class="owner-os-feedback">
                    <div class="owner-feedback-line" id="owner-boss-view-feedback" role="status" aria-live="polite">
                      ${copy.waitingFeedback}
                    </div>
                    <div class="owner-state-rail" aria-label="按钮状态">
${renderStateRail(copy.feedbackStates)}
                    </div>
                  </div>

                  <div class="owner-summary-grid" data-owner-daily-report="true" aria-label="日报三项结果">
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

                </div>
              </section>`;
}
