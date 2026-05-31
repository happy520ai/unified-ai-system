const capabilityCards = [
  {
    id: "workforce",
    title: "Workforce 计划生成",
    status: "本地真实执行",
    copy: "??????????????????????",
  },
  {
    id: "threeMode",
    title: "Three-Mode ???",
    status: "???????",
    copy: "Normal?God?Tianshu ?????????? Provider ??????????????",
  },
  {
    id: "taijiBeidou",
    title: "Taiji / Beidou 引擎",
    status: "本地沙箱运行",
    copy: "????????????????????",
  },
  {
    id: "gvc",
    title: "GVC 自主运行",
    status: "受控真实写入",
    copy: "?????? evidence ????????????????",
  },
  {
    id: "codex",
    title: "Codex 集成",
    status: "CLI ????",
    copy: "???? Codex CLI???????????????? auth.json??????",
  },
];

export function renderFiveCapabilityActivationPanel() {
  return `
                  <section class="five-capability-panel" id="five-capability-activation-panel" data-five-capability-activation="true" data-real-capability-panel="true" aria-label="??????????">
                    <div class="five-capability-head">
                      <div>
                        <div class="eyebrow">Real Capability Core</div>
                        <h3>五大能力已进入真实可用通道</h3>
                        <p>????????????????????Provider????????????????????????</p>
                      </div>
                      <button type="button" class="owner-primary-cta five-capability-run" id="activate-five-capabilities-button" data-five-capability-action="activate">
                         <span>????????</span>
                         <small>??????????? Codex CLI</small>
                      </button>
                    </div>
                    <div class="five-capability-grid" data-five-capability-grid="true">
${capabilityCards.map(renderCapabilityCard).join("")}
                    </div>
                    <div class="five-capability-result" id="five-capability-result-panel" data-five-capability-result="true" hidden>
                      <strong id="five-capability-result-title">????</strong>
                      <p id="five-capability-result-copy">????????????????????? Phase1962A evidence?</p>
                      <div class="five-capability-result-grid">
                        <span id="five-capability-workforce-status">Workforce: waiting</span>
                        <span id="five-capability-three-mode-status">Three-Mode: waiting</span>
                        <span id="five-capability-taiji-status">Taiji/Beidou: waiting</span>
                        <span id="five-capability-gvc-status">GVC: waiting</span>
                        <span id="five-capability-codex-status">Codex: waiting</span>
                      </div>
                    </div>
                    <details class="owner-automation-advanced-record" data-five-capability-evidence="true">
                      <summary>???????</summary>
                      <p>???? apps/ai-gateway-service/evidence/phase1962a/????????????? commit?? push???????????? /chat ? /chat-gateway/execute?</p>
                    </details>
                  </section>`;
}

function renderCapabilityCard(item) {
  return `
                      <article class="five-capability-card" data-five-capability-id="${item.id}">
                        <strong>${item.title}</strong>
                        <span>${item.status}</span>
                        <p>${item.copy}</p>
                      </article>`;
}


