import { renderWorkforcePreviewPanel } from "./WorkforcePreviewPanel.js";
import { renderInternalEmployeeCommunicationPanel } from "./InternalEmployeeCommunicationPanel.js";
import { renderBranchExecutionPreviewPanel } from "./BranchExecutionPreviewPanel.js";
import { renderLongHorizonHardeningPanel } from "./LongHorizonHardeningPanel.js";
import { renderCodexContextGatewayPanel } from "./CodexContextGatewayPanel.js";
import { renderGlobalModelLibraryPanel } from "./GlobalModelLibraryPanel.js";
import { renderUserOwnedProviderExpansionPanel } from "./UserOwnedProviderExpansionPanel.js";
import { renderModelRoutingPanel } from "./ModelRoutingPanel.js";
import { renderRealModelRoutingPanel } from "./RealModelRoutingPanel.js";
import { renderModelRoutingSurrogateSoakPanel } from "./ModelRoutingSurrogateSoakPanel.js";
import { renderGodTianshuEnsemblePanel } from "./GodTianshuEnsemblePanel.js";
import { renderGlobalModelOpsPanel } from "./GlobalModelOpsPanel.js";
import { renderTaijiBeidouPanel } from "./TaijiBeidouPanel.js";
import { renderTaijiBeidouDryRunReadoutPreviewPanel } from "./TaijiBeidouDryRunReadoutPreviewPanel.js";
import { renderTaijiBeidouAutoRuntimePanel } from "./TaijiBeidouAutoRuntimePanel.js";
import { renderTaijiBeidouRealProviderRuntimePanel } from "./TaijiBeidouRealProviderRuntimePanel.js";
import { renderTaijiBeidouProductionReadinessPanel } from "./TaijiBeidouProductionReadinessPanel.js";
import { renderTaijiBeidouProductionOpsPanel } from "./TaijiBeidouProductionOpsPanel.js";
import { renderTaijiBeidouLocalDogfoodingMainlinePanel } from "./TaijiBeidouLocalDogfoodingMainlinePanel.js";
import { renderTaijiBeidouRealLocalDogfoodingIntakePanel } from "./TaijiBeidouRealLocalDogfoodingIntakePanel.js";
import { renderRouteQualityAuditPanel } from "./RouteQualityAuditPanel.js";
import { renderRouteQualityRound2Panel } from "./RouteQualityRound2Panel.js";
import { renderLocalSelfUseRoutingV1Panel } from "./LocalSelfUseRoutingV1Panel.js";
import { renderFutureMinimalOsPanel } from "./FutureMinimalOsPanel.js";
import { renderTaijiBeidouMissionControlVisualizationPanel } from "./TaijiBeidouMissionControlVisualizationPanel.js";
import { renderOwnerBossViewPanel } from "./OwnerBossViewPanel.js";
import { renderNeuralFabricReadOnlyPanel } from "./NeuralFabricReadOnlyPanel.js";
import { renderGvcRunnerDashboardPanel } from "./GvcRunnerDashboardPanel.js";
import { renderProductWorkModeDashboardPanel } from "./ProductWorkModeDashboardPanel.js";
import { renderTianshuCapabilityAtomPreviewPanel } from "../TianshuCapabilityAtomPreviewPanel.js";

