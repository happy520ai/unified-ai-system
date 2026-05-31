export function renderProgressiveDisclosurePanel({ copy, detailModules, diagnosticsModules }) {
  return `
                <section class="future-details-drawer future-progressive-panel" id="future-os-details-panel" data-details-open="false" hidden>
                  <div class="future-details-head">
                    <div>
                      <div class="eyebrow">${copy.drawerCopy.title}</div>
                      <h3>${copy.drawerCopy.subtitle}</h3>
                    </div>
                    <button type="button" class="ghost" id="future-os-close-details">${copy.drawerCopy.closeLabel}</button>
                  </div>
                  <div class="future-details-grid">
                    <details>
                      <summary>Security Boundary</summary>
                      <div class="future-module-card" id="future-security-shield-module">
                        <small>safe-preview-only</small>
                        <p>本屏只做预案：不调用 Provider，不读取 secret，不部署，不改变默认聊天链路。</p>
                      </div>
                    </details>
${detailModules.join("")}
                    <details>
                      <summary>Local evidence preview</summary>
                      <div class="future-module-card" id="future-dry-run-trace-module">
                        <small>local-only evidence preview</small>
                        <p>只记录 UI 意图、推荐模式和安全边界，用于之后人工确认。</p>
                      </div>
                    </details>
${diagnosticsModules.join("")}
                  </div>
                </section>`;
}
