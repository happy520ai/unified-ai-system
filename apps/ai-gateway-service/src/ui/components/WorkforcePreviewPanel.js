import { workforcePreviewCopy } from "../copy/workforcePreviewCopy.js";
import { renderPositionLibraryPanel } from "./PositionLibraryPanel.js";
import { renderEmployeePyramidPanel } from "./EmployeePyramidPanel.js";
import { renderWorkforceSchedulerPanel } from "./WorkforceSchedulerPanel.js";

export function renderWorkforcePreviewPanel() {
  const badges = workforcePreviewCopy.boundaryBadges.map((badge) => `<span>${badge}</span>`).join("");
  const statusCards = workforcePreviewCopy.status
    .map(([label, value]) => `
                    <article class="workforce-preview-card">
                      <strong>${label}</strong>
                      <p>${value}</p>
                    </article>`)
    .join("");
  const levels = workforcePreviewCopy.pyramidLevels.map((level) => `<span>${level}</span>`).join("");

  return `
              <section class="workforce-preview-panel" id="workforce-preview-panel" data-workforce-preview="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">本地劳动力编排</div>
                    <h3>${workforcePreviewCopy.title}</h3>
                    <p>${workforcePreviewCopy.subtitle}</p>
                  </div>
                  <span class="tour-chip">本地真实编排 / Provider 受控</span>
                </div>
                <div class="scenario-boundary-badges" aria-label="Workforce local run safety boundaries">
                  ${badges}
                </div>
                <div class="workforce-preview-grid" id="workforce-preview-status-grid">
                  ${statusCards}
                </div>
                <div class="workforce-preview-grid" id="workforce-product-ui-grid">
                  ${renderPositionLibraryPanel()}
                  ${renderEmployeePyramidPanel()}
                  ${renderWorkforceSchedulerPanel()}
                  <section class="workforce-preview-card" id="brain-adapter-boundary-panel">
                    <strong>大脑接入边界</strong>
                    <p>本地 Workforce 执行只做编排、计划保存、任务队列和证据写入；Provider 调用必须走单独授权。</p>
                    <small>providerCallsMade=false / secretValueExposed=false / 不读取密钥</small>
                  </section>
                </div>
                <label class="workforce-task-input" for="workforce-dry-run-task-input">
                  <strong>Workforce 本地执行目标</strong>
                  <textarea id="workforce-dry-run-task-input">${workforcePreviewCopy.dryRunSummary.task}</textarea>
                </label>
                <div class="workforce-pyramid-preview" id="workforce-pyramid-preview">
                  <strong>Employee Pyramid levels</strong>
                  <div class="workforce-level-row">${levels}</div>
                </div>
                <div class="workforce-preview-actions" aria-label="Workforce local run actions">
                  <button type="button" data-workforce-action="positions">查看职位库</button>
                  <button type="button" data-workforce-action="pyramid">查看员工金字塔</button>
                  <button type="button" class="primary" id="run-workforce-dry-run-button" data-workforce-action="real-local-run">运行 Workforce 本地执行</button>
                  <button type="button" data-workforce-action="evidence">查看执行证据</button>
                  <button type="button" data-workforce-action="brain-boundary">查看大脑接入边界</button>
                </div>
                <div class="workforce-preview-result" id="workforce-preview-result-panel" hidden>
                  <strong>Workforce 本地执行结果</strong>
                  <p id="workforce-run-status-panel">等待本地执行。</p>
                  <p id="selected-employees-panel">Selected employees: ${workforcePreviewCopy.dryRunSummary.selected}</p>
                  <p id="rejected-employees-panel">Boundary: ${workforcePreviewCopy.dryRunSummary.rejected}</p>
                  <p id="workforce-run-safety-panel">providerCallsMade=false; secretValueExposed=false; 不读取密钥</p>
                  <small id="workforce-evidence-timeline-panel">Evidence timeline: input -> plan -> save -> queue -> completed tasks -> phase1961a evidence.</small>
                  <p id="workforce-final-plan-panel">Final local run: waiting for /workforce/run-local.</p>
                </div>
              </section>`;
}


