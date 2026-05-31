export function renderOwnerAdvancedDrawer(content) {
  return `
              <details class="future-advanced-system-details owner-advanced-system-details" id="owner-advanced-system-details" data-owner-advanced-mode="true" data-engineering-modules-collapsed="true">
                <summary>高级模式：查看本地工程细�?/summary>
                <div class="future-advanced-system-body">
                  <section class="owner-advanced-intro" aria-label="高级模式说明">
                    <strong>工程模块已默认折�?/strong>
                    <p>这里给开发和排查使用。老板日常只看上面的总控 OS 和老板日报�?/p>
                    <p>高级模式包含：Mission Control、Evidence Replay、Provider 保护状态、Context Gateway、Concept Field、Token Saving、阶段记录�?/p>
                  </section>
${content}
                </div>
              </details>`;
}



