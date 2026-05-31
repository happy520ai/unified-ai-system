export function renderPreviewPlanPanel(copy) {
  const blocks = [
    ["推荐模式", copy.previewBlocks.mode, "future-os-recommended-mode"],
    ["我会做什么", copy.previewBlocks.willDo, "future-os-preview-will-do"],
    ["我不会做什么", copy.previewBlocks.willNotDo, ""],
    ["下一步", copy.previewBlocks.next, ""]
  ];

  return `
                <section class="future-preview-card future-preview-plan" id="future-os-preview-card" data-preview-visible="false" aria-live="polite">
                  <div class="future-preview-empty" id="future-os-preview-empty">${copy.preview.waiting}</div>
                  <div class="future-preview-body" id="future-os-preview-body" hidden>
                    <div class="future-preview-head">
                      <div>
                        <div class="eyebrow">${copy.preview.title}</div>
                        <h3>先看清楚，再继续</h3>
                      </div>
                      <span>未执行真实任务</span>
                    </div>
                    <div class="future-preview-grid">
                      ${blocks.map(([title, body, id]) => `
                        <div>
                          <strong>${title}</strong>
                          <p${id ? ` id="${id}"` : ""}>${body}</p>
                        </div>`).join("")}
                    </div>
                    <p id="future-os-preview-why" class="future-preview-reason">${copy.preview.defaultWhy}</p>
                    <button type="button" class="ghost future-detail-toggle" id="future-os-toggle-details" aria-expanded="false" aria-controls="future-os-details-panel">${copy.drawerCopy.openLabel}</button>
                  </div>
                </section>`;
}