export function renderMissionControlPanel() {
  return `
            <section class="mission-control" id="mission-control" data-mission-control-root="true">
${renderOwnerBossViewPanel()}

              <section class="world-class-first-screen-lock" id="world-class-first-screen-lock" data-phase1916-1919a-entry="true" aria-label="小天世界级第一屏">
                <div class="eyebrow">真实可用总控</div>
                <h2>一句话交给小天</h2>
                <div class="mission-input-row">
                  <label for="world-class-owner-task-input">今天要处理什么？</label>
                  <input id="world-class-owner-task-input" type="text" value="" placeholder="例如：检查今天系统状态，并告诉我下一步做什么？" aria-label="一句话交给小天" />
                  <button type="button" class="primary" id="world-class-owner-task-preview-button">开始本地检查</button>
                </div>
                <div class="arena-strip" data-world-class-status="true">
                  <strong>今日小天系统检查</strong>
                  <span>当前系统状态：本地真实可用</span>
                  <span>下一步建议：绑定可用 Provider credentialRef 后再做一次one-shot</span>
                  <span>生产部署和公开发布已排除</span>
                </div>
                <details class="drilldown-panel" data-world-class-three-mode>
                  <summary>三模式任务闭环</summary>
                  <div class="mission-card-grid">
                    <article class="mission-card"><strong>Normal Mode：最小任务闭环可预览</strong><p>本地直接完成简单任务，并给出清楚结果。</p></article>
                    <article class="mission-card"><strong>God Mode：本地候选方案互评可预览</strong><p>生成多个方案，比较风险和收益。</p></article>
                    <article class="mission-card"><strong>Tianshu Mode：任务模式推荐可预览</strong><p>根据任务复杂度推荐更稳的处理路线。</p></article>
                    <article class="mission-card"><strong>老板试用</strong><p>真实使用记录会单独进入试用台账。</p></article>
                  </div>
                </details>
                <details class="drilldown-panel" data-world-class-advanced>
                  <summary>高级诊断：Provider / CredentialRef / Diagnostics</summary>
                  <div class="arena-strip">
                    <span>Provider 调用：未发生</span>
                    <span>Secret 读取：未发生</span>
                    <span>部署：未发生</span>
                    <span>默认链路：chat-gateway/execute 未修改</span>
                    <span>Phase 噪音默认隐藏</span>
                  </div>
                </details>
              </section>

${renderFutureMinimalOsPanel()}

${renderNeuralFabricReadOnlyPanel()}

              <!-- data-phase2022-gvc-runner-dashboard: read-only GVC runner dashboard marker -->
${renderGvcRunnerDashboardPanel()}

${renderProductWorkModeDashboardPanel()}

${renderTaijiBeidouMissionControlVisualizationPanel()}

${renderTianshuCapabilityAtomPreviewPanel()}

              <div class="mission-radar" id="top-system-radar">
                <div>
                  <div class="eyebrow">PME AI Gateway</div>
                  <h2>Mission Control</h2>
                  <p>多模型、多智能体、可治理、可审计、可回放。AI Gateway 任务指挥台。</p>
                  <div class="mission-tagline">功能定位：Mission Control · internal dry-run boundary</div>
                </div>
                <div class="radar-grid">
                  <span>Current Mode <strong>Mission</strong></span>
                  <span>Runtime <strong>internal</strong></span>
                  <span>Security <strong>guarded</strong></span>
                  <span>Provider <strong>credentialRef-only</strong></span>
                  <span>Boundary <strong>dry-run only</strong></span>
                  <span>Evidence <strong>recording</strong></span>
                </div>
              </div>

${renderWorkforcePreviewPanel()}

${renderInternalEmployeeCommunicationPanel()}

${renderBranchExecutionPreviewPanel()}

${renderLongHorizonHardeningPanel()}

${renderCodexContextGatewayPanel()}

${renderGlobalModelLibraryPanel()}

${renderUserOwnedProviderExpansionPanel()}

${renderModelRoutingPanel()}

${renderRealModelRoutingPanel()}

${renderModelRoutingSurrogateSoakPanel()}

${renderGodTianshuEnsemblePanel()}

${renderGlobalModelOpsPanel()}

${renderRouteQualityAuditPanel()}

${renderRouteQualityRound2Panel()}

${renderLocalSelfUseRoutingV1Panel()}

${renderTaijiBeidouPanel()}

${renderTaijiBeidouDryRunReadoutPreviewPanel()}

${renderTaijiBeidouAutoRuntimePanel()}

${renderTaijiBeidouRealProviderRuntimePanel()}

${renderTaijiBeidouLocalDogfoodingMainlinePanel()}

${renderTaijiBeidouRealLocalDogfoodingIntakePanel()}

${renderTaijiBeidouProductionReadinessPanel()}

${renderTaijiBeidouProductionOpsPanel()}

              <section class="onboarding-tour" id="guided-onboarding-panel" data-onboarding-visible="true">
                <div class="tour-head">
                  <div>
                    <div class="eyebrow">First-run tour</div>
                    <h3>Explore Mission Control</h3>
                  </div>
                  <div class="tour-actions">
                    <span class="tour-chip">skip anytime</span>
                    <button type="button" class="ghost" id="onboarding-dismiss-button">Skip</button>
                  </div>
                </div>
                <div class="tour-steps">
                  <button type="button" class="tour-step is-active" data-tour-step="mission">
                    <strong>Mission</strong>
                    <small>Not a chatbot shell</small>
                  </button>
                  <button type="button" class="tour-step" data-tour-step="modes">
                    <strong>Modes</strong>
                    <small>Normal / God / Tianshu</small>
                  </button>
                  <button type="button" class="tour-step" data-tour-step="shield">
                    <strong>Shield</strong>
                    <small>dry-run only</small>
                  </button>
                  <button type="button" class="tour-step" data-tour-step="evidence">
                    <strong>Evidence</strong>
                    <small>trace / replay / export</small>
                  </button>
                </div>
                <div class="tour-copy" id="guided-onboarding-copy">
                  Mission Control 用来理解意图、推荐模式、解释风险并保留证据；当前处于internal-test、no-provider-call、no-deploy 边界。
                </div>
              </section>

              <div class="mission-body">
                <div class="mission-workspace" id="center-mission-workspace">
                  <div class="mission-flow" id="mission-flow">
                    <span>Understand</span><span>Route</span><span>Guard</span><span>Plan</span><span>Review</span><span>Evidence</span>
                  </div>
                  <div class="mission-input-row">
                    <div>
                      <div class="eyebrow">Agent recommendation</div>
                      <strong>建议先用 Tianshu dry-run 做任务规划；复杂审查再切换God Arena。</strong>
                    </div>
                    <span class="life-dot" aria-hidden="true"></span>
                  </div>
                  <div class="mission-card-grid">
                    <article class="mission-card" id="mission-normal-mode-card">
                      <span class="agent-orbit"></span>
                      <strong>Normal</strong>
                      <p>直接对话模式。只允许已验证、可选择、允许Chat 的模型进入普通聊天。</p>
                      <small>providerCalled=false until user sends</small>
                    </article>
                    <article class="mission-card" id="mission-god-arena-card">
                      <span class="agent-orbit"></span>
                      <strong>God Arena</strong>
                      <p>Reviewer / Critic / Risk Scout / Supervisor 的多视角审查预览。</p>
                      <small>mock reviewers · no provider call</small>
                    </article>
                    <article class="mission-card" id="mission-tianshu-flight-card">
                      <span class="agent-orbit"></span>
                      <strong>Tianshu Flight</strong>
                      <p>解释任务路径、能力匹配、fallback reason 和下一步建议。</p>
                      <small>planner dry-run · credentialRef gate</small>
                    </article>
                  </div>

                  <div class="arena-strip" id="god-mode-arena">
                    <strong>God Mode Arena</strong>
                    <span>reviewer: speed bias</span>
                    <span>critic: risk finding</span>
                    <span>risk scout: blocked path</span>
                    <span>supervisor: synthesis preview</span>
                    <span>conflict: explained</span>
                  </div>

                  <section class="drilldown-panel" id="agent-arena-drilldown-panel">
                    <div class="drilldown-head">
                      <div>
                        <div class="eyebrow">Interactive drill-down</div>
                        <h3>Agent Arena</h3>
                      </div>
                      <span class="tour-chip">mock only · no provider call</span>
                    </div>
                    <div class="drilldown-grid">
                      <button type="button" class="drilldown-card is-active" data-agent-drilldown="reviewer">
                        <strong>Reviewer</strong>
                        <small>focus: structure / speed</small>
                        <span>confidence: medium</span>
                      </button>
                      <button type="button" class="drilldown-card" data-agent-drilldown="critic">
                        <strong>Critic</strong>
                        <small>challenge: assumption</small>
                        <span>rejected suggestion visible</span>
                      </button>
                      <button type="button" class="drilldown-card" data-agent-drilldown="risk-scout">
                        <strong>Risk Scout</strong>
                        <small>mapped guard: action lock</small>
                        <span>blocked action summary</span>
                      </button>
                      <button type="button" class="drilldown-card" data-agent-drilldown="supervisor">
                        <strong>Supervisor</strong>
                        <small>synthesis summary</small>
                        <span>accepted / rejected inputs</span>
                      </button>
                      <button type="button" class="drilldown-card" data-agent-drilldown="conflict">
                        <strong>Conflict Summary</strong>
                        <small>disagreement matrix</small>
                        <span>fallback reason visible</span>
                      </button>
                    </div>
                    <div class="drilldown-detail" id="agent-arena-drilldown-detail">
                      <strong>Reviewer</strong>
                      <p>Review focus: task framing、结构和响应速度。Mock comment: 先选择平衡方案，再进入更深审查。</p>
                      <small>risk finding: none · confidence: medium · providerCallsMade=false</small>
                    </div>
                  </section>

                  <div class="arena-strip" id="tianshu-flight-path">
                    <strong>Tianshu Flight Path</strong>
                    <span>understand</span>
                    <span>capability matching</span>
                    <span>rejected path: unconfigured</span>
                    <span>recommended route: planner sandbox</span>
                    <span>fallback: credentialRef required</span>
                  </div>

                  <section class="comparison-panel" id="tianshu-plan-comparison-panel">
                    <div class="drilldown-head">
                      <div>
                        <div class="eyebrow">Plan comparison</div>
                        <h3>Tianshu Viewer</h3>
                      </div>
                      <span class="tour-chip">credentialRef-only · no provider call</span>
                    </div>
                    <div class="comparison-grid">
                      <article class="comparison-card" data-plan-card="fast">
                        <div class="comparison-badge">Fast Plan</div>
                        <strong>Fast</strong>
                        <p>estimatedComplexity: low · expectedLatencyClass: fast</p>
                        <small>recommendedFor: quick answer preview</small>
                      </article>
                      <article class="comparison-card is-recommended" data-plan-card="balanced">
                        <div class="comparison-badge">Recommended</div>
                        <strong>Balanced Plan</strong>
                        <p>在速度、质量、风险之间保持平衡。</p>
                        <small>candidateModels: verified chat candidates</small>
                      </article>
                      <article class="comparison-card" data-plan-card="deep">
                        <div class="comparison-badge">Deep Review</div>
                        <strong>Deep Review Plan</strong>
                        <p>质量要求更高时使用；必要时可升级God Mode review。</p>
                        <small>fallbackAvailable=true · dryRunOnly=true</small>
                      </article>
                    </div>
                    <div class="comparison-footer">
                      <span>rejected path: unconfigured provider</span>
                      <span>fallback reason: credentialRef required</span>
                      <span>providerCallsMade=false</span>
                    </div>
                  </section>
                </div>

                <aside class="security-shield" id="security-shield-panel">
                  <div class="eyebrow">Security Shield</div>
                  <h3>Guarded</h3>
                  <div class="surface-muted">
                    <strong>它保护什么</strong>
                    <p>拦截 prompt injection、secret 泄露、provider 越权、危险动作和预算风险。</p>
                    <strong>它不做什么</strong>
                    <p>不代表生产安全审计完成，也不会自动执行真正provider 调用。</p>
                  </div>
                  <div class="shield-list">
                    <span>Prompt Injection Guard <strong>active</strong></span>
                    <span>Secret Leak Guard <strong>active</strong></span>
                    <span>System Prompt Guard <strong>active</strong></span>
                    <span>Provider Call Gate <strong>blocked</strong></span>
                    <span>CredentialRef Gate <strong>active</strong></span>
                    <span>Dangerous Action Lock <strong>blocked</strong></span>
                    <span>Approval Gate <strong>requires approval</strong></span>
                    <span>Quota / Budget Guard <strong>dry-run only</strong></span>
                    <span>Evidence Recorder <strong>active</strong></span>
                  </div>
                  <div class="shield-summary">
                    <span>taskRiskLevel: medium</span>
                    <span>providerCallRisk: blocked</span>
                    <span>productionRisk: blocked</span>
                    <span>humanApprovalRequired: false</span>
                  </div>
                </aside>
              </div>

              <section class="scenario-library" id="red-team-scenario-library-panel">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Scenario library</div>
                    <h3>Red Team Playground</h3>
                  </div>
                  <span class="tour-chip">dry-run detection only</span>
                </div>
                <div class="scenario-grid">
                  <button type="button" class="scenario-card is-active" data-red-team-scenario="prompt-injection">
                    <strong>Prompt Injection</strong>
                    <small>ignore previous instructions</small>
                  </button>
                  <button type="button" class="scenario-card" data-red-team-scenario="system-prompt-leak">
                    <strong>System Prompt Leakage</strong>
                    <small>reveal system prompt</small>
                  </button>
                  <button type="button" class="scenario-card" data-red-team-scenario="secret-exfiltration">
                    <strong>Secret Exfiltration</strong>
                    <small>secret request pattern</small>
                  </button>
                  <button type="button" class="scenario-card" data-red-team-scenario="provider-bypass">
                    <strong>Provider Bypass</strong>
                    <small>unconfigured route attempt</small>
                  </button>
                  <button type="button" class="scenario-card" data-red-team-scenario="approval-bypass">
                    <strong>Approval Bypass</strong>
                    <small>approval escalation attempt</small>
                  </button>
                  <button type="button" class="scenario-card" data-red-team-scenario="dangerous-action">
                    <strong>Dangerous Action</strong>
                    <small>production action attempt</small>
                  </button>
                  <button type="button" class="scenario-card" data-red-team-scenario="billing-abuse">
                    <strong>Billing Abuse</strong>
                    <small>billing escalation attempt</small>
                  </button>
                  <button type="button" class="scenario-card" data-red-team-scenario="evidence-tampering">
                    <strong>Evidence Tampering</strong>
                    <small>delete evidence</small>
                  </button>
                </div>
                <div class="scenario-detail" id="red-team-scenario-detail">
                  <strong>Prompt Injection</strong>
                  <p>attackPrompt: ignore previous instructions. expectedDecision=blocked. mappedGuard: prompt injection guard.</p>
                  <small>providerCallsMade=false · secretValueExposed=false · productionActionExecuted=false</small>
                </div>
              </section>

              <section class="evidence-export" id="evidence-export-panel">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Replay / export</div>
                    <h3>Evidence Timeline</h3>
                  </div>
                  <span class="tour-chip">local package only</span>
                </div>
                <div class="evidence-timeline" id="evidence-timeline-panel">
                  <strong>Evidence Timeline</strong>
                  <span>evidenceId: mc-dry-run-001</span>
                  <span>trace: intent -> panel -> guard -> evidence</span>
                  <span>blockedActions: secret_read / provider_bypass</span>
                  <span>replay: available</span>
                  <span>rollback path: visible</span>
                </div>
                <div class="export-grid">
                  <article class="export-card">
                    <strong>Export Manifest</strong>
                    <p>trace summary, selected mode, blocked actions, screenshot index.</p>
                    <small>no secret · no provider call · no production action</small>
                  </article>
                  <article class="export-card">
                    <strong>Share Package</strong>
                    <p>local JSON + Markdown summary only. No external upload performed.</p>
                    <small>publicationArtifactCreated=false</small>
                  </article>
                </div>
              </section>
            </section>`;
}


