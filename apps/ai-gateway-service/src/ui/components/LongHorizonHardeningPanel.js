import { longHorizonHardeningCopy } from "../copy/longHorizonHardeningCopy.js";

export function renderLongHorizonHardeningPanel() {
  const badges = longHorizonHardeningCopy.boundaryBadges.map((badge) => `<span>${badge}</span>`).join("");
  const cards = longHorizonHardeningCopy.cards
    .map(([title, body]) => `
                    <article class="hardening-preview-card">
                      <strong>${title}</strong>
                      <p>${body}</p>
                    </article>`)
    .join("");

  return `
              <section class="long-horizon-hardening-panel" id="long-horizon-hardening-panel" data-long-horizon-hardening-preview="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase579-591 hardening</div>
                    <h3>${longHorizonHardeningCopy.title}</h3>
                    <p>${longHorizonHardeningCopy.subtitle}</p>
                  </div>
                  <span class="tour-chip">no-provider-call</span>
                </div>
                <div class="scenario-boundary-badges" aria-label="Long-horizon hardening safety boundaries">
                  ${badges}
                </div>
                <div class="hardening-preview-grid" id="hardening-preview-grid">
                  ${cards}
                </div>
                <div class="hardening-flow-strip" id="hardening-flow">
                  <strong>Unified IO</strong>
                  <span>scenario matrix</span>
                  <span>load governance</span>
                  <span>trace query</span>
                  <span>safety gate</span>
                  <span>adapter readiness</span>
                  <span>soak</span>
                  <span>acceptance</span>
                </div>
                <div class="hardening-preview-actions" aria-label="Long-horizon hardening preview actions">
                  <button type="button" data-hardening-action="scenario">场景矩阵</button>
                  <button type="button" data-hardening-action="load">负载治理</button>
                  <button type="button" data-hardening-action="trace">Trace 查询</button>
                  <button type="button" data-hardening-action="safety">安全门禁</button>
                  <button type="button" data-hardening-action="adapter">Adapter readiness</button>
                  <button type="button" data-hardening-action="soak">Soak / Chaos</button>
                </div>
                <div class="hardening-preview-result" id="hardening-preview-result-panel" hidden>
                  <strong id="hardening-preview-result-title">Long-horizon hardening preview result</strong>
                  <p id="hardening-preview-result-copy">${longHorizonHardeningCopy.previews.scenario}</p>
                  <small id="hardening-preview-boundary-line">providerCallsMade=false; rawSecretAccessed=false; rawWebhookAccessed=false; realFeishuMessageSent=false; realWeComMessageSent=false; chatModified=false; chatGatewayExecuteModified=false; deployExecuted=false</small>
                </div>
              </section>`;
}


