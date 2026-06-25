const ownerNeuralSkillPreview = Object.freeze({
  skillCount: 3,
  activeMockSkillCount: 2,
  revokedMockSkillCount: 1,
  registryMode: "mock skill registry",
});

export function renderOwnerNeuralSkillPreviewPanel() {
  return `
                  <section class="owner-neural-skill-preview" data-owner-os-neural-skill-preview="true" data-neural-skill-preview-readonly="true" aria-label="Neural Skill Preview">
                    <div class="owner-neural-skill-preview-heading">
                      <span>Neural Skill Preview</span>
                      <strong>只读预览</strong>
                    </div>
                    <p class="owner-neural-skill-preview-summary">
                      这里展示本地 Neural Skill 的预览状态，来自 ${ownerNeuralSkillPreview.registryMode}，不会启动真实模型，也不会接入主链路                    </p>
                    <div class="owner-neural-skill-preview-grid">
                      <div>
                        <span>当前没有真实训练</span>
                        <strong>realTrainingEnabled=false</strong>
                      </div>
                      <div>
                        <span>当前没有接主链</span>
                        <strong>mainChainIntegrated=false</strong>
                      </div>
                      <div>
                        <span>当前为dry-run / inference-only preview</span>
                        <strong>providerCallsMade=false</strong>
                      </div>
                    </div>
                    <p class="owner-neural-skill-preview-note">
                      mock skills=${ownerNeuralSkillPreview.skillCount}; active=${ownerNeuralSkillPreview.activeMockSkillCount}; revoked=${ownerNeuralSkillPreview.revokedMockSkillCount}; secretRead=false
                    </p>
                  </section>`;
}


