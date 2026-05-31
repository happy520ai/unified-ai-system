import { branchExecutionPreviewCopy } from "../copy/branchExecutionPreviewCopy.js";

export function renderBranchExecutionPreviewPanel() {
  const badges = branchExecutionPreviewCopy.boundaryBadges.map((badge) => `<span>${badge}</span>`).join("");
  const cards = branchExecutionPreviewCopy.cards
    .map(([title, body]) => `
                    <article class="branch-execution-card">
                      <strong>${title}</strong>
                      <p>${body}</p>
                    </article>`)
    .join("");

  return `
              <section class="branch-execution-preview-panel" id="branch-execution-preview-panel" data-branch-execution-preview="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">branch execution fabric</div>
                    <h3>${branchExecutionPreviewCopy.title}</h3>
                    <p>${branchExecutionPreviewCopy.subtitle}</p>
                  </div>
                  <span class="tour-chip">dry-run fabric only</span>
                </div>
                <div class="scenario-boundary-badges" aria-label="Branch execution safety boundaries">
                  ${badges}
                </div>
                <div class="branch-execution-grid" id="branch-execution-contract-grid">
                  ${cards}
                </div>
                <div class="branch-execution-flow-strip" id="branch-execution-flow">
                  <strong>Unified IO</strong>
                  <span>internal bus</span>
                  <span>branch fanout</span>
                  <span>load cap</span>
                  <span>dry-run execute</span>
                  <span>merge</span>
                  <span>failure ledger</span>
                  <span>evidence</span>
                </div>
                <div class="branch-execution-actions" aria-label="Branch execution preview actions">
                  <button type="button" data-branch-execution-action="plan">预览分支计划</button>
                  <button type="button" data-branch-execution-action="execute">预览 dry-run 执行</button>
                  <button type="button" data-branch-execution-action="merge">预览结果合并</button>
                  <button type="button" data-branch-execution-action="load">预览负载治理</button>
                  <button type="button" data-branch-execution-action="failure">预览故障注入</button>
                </div>
                <div class="branch-execution-result" id="branch-execution-result-panel" hidden>
                  <strong id="branch-execution-result-title">Branch execution preview result</strong>
                  <p id="branch-execution-result-copy">${branchExecutionPreviewCopy.previews.plan}</p>
                  <small id="branch-execution-boundary-line">providerCallsMade=false; rawSecretAccessed=false; secretValueExposed=false; realFeishuMessageSent=false; realWeComMessageSent=false; deployExecuted=false</small>
                </div>
              </section>`;
}


