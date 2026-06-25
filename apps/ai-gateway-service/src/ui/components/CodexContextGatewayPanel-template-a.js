// CodexContextGatewayPanel - HTML template (first half: Phase593 - Phase604)
import { escapeHtml, escapeAttr, displaySafeText } from "./CodexContextGatewayPanel-utils.js";

export function renderTemplateA(d, preview, usage, trial, benchmark, baseUrlDesign,
  authorizationDesign, humanApprovalReview, readinessReview, preparationReview,
  oneShotReview, customProviderReview, customProviderOneShotReview, copy) {

  const { hash, token, freshness, files, evidence, dirty, prompt,
    badges, fileRows, evidenceRows, validationRows, usageChecks,
    trialInstruction, benchmarkNext, baseUrlRisks, baseUrlRollback,
    baseUrlChecklist, authMissingFields, authRequiredFields, authSummarySteps,
    relaySimulationSteps, authChecklist, humanApprovalMissingFields,
    humanApprovalLedgerRows, readinessMissingFields, readinessLedgerRows,
    preparationLedgerRows, oneShotLedgerRows, customProviderLedgerRows,
    customProviderOneShotLedgerRows } = d;

  return `
              <section class="codex-context-gateway-panel" id="codex-context-gateway-panel" data-codex-context-panel="true" data-codex-context-hash="${escapeAttr(hash)}" data-codex-stale-status="${freshness.staleStatus ? "stale" : "fresh"}">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase593/594 Operator Preview</div>
                    <h3>${escapeHtml(copy.title)}</h3>
                    <p>${escapeHtml(copy.subtitle)}</p>
                  </div>
                  <span class="tour-chip">dry-run preview</span>
                </div>
                <div class="scenario-boundary-badges codex-context-safety-boundary" id="codex-context-safety-boundary" aria-label="Codex Context Gateway safety boundary">
                  ${badges}
                </div>
                <div class="codex-context-grid">
                  <article class="codex-context-card" id="codex-context-hash-section">
                    <small>Context Hash</small>
                    <strong data-codex-context-hash-value="true">${escapeHtml(hash.slice(0, 16))}...</strong>
                    <span>generatedAt: ${escapeHtml(preview.contextPack.generatedAt || "unknown")}</span>
                  </article>
                  <article class="codex-context-card" id="codex-context-freshness-section">
                    <small>Freshness / Stale</small>
                    <strong data-codex-stale-status-value="true">${freshness.staleStatus ? "stale=true" : "stale=false"}</strong>
                    <span>${escapeHtml(freshness.staleReason || "staleReason=null")}</span>
                  </article>
                  <article class="codex-context-card" id="codex-token-budget-section" data-codex-token-budget="true">
                    <small>Token Budget</small>
                    <strong>${escapeHtml(token.budgetName)} / ${token.maxTokens}</strong>
                    <span>estimated=${token.currentEstimate}; respected=${String(token.budgetRespected)}</span>
                  </article>
                  <article class="codex-context-card" id="codex-dirty-summary-section">
                    <small>Dirty Summary</small>
                    <strong>${dirty.changedFileCount} changed files</strong>
                    <span>workspaceCleanClaimed=false; diff content hidden</span>
                  </article>
                </div>
                <div class="codex-context-preview-grid">
                  <article class="codex-context-preview-card" id="codex-relevant-files-section">
                    <div><strong>Relevant Files</strong><small>${files.relevantFileCount} selected; full repo scan avoided=${String(files.fullRepoScanAvoided)}</small></div>
                    <ul>${fileRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-evidence-index-section">
                    <div><strong>Evidence Refs</strong><small>${evidence.evidenceRefCount} refs indexed; raw evidence not expanded</small></div>
                    <ul>${evidenceRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-prompt-pack-section">
                    <div><strong>Prompt Pack</strong><small>${escapeHtml(prompt.promptPackTitle)}</small></div>
                    <pre>${escapeHtml(displaySafeText(prompt.previewText.slice(0, 520)))}</pre>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-usage-workflow-section" data-codex-usage-workflow-preview="true">
                  <article class="codex-context-preview-card" id="codex-usage-preflight-card">
                    <div><strong>Preflight</strong><small>required files present=${String(usage.preflight.completed)}</small></div>
                    <p>missingRequiredFileBlocks=${String(usage.preflight.missingRequiredFileBlocks)}; realCodexConnectionMade=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-usage-freshness-card">
                    <div><strong>Freshness Gate</strong><small>stale=${String(usage.freshnessGate.stale)}</small></div>
                    <p>staleTrueBlocks=${String(usage.freshnessGate.staleTrueBlocks)}; simulatedStaleBlocked=${String(usage.staleStopper.simulatedStaleBlocked)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-usage-relevant-scope-card">
                    <div><strong>Relevant Files Scope</strong><small>${usage.relevantFileScope.relevantFileCount} files</small></div>
                    <p>fullRepoScanAvoided=${String(usage.relevantFileScope.fullRepoScanAvoided)}; outOfScopeReadRequiresReason=${String(usage.relevantFileScope.outOfScopeReadRequiresReason)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-usage-validation-plan-card">
                    <div><strong>Validation Plan</strong><small>${usage.validationPlan.commands.length} commands</small></div>
                    <ul>${validationRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-usage-dry-run-wrapper-card">
                    <div><strong>Dry-run Task Wrapper</strong><small>ready=${String(usage.dryRunTask.dryRunTaskWrapperWorks)}</small></div>
                    <p>preflight - freshness - relevant scope - prompt pack - validation plan; no real Codex connection.</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-usage-operator-checklist-card">
                    <div><strong>Operator Checklist</strong><small>workspaceCleanClaimForbidden=${String(usage.operatorChecklist.workspaceCleanClaimForbidden)}</small></div>
                    <ul>${usageChecks}</ul>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-usage-trial-section" data-codex-usage-trial-preview="true" data-codex-usage-trial-status="true">
                  <article class="codex-context-preview-card" id="codex-usage-trial-status-card">
                    <div><strong>Phase595 Real Usage Trial</strong><small>status=${escapeHtml(trial.classifier.status)}</small></div>
                    <p>without base_url change; realCodexConnectionMade=false; providerCallsMade=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-usage-trial-context-pack-card">
                    <div><strong>Context Pack Used</strong><small>hash=${escapeHtml(String(trial.contextHash || "").slice(0, 12))}</small></div>
                    <p>contextPackUsed=${String(trial.usageTracker.contextPackUsed)}; promptPackUsed=${String(trial.usageTracker.promptPackUsed)}; staleGateUsed=${String(trial.usageTracker.freshnessGateUsed)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-usage-trial-relevant-files-card">
                    <div><strong>Relevant Files Used</strong><small>${trial.policy.relevantFileCount} relevant files</small></div>
                    <p>expectedReads=${trial.policy.expectedReadFiles.length}; fullRepoScanFlagged=${String(trial.readAudit.fullRepoScanFlagged)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-usage-trial-token-saving-card">
                    <div><strong>Token Saving</strong><small>${trial.tokenSaving.savingPercent}% estimate</small></div>
                    <p>actualPackEstimate=${trial.tokenSaving.actualPackEstimate}; budgetRespected=${String(trial.tokenSaving.budgetRespected)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-usage-trial-validation-card">
                    <div><strong>Validation Status</strong><small>passed=${String(trial.validationExecution.allValidationCommandsPassed)}</small></div>
                    <p>commandsPlanned=${trial.validationPlan.commands.length}; noDangerousCommandExecuted=${String(trial.validationExecution.noDangerousCommandExecuted)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-usage-trial-next-instruction-card">
                    <div><strong>Next Instruction</strong><small>copy-ready prefix</small></div>
                    <ul>${trialInstruction}</ul>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-repeated-benchmark-section" data-codex-repeated-benchmark-preview="true" data-codex-benchmark-executed-count="true">
                  <article class="codex-context-preview-card" id="codex-benchmark-status-card">
                    <div><strong>Phase596 Repeated Benchmark</strong><small>status=${escapeHtml(benchmark.classifier.trialStatus)}</small></div>
                    <p>executedTaskCount=${benchmark.aggregate.executedTaskCount}; failedTaskCount=${benchmark.aggregate.failedTaskCount}; providerCallsMade=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-benchmark-token-saving-card">
                    <div><strong>Average Token Saving</strong><small>${benchmark.aggregate.averageTokenSavingPercent}% estimate</small></div>
                    <p>budgetRespectedForAllTasks=${String(benchmark.tokenSaving.budgetRespectedForAllTasks)}; threshold>=80=${String(benchmark.tokenSaving.savingPercentAboveThreshold)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-benchmark-scope-card">
                    <div><strong>Relevant File Usage</strong><small>${benchmark.policy.relevantFileCount} relevant files</small></div>
                    <p>contextPackUsedForAllTasks=${String(benchmark.aggregate.contextPackUsedForAllTasks)}; relevantFilesUsedForAllTasks=${String(benchmark.aggregate.relevantFilesUsedForAllTasks)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-benchmark-scan-card">
                    <div><strong>Full Repo Scan Avoided</strong><small>flagged=${benchmark.aggregate.fullRepoScanFlaggedCount}</small></div>
                    <p>scanReductionEstimated=${String(benchmark.scanAvoidance.scanReductionEstimated)}; outOfScopeReadReasonsRecorded=${String(benchmark.scanAvoidance.outOfScopeReadReasonsRecorded)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-benchmark-validation-card">
                    <div><strong>Validation Status</strong><small>passed=${String(benchmark.validationExecution.allValidationCommandsPassed)}</small></div>
                    <p>noDangerousCommandExecuted=${String(benchmark.validationExecution.noDangerousCommandExecuted)}; benchmarkStatus=${escapeHtml(benchmark.classifier.trialStatus)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-benchmark-next-card">
                    <div><strong>Next Optimization</strong><small>Phase597 design gate</small></div>
                    <ul>${benchmarkNext}</ul>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-base-url-design-preview-section" data-codex-base-url-design-preview="true" data-codex-base-url-design-only="true" data-codex-base-url-authorization-required="true">
                  <article class="codex-context-preview-card" id="codex-base-url-design-status-card">
                    <div><strong>Phase597 Base URL Design</strong><small>design only</small></div>
                    <p>codexBaseUrlModified=${String(baseUrlDesign.codexBaseUrlModified)}; codexConfigModified=${String(baseUrlDesign.codexConfigModified)}; relayStarted=${String(baseUrlDesign.relayStarted)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-base-url-authorization-card">
                    <div><strong>Authorization Required</strong><small>${escapeHtml(baseUrlDesign.authorization.realIntegrationStatus)}</small></div>
                    <p>allowCodexBaseUrlChangeRequired=${String(baseUrlDesign.authorization.allowCodexBaseUrlChangeRequired)}; approvalRecordRequired=${String(baseUrlDesign.authorization.approvalRecordRequired)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-base-url-account-pool-card">
                    <div><strong>Account Pool Policy</strong><small>${escapeHtml(baseUrlDesign.accountPool.accountPoolRef)}</small></div>
                    <p>concurrencyLimitDefined=${String(baseUrlDesign.accountPool.concurrencyLimitDefined)}; rateLimitDefined=${String(baseUrlDesign.accountPool.rateLimitDefined)}; cacheMissPolicyLinked=${String(baseUrlDesign.accountPool.cacheMissPolicyLinked)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-base-url-rollback-card">
                    <div><strong>Rollback Plan</strong><small>${escapeHtml(baseUrlDesign.rollback.rollbackPlanRef)}</small></div>
                    <ul>${baseUrlRollback}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-base-url-risk-card">
                    <div><strong>Risk Review</strong><small>failure modes covered</small></div>
                    <ul>${baseUrlRisks}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-base-url-next-gate-card">
                    <div><strong>Next Authorization Gate</strong><small>Phase598 dry-run intake</small></div>
                    <ul>${baseUrlChecklist}</ul>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-authorization-preview-section" data-codex-authorization-preview="true" data-codex-authorization-missing-fields="true" data-codex-dry-run-config-simulation="true" data-codex-real-config-write-blocked="true" data-codex-relay-start-blocked="true" data-codex-credential-ref-only="true" data-codex-rollback-simulation="true" data-codex-emergency-disable="true">
                  <article class="codex-context-preview-card" id="codex-auth-status-card">
                    <div><strong>Authorization Status</strong><small>${escapeHtml(authorizationDesign.realIntegrationStatus)}</small></div>
                    <p>authorizationComplete=${String(authorizationDesign.authorizationComplete)}; realIntegrationAllowed=${String(authorizationDesign.realIntegrationAllowed)}; guardedRealTestNotAllowedYet=${String(authorizationDesign.guardedRealTestNotAllowedYet)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-auth-missing-fields-card">
                    <div><strong>Missing Required Fields</strong><small>${authorizationDesign.missingAuthorizationFields.length} missing</small></div>
                    <ul>${authMissingFields}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-auth-required-fields-card">
                    <div><strong>Required Fields</strong><small>future packet template</small></div>
                    <ul>${authRequiredFields}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-auth-simulation-card">
                    <div><strong>Dry-run Config Simulation</strong><small>enabled=false</small></div>
                    <ul>${authSummarySteps}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-auth-redacted-config-card">
                    <div><strong>Redacted Config Preview</strong><small>credentialRef only</small></div>
                    <p>rawBaseUrlValueExposed=${String(authorizationDesign.redactedConfigPreview.rawBaseUrlValueExposed)}; realUserConfigModified=${String(authorizationDesign.redactedConfigPreview.realUserConfigModified)}; projectCodexConfigModified=${String(authorizationDesign.redactedConfigPreview.projectCodexConfigModified)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-auth-relay-card">
                    <div><strong>Relay Simulation</strong><small>simulated upstream only</small></div>
                    <ul>${relaySimulationSteps}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-auth-account-pool-card">
                    <div><strong>Account Pool Simulation</strong><small>${authorizationDesign.accountPoolSimulation.accountPoolRef}</small></div>
                    <p>concurrencyLimitSimulated=${String(authorizationDesign.accountPoolSimulation.concurrencyLimitSimulated)}; perAccountQuotaSimulated=${String(authorizationDesign.accountPoolSimulation.perAccountQuotaSimulated)}; coolingWindowSimulated=${String(authorizationDesign.accountPoolSimulation.coolingWindowSimulated)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-auth-credential-card">
                    <div><strong>CredentialRef Simulation</strong><small>credentialRef only</small></div>
                    <p>rawSecretAccessed=${String(authorizationDesign.credentialRefSimulation.rawSecretAccessed)}; secretValueExposed=${String(authorizationDesign.credentialRefSimulation.secretValueExposed)}; rawWebhookAccessed=${String(authorizationDesign.credentialRefSimulation.rawWebhookAccessed)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-auth-policy-card">
                    <div><strong>Base URL Dry-run Policy</strong><small>real writes forbidden</small></div>
                    <p>realConfigWriteForbidden=${String(authorizationDesign.baseUrlDryRunPolicy.realConfigWriteForbidden)}; realRelayStartForbidden=${String(authorizationDesign.baseUrlDryRunPolicy.realRelayStartForbidden)}; realProviderCallForbidden=${String(authorizationDesign.baseUrlDryRunPolicy.realProviderCallForbidden)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-auth-rollback-card">
                    <div><strong>Rollback Simulation</strong><small>${authorizationDesign.rollbackSimulation.rollbackPlanRef}</small></div>
                    <p>disableRelaySimulated=${String(authorizationDesign.rollbackSimulation.disableRelaySimulated)}; invalidateStaleContextSimulated=${String(authorizationDesign.rollbackSimulation.invalidateStaleContextSimulated)}; preserveEvidenceSimulated=${String(authorizationDesign.rollbackSimulation.preserveEvidenceSimulated)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-auth-emergency-card">
                    <div><strong>Emergency Disable</strong><small>operator alert ready</small></div>
                    <p>relayBlocked=${String(authorizationDesign.emergencyDisableSimulation.relayBlocked)}; accountPoolBlocked=${String(authorizationDesign.emergencyDisableSimulation.accountPoolBlocked)}; staleContextForced=${String(authorizationDesign.emergencyDisableSimulation.staleContextForced)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-auth-evidence-card">
                    <div><strong>Authorization Evidence</strong><small>record only</small></div>
                    <ul>${authChecklist}</ul>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-human-approval-review-section" data-codex-human-approval-review-preview="true" data-codex-authorization-complete-visible="true" data-codex-human-approval-status-visible="true" data-codex-human-approval-missing-fields-visible="true" data-codex-guarded-real-test-allowed-visible="true" data-codex-final-decision-visible="true">
                  <article class="codex-context-preview-card" id="codex-human-approval-status-card">
                    <div><strong>Human Approval Review</strong><small>${escapeHtml(humanApprovalReview.humanApprovalStatus)}</small></div>
                    <p>authorizationComplete=${String(humanApprovalReview.authorizationComplete)}; realIntegrationAllowed=${String(humanApprovalReview.realIntegrationAllowed)}; guardedRealTestAllowed=${String(humanApprovalReview.guardedRealTestAllowed)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-human-approval-missing-fields-card">
                    <div><strong>Authorization Packet Missing Fields</strong><small>${humanApprovalReview.missingFields.length} missing</small></div>
                    <ul>${humanApprovalMissingFields}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-human-approval-final-decision-card">
                    <div><strong>Final Decision</strong><small>${escapeHtml(humanApprovalReview.finalDecision)}</small></div>
                    <p>realConfigWriteAllowed=${String(humanApprovalReview.realConfigWriteAllowed)}; relayStartAllowed=${String(humanApprovalReview.relayStartAllowed)}; providerCallsMade=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-human-approval-ledger-card">
                    <div><strong>Authorization Evidence Ledger</strong><small>review packet only</small></div>
                    <ul>${humanApprovalLedgerRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-human-approval-readiness-card">
                    <div><strong>Guarded Real Test Readiness</strong><small>blocked until all gates pass</small></div>
                    <p>missingHumanApprovalBlocks=${String(humanApprovalReview.guardedRealTestReadiness.missingHumanApprovalBlocks)}; missingExplicitUserApprovalBlocks=${String(humanApprovalReview.guardedRealTestReadiness.missingExplicitUserApprovalBlocks)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-human-approval-next-action-card">
                    <div><strong>Next Required Action</strong><small>no automatic real test</small></div>
                    <p>${escapeHtml(humanApprovalReview.guardedRealTestReadiness.nextRequiredAction)}</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase600-readiness-section" data-codex-phase600-readiness-preview="true" data-codex-phase600-authorization-complete="true" data-codex-phase600-human-approval-status="true" data-codex-phase600-readiness-decision="true" data-codex-phase600-missing-fields="true" data-codex-phase600-next-action="true">
                  <article class="codex-context-preview-card" id="codex-phase600-readiness-status-card">
                    <div><strong>Phase600 Readiness Review</strong><small>${escapeHtml(readinessReview.blocker || "no blocker")}</small></div>
                    <p>authorizationComplete=${String(readinessReview.authorizationComplete)}; humanApprovalStatus=${escapeHtml(readinessReview.humanApprovalStatus)}; readinessReviewPassed=${String(readinessReview.readinessReviewPassed)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase600-readiness-missing-card">
                    <div><strong>Input Missing Fields</strong><small>${readinessReview.missingFields.length} missing</small></div>
                    <ul>${readinessMissingFields}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase600-readiness-decision-card">
                    <div><strong>Readiness Decision</strong><small>${escapeHtml(readinessReview.finalDecision)}</small></div>
                    <p>realIntegrationAllowed=${String(readinessReview.realIntegrationAllowed)}; guardedRealTestAllowed=${String(readinessReview.guardedRealTestAllowed)}; futureGuardedRealTestCandidate=${String(readinessReview.futureGuardedRealTestCandidate)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase600-readiness-boundary-card">
                    <div><strong>Execution Boundary</strong><small>no real execution button</small></div>
                    <p>codexBaseUrlModified=false; relayStarted=false; providerCallsMade=false; realConfigWriteAllowed=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase600-readiness-ledger-card">
                    <div><strong>Readiness Evidence Ledger</strong><small>input + approval review only</small></div>
                    <ul>${readinessLedgerRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase600-readiness-next-action-card">
                    <div><strong>Next Action</strong><small>no automatic base_url change</small></div>
                    <p>${escapeHtml(readinessReview.nextAction)}</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase601-preparation-section" data-codex-phase601-preparation-preview="true" data-codex-phase601-session-override-preview="true" data-codex-phase601-rollback-preview="true" data-codex-phase601-emergency-disable-preview="true" data-codex-phase601-real-test-not-executed="true" data-codex-phase601-final-confirmation-required="true">
                  <article class="codex-context-preview-card" id="codex-phase601-preparation-status-card">
                    <div><strong>Phase601 Preparation</strong><small>${escapeHtml(preparationReview.blocker || "no blocker")}</small></div>
                    <p>readinessImported=${String(preparationReview.readinessImport.phase600EvidenceReadable)}; phase602Candidate=${String(preparationReview.phase602Candidate)}; finalUserConfirmationRequired=${String(preparationReview.finalUserConfirmationRequired)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase601-session-override-card">
                    <div><strong>Session Override Preview</strong><small>command not executed</small></div>
                    <p>${escapeHtml(preparationReview.commandPreview.commandPreview)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase601-rollback-card">
                    <div><strong>Rollback / Emergency</strong><small>preview only</small></div>
                    <ul>${preparationLedgerRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase601-command-bundle-card">
                    <div><strong>Final Command Bundle</strong><small>Phase602 gated</small></div>
                    <p>finalCommandBundlePreviewGenerated=${String(preparationReview.finalCommandBundlePreview.finalCommandBundlePreviewGenerated)}; commandExecuted=false</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase602-one-shot-result-section" data-codex-phase602-one-shot-result-preview="true" data-codex-phase602-request-attempt-count="true" data-codex-phase602-cleanup-status="true" data-codex-phase602-config-write-status="true">
                  <article class="codex-context-preview-card" id="codex-phase602-status-card">
                    <div><strong>Phase602 One-Shot Result</strong><small>${escapeHtml(oneShotReview.blocker || "no blocker")}</small></div>
                    <p>oneShotExecuted=${String(oneShotReview.oneShotExecuted)}; testStatus=${escapeHtml(oneShotReview.testStatus)}; classification=${escapeHtml(oneShotReview.responseClassification)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase602-attempt-card">
                    <div><strong>Request Attempts</strong><small>maxRequests=1</small></div>
                    <p>requestAttemptCount=${oneShotReview.requestAttemptCount}; retryAttemptCount=${oneShotReview.retryAttemptCount}; sessionOverrideUsed=${String(oneShotReview.sessionOverrideUsed)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase602-cleanup-card">
                    <div><strong>Cleanup / Rollback</strong><small>${escapeHtml(oneShotReview.cleanup.rollbackResult)}</small></div>
                    <ul>${oneShotLedgerRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase602-config-write-card">
                    <div><strong>Config Write Status</strong><small>persistent write blocked</small></div>
                    <p>userCodexConfigModified=false; projectCodexConfigModified=false; rawBaseUrlValueExposed=false</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase603-custom-provider-route-section" data-codex-phase603-custom-provider-route-preview="true" data-codex-phase603-openai-base-url-failure="true" data-codex-phase603-auth-json-denylist="true" data-codex-phase603-command-preview="true" data-codex-phase603-real-test-not-executed="true" data-codex-phase603-final-confirmation-required="true">
                  <article class="codex-context-preview-card" id="codex-phase603-route-status-card">
                    <div><strong>Phase603 Custom Provider Route</strong><small>${escapeHtml(customProviderReview.blocker || "no blocker")}</small></div>
                    <p>openai_base_url honored=${String(customProviderReview.openaiBaseUrlOverrideHonored)}; nextRoute=${escapeHtml(customProviderReview.nextRoute)}; finalConfirmationRequired=${String(customProviderReview.finalUserConfirmationRequired)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase603-auth-json-card">
                    <div><strong>auth.json Denylist</strong><small>not read, not touched</small></div>
                    <p>authJsonRead=false; authJsonTouched=false; authJsonCopied=false; authJsonWrittenToEvidence=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase603-config-preview-card">
                    <div><strong>Config Preview</strong><small>preview artifact only</small></div>
                    <p>path=${escapeHtml(customProviderReview.projectConfigPreview.previewPath)}; userCodexConfigModified=false; projectCodexConfigModified=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase603-command-preview-card">
                    <div><strong>Command Bundle Preview</strong><small>not executed</small></div>
                    <p>${escapeHtml(customProviderReview.commandBundle.commandPreview)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase603-rollback-card">
                    <div><strong>Rollback / Emergency</strong><small>preview only</small></div>
                    <ul>${customProviderLedgerRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase603-next-gate-card">
                    <div><strong>Next Gate</strong><small>Phase604 confirmation required</small></div>
                    <p>customProviderOneShotCandidate=${String(customProviderReview.nextPhaseGateReport.customProviderOneShotCandidate)}; commandBundlePreviewReady=${String(customProviderReview.nextPhaseGateReport.commandBundlePreviewReady)}; realTestExecuted=false</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase604-custom-provider-result-section" data-codex-phase604-custom-provider-result-preview="true" data-codex-phase604-negative-control-result="true" data-codex-phase604-selected-provider="true" data-codex-phase604-one-shot-status="true" data-codex-phase604-request-attempt-count="true" data-codex-phase604-auth-json-touched-false="true" data-codex-phase604-persistent-config-write-false="true">
                  <article class="codex-context-preview-card" id="codex-phase604-status-card">
                    <div><strong>Phase604 Custom Provider Test</strong><small>${escapeHtml(customProviderOneShotReview.blocker || "no blocker")}</small></div>
                    <p>finalConfirmationExists=${String(customProviderOneShotReview.finalConfirmation.finalConfirmationExists)}; oneShotExecuted=${String(customProviderOneShotReview.oneShotExecuted)}; classification=${escapeHtml(customProviderOneShotReview.responseClassification)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase604-negative-control-card">
                    <div><strong>Negative-Control</strong><small>${escapeHtml(customProviderOneShotReview.negativeControlClassifier.classification)}</small></div>
                    <p>negativeControlExecuted=${String(customProviderOneShotReview.negativeControlExecuted)}; modelProviderOverrideHonored=${String(customProviderOneShotReview.modelProviderOverrideHonored)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase604-provider-card">
                    <div><strong>Selected Provider</strong><small>${escapeHtml(customProviderOneShotReview.selectedProviderId || "not selected")}</small></div>
                    <p>customProviderExists=${String(customProviderOneShotReview.customProviderExists)}; authJsonRead=false; authJsonTouched=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase604-attempt-card">
                    <div><strong>Request Attempts</strong><small>maxRequests=1</small></div>
                    <p>requestAttemptCount=${customProviderOneShotReview.requestAttemptCount}; retryAttemptCount=${customProviderOneShotReview.retryAttemptCount}; providerCallsMade=${String(customProviderOneShotReview.providerCallsMade)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase604-cleanup-card">
                    <div><strong>Cleanup / Rollback</strong><small>${escapeHtml(customProviderOneShotReview.cleanup.rollbackResult)}</small></div>
                    <ul>${customProviderOneShotLedgerRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase604-next-card">
                    <div><strong>Next Action</strong><small>${escapeHtml(customProviderOneShotReview.nextRoute)}</small></div>
                    <p>contextPackUsed=${String(customProviderOneShotReview.contextPackUsed)}; relevantFilesUsed=${String(customProviderOneShotReview.relevantFilesUsed)}; staleGateUsed=${String(customProviderOneShotReview.staleGateUsed)}</p>
                  </article>
                </div>`;
}
