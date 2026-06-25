// CodexContextGatewayPanel - HTML template (second half: Phase607R - Phase650R + actions + detail)
import { escapeHtml } from "./CodexContextGatewayPanel-utils.js";

export function renderTemplateB(d,
  interactiveTerminalIntake, codexExecIntake,
  repeatedReliabilityDesign, repeatedGuardedTestDesign, repeatedGuardedTestResult,
  repeatedReliabilityClosure, controlledIntegrationPreviewGate,
  runtimeIntegrationApprovalPacket, runtimeCandidateDryRunBundle,
  controlledRuntimeCandidatePath, mainChainFinalApprovalPacket, mainChainDesignPatch,
  phase639RP1ApprovalPreview, phase639RNightlyFallbackPanel,
  phase640RNightlyPermissionedRetryPack, phase641RNightlyRegistrationResultIntake,
  phase640RExternalToolMode, phase641R645RExternalToolBundle, phase646R650RExternalToolClosure,
  detailPayload) {

  const { interactiveTerminalIntakeRows, codexExecIntakeRows,
    repeatedReliabilityRows, repeatedGuardedTestRows, repeatedGuardedResultRows,
    repeatedClosureRows, controlledIntegrationGateRows, runtimeApprovalRows,
    runtimeCandidateDryRunRows, controlledRuntimeCandidateRows,
    controlledRuntimeCandidateBoundaryRows, mainChainFinalApprovalRows,
    mainChainFinalBoundaryRows, mainChainDesignPatchRows,
    mainChainDesignPatchBoundaryRows, phase639rP1ApprovalRows,
    phase639rNightlyFallbackRows, phase640rNightlyPermissionedRetryRows,
    phase641rNightlyRegistrationRows, phase640rExternalToolRows,
    phase641r645rExternalToolRows, phase646r650rExternalToolRows, actions } = d;

  return `
                <div class="codex-context-preview-grid" id="codex-phase607r-interactive-terminal-intake-section" data-codex-phase607r-interactive-terminal-intake="true" data-codex-phase607r-manual-route="true" data-codex-phase607r-config-write-false="true">
                  <article class="codex-context-preview-card" id="codex-phase607r-status-card">
                    <div><strong>Phase607R-Fix Manual Intake</strong><small>${escapeHtml(interactiveTerminalIntake.blocker || "no blocker")}</small></div>
                    <p>oneShotExecutionIntakeCompleted=${String(interactiveTerminalIntake.oneShotExecutionIntakeCompleted)}; codexOneShotExecutedByThisPhase=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase607r-route-card">
                    <div><strong>Manual Interactive Route</strong><small>${escapeHtml(interactiveTerminalIntake.route)}</small></div>
                    <p>selectedProviderId=${escapeHtml(interactiveTerminalIntake.selectedProviderId || "not selected")}; manualResultInputExists=${String(interactiveTerminalIntake.manualResultInputExists)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase607r-classification-card">
                    <div><strong>Response Classification</strong><small>${escapeHtml(interactiveTerminalIntake.responseClassification)}</small></div>
                    <p>testStatus=${escapeHtml(interactiveTerminalIntake.testStatus)}; requestAttemptCount=${interactiveTerminalIntake.requestAttemptCount}; retryAttemptCount=${interactiveTerminalIntake.retryAttemptCount}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase607r-cleanup-card">
                    <div><strong>Cleanup / Config</strong><small>${escapeHtml(interactiveTerminalIntake.cleanupStatus)}</small></div>
                    <ul>${interactiveTerminalIntakeRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase607r-boundary-card">
                    <div><strong>Safety Boundary</strong><small>intake only</small></div>
                    <p>authJsonRead=false; rawBaseUrlValueExposed=false; secretValueExposed=false; providerCallsMadeByThisPhase=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase607r-next-card">
                    <div><strong>Next Action</strong><small>${escapeHtml(interactiveTerminalIntake.nextAction)}</small></div>
                    <p>chatModified=false; chatGatewayExecuteModified=false; deploy/release/tag/push/commit=false</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase610r-codex-exec-intake-section" data-codex-phase610r-codex-exec-intake="true" data-codex-phase610r-one-shot-pass-once="true" data-codex-phase610r-no-chat-integration="true">
                  <article class="codex-context-preview-card" id="codex-phase610r-status-card">
                    <div><strong>Phase610R-Fix Codex Exec Intake</strong><small>${escapeHtml(codexExecIntake.blocker || "no blocker")}</small></div>
                    <p>${escapeHtml(codexExecIntake.status)}; codexOneShotExecutedByThisPhase=false; providerCallsMadeByThisPhase=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase610r-provider-card">
                    <div><strong>Selected Provider</strong><small>${escapeHtml(codexExecIntake.selectedProviderId || "not selected")}</small></div>
                    <p>requestAttemptCount=${codexExecIntake.requestAttemptCount}; retryAttemptCount=${codexExecIntake.retryAttemptCount}; responseClassification=${escapeHtml(codexExecIntake.responseClassification)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase610r-boundary-card">
                    <div><strong>Boundary</strong><small>not production ready</small></div>
                    <ul>${codexExecIntakeRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase610r-next-card">
                    <div><strong>Next Action</strong><small>${escapeHtml(codexExecIntake.nextAction)}</small></div>
                    <p>repeatedReliabilityProven=false; chatIntegrationComplete=false; releaseReadyClaimed=false</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase611r-reliability-design-section" data-codex-phase611r-reliability-design="true" data-codex-phase611r-not-executed="true" data-codex-phase611r-no-chat-integration="true">
                  <article class="codex-context-preview-card" id="codex-phase611r-status-card">
                    <div><strong>Phase611R-Fix Reliability Design</strong><small>${escapeHtml(repeatedReliabilityDesign.blocker || "no blocker")}</small></div>
                    <p>designOnly=true; repeatedReliabilityProven=false; codexOneShotExecutedByThisPhase=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase611r-plan-card">
                    <div><strong>Attempt Plan</strong><small>maxPlannedAttempts=${repeatedReliabilityDesign.maxPlannedAttempts}</small></div>
                    <p>maxRequests=1 per attempt; retryLimit=0; explicit confirmation required; stopOnFailure=true</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase611r-boundary-card">
                    <div><strong>Readiness Boundary</strong><small>not release ready</small></div>
                    <ul>${repeatedReliabilityRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase611r-next-card">
                    <div><strong>Next Action</strong><small>${escapeHtml(repeatedReliabilityDesign.nextAction)}</small></div>
                    <p>providerCallsMadeByThisPhase=false; providerRuntimeModified=false; productionReadyClaimed=false</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase611r-guarded-test-design-section" data-codex-phase611r-guarded-test-design="true" data-codex-phase612-explicit-confirmation-required="true" data-codex-phase611r-max-requests-total="3">
                  <article class="codex-context-preview-card" id="codex-phase611r-guarded-status-card">
                    <div><strong>Phase611R-Fix Guarded Test Design</strong><small>${escapeHtml(repeatedGuardedTestDesign.blocker || "no blocker")}</small></div>
                    <p>designOnly=true; codexExecExecutedByThisPhase=false; providerCallsMadeByThisPhase=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase611r-guarded-budget-card">
                    <div><strong>Budget / Attempts</strong><small>maxRequestsTotal=${repeatedGuardedTestDesign.maxRequestsTotal}</small></div>
                    <p>maxPlannedAttempts=${repeatedGuardedTestDesign.maxPlannedAttempts}; maxRequestsPerAttempt=1; retryLimitPerAttempt=0; stopOnFirstFailure=true</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase611r-guarded-gate-card">
                    <div><strong>Phase612 Gate</strong><small>explicit confirmation required</small></div>
                    <ul>${repeatedGuardedTestRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase611r-guarded-next-card">
                    <div><strong>Next Action</strong><small>${escapeHtml(repeatedGuardedTestDesign.nextAction)}</small></div>
                    <p>notProductionReady=true; notReleaseReady=true; notChatIntegrated=true</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase612r-repeated-result-section" data-codex-phase612r-repeated-result="true" data-codex-phase612r-no-chat-integration="true" data-codex-phase612r-not-production-ready="true">
                  <article class="codex-context-preview-card" id="codex-phase612r-status-card">
                    <div><strong>Phase612R-Fix Reliability Result</strong><small>${escapeHtml(repeatedGuardedTestResult.blocker || "no blocker")}</small></div>
                    <p>selectedProviderId=${escapeHtml(repeatedGuardedTestResult.selectedProviderId)}; repeatedReliabilityClassification=${escapeHtml(repeatedGuardedTestResult.repeatedReliabilityClassification)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase612r-attempts-card">
                    <div><strong>Attempts</strong><small>${repeatedGuardedTestResult.completedAttempts}/${repeatedGuardedTestResult.plannedAttempts}</small></div>
                    <ul>${repeatedGuardedResultRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase612r-boundary-card">
                    <div><strong>Boundary</strong><small>not production ready</small></div>
                    <p>authJsonRead=false; codexConfigModified=false; chatModified=false; chatGatewayExecuteModified=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase612r-next-card">
                    <div><strong>Next Action</strong><small>${escapeHtml(repeatedGuardedTestResult.nextAction)}</small></div>
                    <p>notReleaseReady=true; notChatIntegrated=true; workspaceCleanClaimed=false</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase613r-closure-section" data-codex-phase613r-closure="true" data-codex-phase613r-next-gate-design="true" data-codex-phase613r-no-chat-integration="true">
                  <article class="codex-context-preview-card" id="codex-phase613r-status-card">
                    <div><strong>Phase613R-Fix Boundary Closure</strong><small>${escapeHtml(repeatedReliabilityClosure.blocker || "no blocker")}</small></div>
                    <p>scope=${escapeHtml(repeatedReliabilityClosure.capabilityBoundary)}; selectedProviderId=${escapeHtml(repeatedReliabilityClosure.selectedProviderId)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase613r-proof-card">
                    <div><strong>Repeated Pass Closure</strong><small>${repeatedReliabilityClosure.completedAttempts}/3</small></div>
                    <ul>${repeatedClosureRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase613r-next-gate-card">
                    <div><strong>Next Gate</strong><small>separate phase required</small></div>
                    <p>${escapeHtml(repeatedReliabilityClosure.nextGate)}; UI read-only preview first</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase613r-boundary-card">
                    <div><strong>Non-Claims</strong><small>not release ready</small></div>
                    <p>notProductionReady=true; notReleaseReady=true; notChatGatewayExecuteIntegrated=true</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase614r-preview-gate-section" data-codex-phase614r-preview-gate="true" data-codex-phase614r-read-only-preview="true" data-codex-phase614r-no-runtime-integration="true">
                  <article class="codex-context-preview-card" id="codex-phase614r-status-card">
                    <div><strong>Phase614R-Fix Preview Gate</strong><small>${escapeHtml(controlledIntegrationPreviewGate.blocker || "no blocker")}</small></div>
                    <p>previewOnly=true; runtimeIntegrated=false; routeId=${escapeHtml(controlledIntegrationPreviewGate.routeId)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase614r-contract-card">
                    <div><strong>Route Contract</strong><small>${escapeHtml(controlledIntegrationPreviewGate.integrationMode)}</small></div>
                    <ul>${controlledIntegrationGateRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase614r-boundary-card">
                    <div><strong>Forbidden Entry Points</strong><small>main chain blocked</small></div>
                    <p>/chat=false; /chat-gateway/execute=false; provider_runtime=false; production_router=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase614r-next-card">
                    <div><strong>Next Phase</strong><small>${escapeHtml(controlledIntegrationPreviewGate.nextAction)}</small></div>
                    <p>Phase615R-Fix approval packet only; no direct runtime integration</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase615r-approval-packet-section" data-codex-phase615r-approval-packet="true" data-codex-phase615r-read-only-preview="true" data-codex-phase615r-no-runtime-integration="true">
                  <article class="codex-context-preview-card" id="codex-phase615r-status-card">
                    <div><strong>Phase615R-Fix Approval Packet</strong><small>${escapeHtml(runtimeIntegrationApprovalPacket.blocker || "no blocker")}</small></div>
                    <p>approvalPacketReady=${runtimeIntegrationApprovalPacket.approvalPacketReady}; selectedProviderId=${escapeHtml(runtimeIntegrationApprovalPacket.selectedProviderId)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase615r-policy-card">
                    <div><strong>Policy Packet</strong><small>approval required</small></div>
                    <ul>${runtimeApprovalRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase615r-boundary-card">
                    <div><strong>Runtime Boundary</strong><small>not integrated</small></div>
                    <p>/chat=false; /chat-gateway/execute=false; providerRuntimeModified=false; codexExecExecutedByThisPhase=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase615r-next-card">
                    <div><strong>Next Phase</strong><small>${escapeHtml(runtimeIntegrationApprovalPacket.nextPhase)}</small></div>
                    <p>Phase616R-Fix route contract dry-run only; providerCallsMadeByThisPhase=false</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase616r-620r-dry-run-candidate-section" data-codex-phase616r-620r-dry-run-candidate="true" data-codex-phase616r-620r-read-only-preview="true" data-codex-phase616r-620r-no-runtime-integration="true">
                  <article class="codex-context-preview-card" id="codex-phase616r-620r-status-card">
                    <div><strong>Phase616R-620R Dry-Run Candidate</strong><small>${escapeHtml(runtimeCandidateDryRunBundle.blocker || "no blocker")}</small></div>
                    <p>candidateMode=${escapeHtml(runtimeCandidateDryRunBundle.candidateMode)}; selectedProviderId=${escapeHtml(runtimeCandidateDryRunBundle.selectedProviderId)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase616r-620r-contract-card">
                    <div><strong>Route Contract Dry-Run</strong><small>${escapeHtml(runtimeCandidateDryRunBundle.routeId)}</small></div>
                    <ul>${runtimeCandidateDryRunRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase616r-620r-boundary-card">
                    <div><strong>Main Chain Boundary</strong><small>still blocked</small></div>
                    <p>/chat=false; /chat-gateway/execute=false; providerRuntimeModified=false; providerCallsMadeByThisPhase=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase616r-620r-next-card">
                    <div><strong>Next Gate</strong><small>${escapeHtml(runtimeCandidateDryRunBundle.nextPhase)}</small></div>
                    <p>Implementation plan review only; no direct runtime wiring, no deploy, no release</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase621r-628r-runtime-candidate-section" data-codex-phase621r-628r-runtime-candidate="true" data-codex-phase621r-628r-isolated-candidate="true" data-codex-phase621r-628r-no-chat-integration="true" data-codex-phase621r-628r-no-provider-call="true">
                  <article class="codex-context-preview-card" id="codex-phase621r-628r-status-card">
                    <div><strong>Phase621R-628R Isolated Candidate Path</strong><small>${escapeHtml(controlledRuntimeCandidatePath.blocker || "no blocker")}</small></div>
                    <p>selectedProviderId=${escapeHtml(controlledRuntimeCandidatePath.selectedProviderId)}; isolatedRuntimeCandidateWired=${String(controlledRuntimeCandidatePath.isolatedRuntimeCandidateWired)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase621r-628r-reliability-card">
                    <div><strong>Dry-Run Smoke + Guarded Local Reliability</strong><small>${escapeHtml(controlledRuntimeCandidatePath.repeatedReliabilityClassification)}</small></div>
                    <ul>${controlledRuntimeCandidateRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase621r-628r-boundary-card">
                    <div><strong>Runtime Boundary</strong><small>isolated candidate only</small></div>
                    <ul>${controlledRuntimeCandidateBoundaryRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase621r-628r-next-card">
                    <div><strong>Next Gate</strong><small>${escapeHtml(controlledRuntimeCandidatePath.nextPhase)}</small></div>
                    <p>Controlled implementation review only; no direct /chat wiring, no provider runtime modification, no deploy, no release.</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase629r-final-approval-section" data-codex-phase629r-final-approval="true" data-codex-phase629r-read-only-preview="true" data-codex-phase629r-no-main-chain-integration="true" data-codex-phase629r-no-runtime-button="true">
                  <article class="codex-context-preview-card" id="codex-phase629r-status-card">
                    <div><strong>Phase629R-Fix Final Human Approval Packet</strong><small>${escapeHtml(mainChainFinalApprovalPacket.blocker || "no blocker")}</small></div>
                    <p>selectedProviderId=${escapeHtml(mainChainFinalApprovalPacket.selectedProviderId)}; approvalPacketReady=${String(mainChainFinalApprovalPacket.approvalPacketReady)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase629r-readiness-card">
                    <div><strong>Main-Chain Approval Readiness</strong><small>design authorization only</small></div>
                    <ul>${mainChainFinalApprovalRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase629r-boundary-card">
                    <div><strong>Main-Chain Boundary</strong><small>not integrated</small></div>
                    <ul>${mainChainFinalBoundaryRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase629r-next-card">
                    <div><strong>Next Gate</strong><small>${escapeHtml(mainChainFinalApprovalPacket.nextPhase)}</small></div>
                    <p>Phase630R-Fix design patch only; no direct /chat wiring, no /chat-gateway/execute mutation, no provider runtime modification.</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase630r-design-patch-section" data-codex-phase630r-design-patch="true" data-codex-phase630r-read-only-preview="true" data-codex-phase630r-patch-not-applied="true" data-codex-phase630r-no-runtime-button="true">
                  <article class="codex-context-preview-card" id="codex-phase630r-status-card">
                    <div><strong>Phase630R-Fix Design Patch</strong><small>${escapeHtml(mainChainDesignPatch.blocker || "no blocker")}</small></div>
                    <p>selectedProviderId=${escapeHtml(mainChainDesignPatch.selectedProviderId)}; designPatchReady=${String(mainChainDesignPatch.designPatchReady)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase630r-route-preview-card">
                    <div><strong>Route Patch Preview</strong><small>${escapeHtml(mainChainDesignPatch.patchMode)}</small></div>
                    <ul>${mainChainDesignPatchRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase630r-boundary-card">
                    <div><strong>Patch Boundary</strong><small>not applied</small></div>
                    <ul>${mainChainDesignPatchBoundaryRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase630r-next-card">
                    <div><strong>Next Gate</strong><small>${escapeHtml(mainChainDesignPatch.nextPhase)}</small></div>
                    <p>Phase631R-Fix isolated implementation patch candidate only; feature flag off by default; no Provider call.</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase639r-p1-approval-section" data-codex-phase639r-p1-approval-preview="true" data-codex-phase639r-read-only-preview="true" data-codex-phase639r-no-implementation="true" data-codex-phase639r-no-runtime-button="true">
                  <article class="codex-context-preview-card" id="codex-phase639r-status-card">
                    <div><strong>Phase639R P1 Approval Preview</strong><small>${escapeHtml(phase639RP1ApprovalPreview.blocker || "no blocker")}</small></div>
                    <p>mainChainApprovalPacketReady=${String(phase639RP1ApprovalPreview.mainChainApprovalPacketReady)}; providerRuntimeApprovalPacketReady=${String(phase639RP1ApprovalPreview.providerRuntimeApprovalPacketReady)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase639r-readiness-card">
                    <div><strong>Read-Only P1 Approval Status</strong><small>approval packets only</small></div>
                    <ul>${phase639rP1ApprovalRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase639r-boundary-card">
                    <div><strong>P1 Boundary</strong><small>not implemented</small></div>
                    <ul>
                      <li>main-chain candidate preparation only</li>
                      <li>provider runtime candidate preparation only</li>
                      <li>no /chat change, no /chat-gateway/execute change, no provider runtime change</li>
                    </ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase639r-next-card">
                    <div><strong>Next Gate</strong><small>${escapeHtml(phase639RP1ApprovalPreview.nextPhase)}</small></div>
                    <p>Separate approval remains required before any implementation, provider call, deploy, release, push, or commit.</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase639r-nightly-fallback-section" data-codex-phase639r-nightly-fallback-panel="true" data-codex-phase639r-nightly-read-only-preview="true" data-codex-phase639r-nightly-no-register-button="true" data-codex-phase639r-nightly-no-run-button="true">
                  <article class="codex-context-preview-card" id="codex-phase639r-nightly-status-card">
                    <div><strong>Nightly Runner Fallback Panel</strong><small>${escapeHtml(phase639RNightlyFallbackPanel.originalBlocker)}</small></div>
                    <p>scheduledTaskRegistered=${String(phase639RNightlyFallbackPanel.scheduledTaskRegistered)}; nightlyAutomationEnabled=${String(phase639RNightlyFallbackPanel.nightlyAutomationEnabled)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase639r-nightly-state-card">
                    <div><strong>Read-Only Nightly Status</strong><small>fallback launcher only</small></div>
                    <ul>${phase639rNightlyFallbackRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase639r-nightly-launchers-card">
                    <div><strong>Fallback Launchers</strong><small>available, manual only</small></div>
                    <p><code>${escapeHtml(phase639RNightlyFallbackPanel.fallbackCmdPath)}</code></p>
                    <p><code>${escapeHtml(phase639RNightlyFallbackPanel.fallbackPs1Path)}</code></p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase639r-nightly-boundary-card">
                    <div><strong>Execution Boundary</strong><small>not enabled</small></div>
                    <p>Not a daemon, not an infinite loop, not nightly automation enabled; a permissioned Windows session is required before Task Scheduler registration can be retried.</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase640r-nightly-retry-pack-section" data-codex-phase640r-nightly-retry-pack="true" data-codex-phase640r-nightly-read-only-preview="true" data-codex-phase640r-nightly-no-register-button="true" data-codex-phase640r-nightly-no-run-button="true">
                  <article class="codex-context-preview-card" id="codex-phase640r-nightly-status-card">
                    <div><strong>Phase640R Permissioned Retry Pack</strong><small>${escapeHtml(phase640RNightlyPermissionedRetryPack.originalBlocker)}</small></div>
                    <p>permissioned retry pack ready=${String(phase640RNightlyPermissionedRetryPack.permissionedRetryPackReady)}; nightly automation enabled=false; scheduledTaskRegistered=${String(phase640RNightlyPermissionedRetryPack.scheduledTaskRegistered)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase640r-nightly-state-card">
                    <div><strong>Read-Only Retry Status</strong><small>manual permissioned session required</small></div>
                    <ul>${phase640rNightlyPermissionedRetryRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase640r-nightly-scripts-card">
                    <div><strong>Retry Artifacts</strong><small>not executed here</small></div>
                    <p>admin checklist ready: <code>${escapeHtml(phase640RNightlyPermissionedRetryPack.adminChecklistPath)}</code></p>
                    <p>verify script ready: <code>${escapeHtml(phase640RNightlyPermissionedRetryPack.verifyScriptPath)}</code></p>
                    <p>result intake example ready: <code>${escapeHtml(phase640RNightlyPermissionedRetryPack.resultInputExamplePath)}</code></p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase640r-nightly-next-card">
                    <div><strong>Next Action</strong><small>permissioned manual retry</small></div>
                    <p>next action: manually run retry script in a permissioned session. This panel does not register Task Scheduler, does not run nightly runner, and does not call Provider.</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase641r-nightly-registration-intake-section" data-codex-phase641r-nightly-registration-intake="true" data-codex-phase641r-nightly-read-only-preview="true" data-codex-phase641r-nightly-no-register-button="true" data-codex-phase641r-nightly-no-run-button="true">
                  <article class="codex-context-preview-card" id="codex-phase641r-nightly-status-card">
                    <div><strong>Phase641R Registration Result Intake</strong><small>${escapeHtml(phase641RNightlyRegistrationResultIntake.blocker || "no blocker")}</small></div>
                    <p>Task Scheduler registered=${String(phase641RNightlyRegistrationResultIntake.scheduledTaskRegistered)}; nightly automation enabled=${String(phase641RNightlyRegistrationResultIntake.nightlyAutomationEnabled)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase641r-nightly-state-card">
                    <div><strong>Read-Only Intake Status</strong><small>result input + system verification</small></div>
                    <ul>${phase641rNightlyRegistrationRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase641r-nightly-evidence-card">
                    <div><strong>Evidence Paths</strong><small>read-only</small></div>
                    <p><code>docs/phase641r-nightly-registration-result.input.json</code></p>
                    <p><code>docs/phase641r-nightly-registration-result.input.example.json</code></p>
                    <p><code>${escapeHtml(phase641RNightlyRegistrationResultIntake.latestEvidencePath)}</code></p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase641r-nightly-next-card">
                    <div><strong>Next Action</strong><small>confirm or supply result input</small></div>
                    <p>${escapeHtml(phase641RNightlyRegistrationResultIntake.nextAction)}</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase640r-external-tool-section" data-codex-phase640r-external-tool-preview="true" data-codex-phase640r-external-tool-read-only-preview="true" data-codex-phase640r-external-tool-no-chat-button="true" data-codex-phase640r-external-tool-no-chat-gateway-execute-button="true" data-codex-phase640r-external-tool-no-provider-runtime-button="true">
                  <article class="codex-context-preview-card" id="codex-phase640r-external-tool-status-card">
                    <div><strong>External Codex Relay Tool</strong><small>token-saving tool mode</small></div>
                    <p>Codex/crs gateway is external tool mode; main-chain integration frozen; provider runtime integration frozen.</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase640r-external-tool-state-card">
                    <div><strong>Product Boundary</strong><small>read-only preview</small></div>
                    <ul>${phase640rExternalToolRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase640r-external-tool-matrix-card">
                    <div><strong>Capability Matrix</strong><small>external only</small></div>
                    <p><code>${escapeHtml(phase640RExternalToolMode.capabilityMatrixPath)}</code></p>
                    <p>productionReady=false; releaseReady=false; not production traffic path.</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase640r-external-tool-freeze-card">
                    <div><strong>Frozen Direction</strong><small>future reopen requires explicit request</small></div>
                    <p>Main-chain and Provider-runtime phases remain historical references only. Do not continue main-chain phases automatically.</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase641r-645r-external-tool-section" data-codex-phase641r-645r-external-tool-bundle="true" data-codex-phase641r-645r-read-only-preview="true" data-codex-phase641r-645r-no-execution-buttons="true" data-codex-phase641r-645r-no-provider-call-button="true" data-codex-phase641r-645r-no-deploy-button="true" data-codex-phase641r-645r-no-secret-input="true">
                  <article class="codex-context-preview-card" id="codex-phase641r-645r-external-tool-status-card">
                    <div><strong>External Codex Relay Tool</strong><small>Phase641R-645R productization</small></div>
                    <p>toolMode=${escapeHtml(phase641R645RExternalToolBundle.toolMode)}; CLI wrapper ready=${String(phase641R645RExternalToolBundle.cliWrapperReady)}; operator panel hardened=${String(phase641R645RExternalToolBundle.operatorPanelReady)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase641r-645r-external-tool-state-card">
                    <div><strong>External Tool Guardrails</strong><small>read-only preview</small></div>
                    <ul>${phase641r645rExternalToolRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase641r-645r-external-tool-pack-card">
                    <div><strong>Tool Pack</strong><small>dry-run only</small></div>
                    <p>open-source dry-run pack ready=${String(phase641R645RExternalToolBundle.openSourceDryRunToolPackReady)}; token-saving benchmark rechecked=${String(phase641R645RExternalToolBundle.tokenSavingBenchmarkRechecked)}</p>
                    <p><code>${escapeHtml(phase641R645RExternalToolBundle.evidencePath)}</code></p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase641r-645r-external-tool-boundary-card">
                    <div><strong>Boundary</strong><small>no runtime hooks</small></div>
                    <p>No codex exec button, no Provider call button, no /chat wiring, no /chat-gateway/execute wiring, no provider runtime mutation, no deploy/release/push action.</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase646r-650r-external-tool-dashboard-section" data-codex-phase646r-650r-external-tool-dashboard="true" data-codex-phase646r-650r-read-only-preview="true" data-codex-phase646r-650r-no-execution-button="true" data-codex-phase646r-650r-no-provider-call-button="true" data-codex-phase646r-650r-no-chat-integration-button="true" data-codex-phase646r-650r-no-deploy-button="true" data-codex-phase646r-650r-no-secret-input="true">
                  <article class="codex-context-preview-card" id="codex-phase646r-650r-external-tool-status-card">
                    <div><strong>External Tool Daily Workflow</strong><small>Phase646R-650R closure</small></div>
                    <p>dailyWorkflowReady=${String(phase646R650RExternalToolClosure.dailyWorkflowReady)}; taskQueueLedgerReady=${String(phase646R650RExternalToolClosure.taskQueueLedgerReady)}; evidenceDashboardReady=${String(phase646R650RExternalToolClosure.evidenceDashboardReady)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase646r-650r-external-tool-state-card">
                    <div><strong>Read-Only Dashboard State</strong><small>external tool only</small></div>
                    <ul>${phase646r650rExternalToolRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase646r-650r-external-tool-evidence-card">
                    <div><strong>Latest Evidence</strong><small>read-only paths</small></div>
                    <p><code>${escapeHtml(phase646R650RExternalToolClosure.evidencePath)}</code></p>
                    <p><code>${escapeHtml(phase646R650RExternalToolClosure.dailyWorkflowPath)}</code></p>
                    <p><code>${escapeHtml(phase646R650RExternalToolClosure.nextUsePlaybookPath)}</code></p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase646r-650r-external-tool-boundary-card">
                    <div><strong>Boundary</strong><small>no execution controls</small></div>
                    <p>No codex exec, no Provider call, no /chat wiring, no /chat-gateway/execute wiring, no provider runtime mutation, no deploy/release/push/commit, productionReady=false, releaseReady=false.</p>
                  </article>
                </div>
                <div class="codex-context-actions" aria-label="Codex Context Gateway preview actions">
                  ${actions}
                </div>
                <div class="codex-context-result is-visible" id="codex-context-preview-detail" data-codex-context-detail="true" tabindex="-1">
                  <strong id="codex-context-preview-title">Context Pack Preview</strong>
                  <p id="codex-context-preview-copy">Context hash, stale status, token budget, relevant files, evidence refs, dirty metadata, prompt pack, usage workflow, and authorization dry-run simulation are read from .codex-context only.</p>
                  <small id="codex-context-preview-boundary-line">providerCallsMade=false; rawSecretAccessed=false; rawWebhookAccessed=false; codexBaseUrlModified=false; codexConfigModified=false; realCodexConnectionMade=false; relayStarted=false; realConfigWriteAllowed=false; relayStartAllowed=false; realIntegrationAllowed=false; chatModified=false; chatGatewayExecuteModified=false</small>
                </div>
                <script type="application/json" id="codex-context-preview-data">${detailPayload}</script>
              </section>`;
}
