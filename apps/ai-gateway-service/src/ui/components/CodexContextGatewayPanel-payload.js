// CodexContextGatewayPanel - detail payload builder
import { displaySafeText } from "./CodexContextGatewayPanel-utils.js";

export function buildDetailPayload(
  preview, usage, trial, benchmark, baseUrlDesign, authorizationDesign,
  humanApprovalReview, readinessReview, preparationReview, oneShotReview,
  customProviderReview, customProviderOneShotReview,
  interactiveTerminalIntake, codexExecIntake,
  repeatedReliabilityDesign, repeatedGuardedTestDesign, repeatedGuardedTestResult,
  repeatedReliabilityClosure, controlledIntegrationPreviewGate,
  runtimeIntegrationApprovalPacket, runtimeCandidateDryRunBundle,
  controlledRuntimeCandidatePath, mainChainFinalApprovalPacket, mainChainDesignPatch,
  phase639RP1ApprovalPreview, phase639RNightlyFallbackPanel,
  phase640RNightlyPermissionedRetryPack, phase641RNightlyRegistrationResultIntake,
  phase640RExternalToolMode, phase641R645RExternalToolBundle, phase646R650RExternalToolClosure
) {
  return {
    contextPack: {
      title: "Context Pack Preview",
      copy: `hash=${preview.contextHash}; phaseSummaryVisible=${preview.contextPack.phaseSummaryVisible}; safetyBoundaryVisible=${preview.contextPack.safetyBoundaryVisible}`,
    },
    tokenBudget: {
      title: "Token Budget Preview",
      copy: `${preview.tokenBudget.budgetName}: estimated=${preview.tokenBudget.currentEstimate}, max=${preview.tokenBudget.maxTokens}, respected=${preview.tokenBudget.budgetRespected}, saving=${preview.tokenBudget.tokenSavingEstimate.savedPercent || 0}%`,
    },
    relevantFiles: {
      title: "Relevant Files Preview",
      copy: `${preview.relevantFiles.relevantFileCount} selected files; selectionMode=${preview.relevantFiles.selectionMode}; fullRepoScanAvoided=${preview.relevantFiles.fullRepoScanAvoided}`,
    },
    promptPack: {
      title: "Prompt Pack Preview",
      copy: `${preview.promptPack.promptPackTitle}; taskSummaryVisible=${preview.promptPack.taskSummaryVisible}; validationCommandsVisible=${preview.promptPack.validationCommandsVisible}`,
    },
    freshness: {
      title: "Freshness Preview",
      copy: `stale=${preview.freshness.staleStatus}; hash=${preview.freshness.contextHash}; simulatedStalePreviewWorks=${preview.freshness.simulatedStalePreviewWorks}`,
    },
    evidenceIndex: {
      title: "Evidence Index Preview",
      copy: `${preview.evidenceIndex.evidenceRefCount} evidence refs; recent=${preview.evidenceIndex.recentPhases.join(", ")}`,
    },
    refreshPreview: {
      title: "Refresh Preview",
      copy: "Dry-run refresh rechecks .codex-context only. No provider call, no Codex base_url change, no Codex config write.",
    },
    copyPrompt: {
      title: "Prompt Preview Copied",
      copy: displaySafeText(preview.promptPack.previewText.slice(0, 900)),
    },
    usageWorkflow: {
      title: "Usage Workflow Preview",
      copy: `preflight=${usage.preflight.completed}; stale=${usage.freshnessGate.stale}; relevantFiles=${usage.relevantFileScope.relevantFileCount}; dryRunOnly=true; realCodexConnectionMade=false`,
    },
    preflight: {
      title: "Context Pack Preflight",
      copy: `contextPackMdExists=${usage.preflight.contextPackMdExists}; contextPackJsonExists=${usage.preflight.contextPackJsonExists}; relevantFilesExists=${usage.preflight.relevantFilesExists}; missingRequiredFileBlocks=${usage.preflight.missingRequiredFileBlocks}`,
    },
    validationPlan: {
      title: "Validation Command Planner",
      copy: usage.validationPlan.commands.join(" | "),
    },
    dryRunWrapper: {
      title: "Dry-run Codex Task Wrapper",
      copy: `preflightExecuted=${usage.dryRunTask.preflightExecuted}; freshnessGateExecuted=${usage.dryRunTask.freshnessGateExecuted}; promptPackLoaded=${usage.dryRunTask.promptPackLoaded}; realCodexConnectionMade=false`,
    },
    failureModes: {
      title: "Failure Mode Preview",
      copy: `missingContextPackBlocks=${usage.failureMode.missingContextPackBlocks}; staleContextBlocks=${usage.failureMode.staleContextBlocks}; tokenBudgetExceededWarns=${usage.failureMode.tokenBudgetExceededWarns}; malformedPromptPackHandled=${usage.failureMode.malformedPromptPackHandled}`,
    },
    operatorChecklist: {
      title: "Operator Checklist",
      copy: usage.operatorChecklist.items.join(" | "),
    },
    usageTrial: {
      title: "Phase595 Real Usage Trial",
      copy: `status=${trial.classifier.status}; contextPackUsed=${trial.usageTracker.contextPackUsed}; relevantFilesUsed=${trial.usageTracker.relevantFilesUsed}; tokenSaving=${trial.tokenSaving.savingPercent}%; validationPassed=${trial.validationExecution.allValidationCommandsPassed}`,
    },
    nextInstruction: {
      title: "Next Codex Task Instruction",
      copy: trial.nextInstruction.instruction,
    },
    repeatedBenchmark: {
      title: "Phase596 Repeated Benchmark",
      copy: `executedTaskCount=${benchmark.aggregate.executedTaskCount}; averageTokenSavingPercent=${benchmark.aggregate.averageTokenSavingPercent}; fullRepoScanFlaggedCount=${benchmark.aggregate.fullRepoScanFlaggedCount}; failedTaskCount=${benchmark.aggregate.failedTaskCount}; benchmarkStatus=${benchmark.classifier.trialStatus}`,
    },
    benchmarkNext: {
      title: "Benchmark Next Step",
      copy: benchmark.aggregate.nextOptimization,
    },
    baseUrlDesign: {
      title: "Phase597 Base URL Design Preview",
      copy: `designOnly=${baseUrlDesign.designOnly}; authorizationStatus=${baseUrlDesign.authorization.realIntegrationStatus}; codexBaseUrlModified=${baseUrlDesign.codexBaseUrlModified}; codexConfigModified=${baseUrlDesign.codexConfigModified}; relayStarted=${baseUrlDesign.relayStarted}; providerCallsMade=${baseUrlDesign.providerCallsMade}`,
    },
    baseUrlConfigPreview: {
      title: "Base URL Config Preview",
      copy: `mode=${baseUrlDesign.configPreview.preview.mode}; targetScope=${baseUrlDesign.configPreview.preview.targetScope}; enabled=${baseUrlDesign.configPreview.preview.enabled}; dryRunOnly=${baseUrlDesign.configPreview.preview.dryRunOnly}; rawBaseUrlValueExposed=${baseUrlDesign.configPreview.rawBaseUrlValueExposed}`,
    },
    baseUrlAuthorization: {
      title: "Authorization Requirements",
      copy: `missingAuthorizationBlocks=${baseUrlDesign.authorization.missingAuthorizationBlocks}; allowCodexBaseUrlChangeRequired=${baseUrlDesign.authorization.allowCodexBaseUrlChangeRequired}; maxRequestsRequired=${baseUrlDesign.authorization.maxRequestsRequired}; maxEstimatedCostUsdRequired=${baseUrlDesign.authorization.maxEstimatedCostUsdRequired}; approvalRecordRequired=${baseUrlDesign.authorization.approvalRecordRequired}`,
    },
    baseUrlRollback: {
      title: "Rollback Plan",
      copy: baseUrlDesign.rollback.steps.join(" | "),
    },
    baseUrlRiskReview: {
      title: "Failure Mode / Risk Review",
      copy: baseUrlDesign.riskReview.risks.join(" | "),
    },
    baseUrlChecklist: {
      title: "Controlled Integration Checklist",
      copy: baseUrlDesign.checklist.items.join(" | "),
    },
    authStatus: {
      title: "Authorization Status",
      copy: `authorizationComplete=${authorizationDesign.authorizationComplete}; realIntegrationStatus=${authorizationDesign.realIntegrationStatus}; realIntegrationAllowed=${authorizationDesign.realIntegrationAllowed}; guardedRealTestNotAllowedYet=${authorizationDesign.guardedRealTestNotAllowedYet}`,
    },
    authMissingFields: {
      title: "Missing Required Fields",
      copy: authorizationDesign.missingAuthorizationFields.join(" | "),
    },
    authDryRunSimulation: {
      title: "Dry-run Config Simulation",
      copy: `simulationStatus=${authorizationDesign.configSimulationReport.simulationStatus}; enabled=${authorizationDesign.dryRunConfigSimulation.enabled}; dryRunOnly=${authorizationDesign.dryRunConfigSimulation.dryRunOnly}; wouldWriteConfig=${authorizationDesign.dryRunConfigSimulation.wouldWriteConfig}; wouldStartRelay=${authorizationDesign.dryRunConfigSimulation.wouldStartRelay}`,
    },
    authRedactedConfig: {
      title: "Redacted Config Preview",
      copy: authorizationDesign.redactedConfigPreview.configSnippetPreview,
    },
    authRelay: {
      title: "Relay Simulation",
      copy: authorizationDesign.relaySimulationPlan.simulationSteps.join(" | "),
    },
    authAccountPool: {
      title: "Account Pool Simulation",
      copy: `accountPoolRef=${authorizationDesign.accountPoolSimulation.accountPoolRef}; concurrencyLimitSimulated=${authorizationDesign.accountPoolSimulation.concurrencyLimitSimulated}; perAccountQuotaSimulated=${authorizationDesign.accountPoolSimulation.perAccountQuotaSimulated}; coolingWindowSimulated=${authorizationDesign.accountPoolSimulation.coolingWindowSimulated}`,
    },
    authCredential: {
      title: "CredentialRef Simulation",
      copy: `credentialRef=${authorizationDesign.credentialRefSimulation.credentialRef}; rawSecretAccessed=${authorizationDesign.credentialRefSimulation.rawSecretAccessed}; rawWebhookAccessed=${authorizationDesign.credentialRefSimulation.rawWebhookAccessed}; simulatedCredentialOnly=${authorizationDesign.credentialRefSimulation.simulatedCredentialOnly}`,
    },
    authPolicy: {
      title: "Base URL Dry-run Policy",
      copy: `realConfigWriteForbidden=${authorizationDesign.baseUrlDryRunPolicy.realConfigWriteForbidden}; realRelayStartForbidden=${authorizationDesign.baseUrlDryRunPolicy.realRelayStartForbidden}; realProviderCallForbidden=${authorizationDesign.baseUrlDryRunPolicy.realProviderCallForbidden}; realSecretReadForbidden=${authorizationDesign.baseUrlDryRunPolicy.realSecretReadForbidden}`,
    },
    authRollback: {
      title: "Rollback Simulation",
      copy: authorizationDesign.rollbackSimulation.steps.join(" | "),
    },
    authEmergency: {
      title: "Emergency Disable Simulation",
      copy: authorizationDesign.emergencyDisableSimulation.summary.join(" | "),
    },
    authEvidence: {
      title: "Authorization Evidence",
      copy: `authorizationEvidenceGenerated=${authorizationDesign.authorizationEvidence.authorizationEvidenceGenerated}; authorizationCompleteness=${authorizationDesign.authorizationEvidence.authorizationCompleteness}; realIntegrationStatus=${authorizationDesign.authorizationEvidence.realIntegrationStatus}; configSimulationStatus=${authorizationDesign.authorizationEvidence.configSimulationStatus}; rollbackSimulationStatus=${authorizationDesign.authorizationEvidence.rollbackSimulationStatus}`,
    },
    humanApprovalReview: {
      title: "Human Approval Review",
      copy: `authorizationComplete=${humanApprovalReview.authorizationComplete}; humanApprovalStatus=${humanApprovalReview.humanApprovalStatus}; realIntegrationAllowed=${humanApprovalReview.realIntegrationAllowed}; guardedRealTestAllowed=${humanApprovalReview.guardedRealTestAllowed}; finalDecision=${humanApprovalReview.finalDecision}`,
    },
    humanApprovalMissingFields: {
      title: "Authorization Packet Missing Fields",
      copy: humanApprovalReview.missingFields.join(" | "),
    },
    guardedRealTestReadiness: {
      title: "Guarded Real Test Readiness",
      copy: `guardedRealTestAllowed=${humanApprovalReview.guardedRealTestReadiness.guardedRealTestAllowed}; incompleteAuthorizationBlocks=${humanApprovalReview.guardedRealTestReadiness.incompleteAuthorizationBlocks}; missingHumanApprovalBlocks=${humanApprovalReview.guardedRealTestReadiness.missingHumanApprovalBlocks}; missingExplicitUserApprovalBlocks=${humanApprovalReview.guardedRealTestReadiness.missingExplicitUserApprovalBlocks}`,
    },
    phase600Readiness: {
      title: "Phase600 Readiness Review",
      copy: `authorizationComplete=${readinessReview.authorizationComplete}; humanApprovalStatus=${readinessReview.humanApprovalStatus}; readinessReviewPassed=${readinessReview.readinessReviewPassed}; realIntegrationAllowed=${readinessReview.realIntegrationAllowed}; guardedRealTestAllowed=${readinessReview.guardedRealTestAllowed}; blocker=${readinessReview.blocker}`,
    },
    phase600MissingFields: {
      title: "Phase600 Missing Fields",
      copy: readinessReview.missingFields.join(" | "),
    },
    phase600NextAction: {
      title: "Phase600 Next Action",
      copy: readinessReview.nextAction,
    },
    phase601Preparation: {
      title: "Phase601 Preparation Preview",
      copy: `blocker=${preparationReview.blocker}; preparationOnly=${preparationReview.preparationOnly}; phase602Candidate=${preparationReview.phase602Candidate}; finalUserConfirmationRequired=${preparationReview.finalUserConfirmationRequired}; realTestExecuted=${preparationReview.realTestExecuted}`,
    },
    phase601CommandBundle: {
      title: "Phase601 Final Command Bundle",
      copy: `commandPreview=${preparationReview.finalCommandBundlePreview.commandPreview}; rollbackPreviewReady=${preparationReview.nextPhaseGateReport.rollbackPreviewReady}; emergencyDisableReady=${preparationReview.nextPhaseGateReport.emergencyDisableReady}; commandExecuted=false`,
    },
    phase602OneShotResult: {
      title: "Phase602 One-Shot Result",
      copy: `blocker=${oneShotReview.blocker}; oneShotExecuted=${oneShotReview.oneShotExecuted}; requestAttemptCount=${oneShotReview.requestAttemptCount}; retryAttemptCount=${oneShotReview.retryAttemptCount}; testStatus=${oneShotReview.testStatus}; responseClassification=${oneShotReview.responseClassification}`,
    },
    phase602Cleanup: {
      title: "Phase602 Cleanup / Rollback",
      copy: `cleanupExecuted=${oneShotReview.cleanupExecuted}; rollbackResult=${oneShotReview.cleanup.rollbackResult}; userCodexConfigModified=${oneShotReview.userCodexConfigModified}; projectCodexConfigModified=${oneShotReview.projectCodexConfigModified}; rawBaseUrlValueExposed=${oneShotReview.rawBaseUrlValueExposed}`,
    },
    phase603CustomProviderRoute: {
      title: "Phase603 Custom Provider Route",
      copy: `openaiBaseUrlOverrideHonored=${customProviderReview.openaiBaseUrlOverrideHonored}; nextRoute=${customProviderReview.nextRoute}; authJsonRead=${customProviderReview.authJsonRead}; commandExecuted=${customProviderReview.commandExecuted}; realTestExecuted=${customProviderReview.realTestExecuted}`,
    },
    phase603CommandBundle: {
      title: "Phase603 Command Bundle Preview",
      copy: `commandPreview=${customProviderReview.commandBundle.commandPreview}; negativeControl=${customProviderReview.negativeControlPlan.commandPreview}; rawBaseUrlValueExposed=${customProviderReview.rawBaseUrlValueExposed}`,
    },
    phase604CustomProviderResult: {
      title: "Phase604 Custom Provider Result",
      copy: `blocker=${customProviderOneShotReview.blocker}; negativeControlExecuted=${customProviderOneShotReview.negativeControlExecuted}; negativeControlPassed=${customProviderOneShotReview.negativeControlPassed}; selectedProviderId=${customProviderOneShotReview.selectedProviderId || "null"}; oneShotExecuted=${customProviderOneShotReview.oneShotExecuted}; requestAttemptCount=${customProviderOneShotReview.requestAttemptCount}; responseClassification=${customProviderOneShotReview.responseClassification}`,
    },
    phase604Cleanup: {
      title: "Phase604 Cleanup / Rollback",
      copy: `cleanupExecuted=${customProviderOneShotReview.cleanupExecuted}; rollbackResult=${customProviderOneShotReview.cleanup.rollbackResult}; authJsonRead=${customProviderOneShotReview.authJsonRead}; authJsonTouched=${customProviderOneShotReview.authJsonTouched}; persistentConfigWritePerformed=${customProviderOneShotReview.persistentConfigWritePerformed}`,
    },
    phase607Intake: {
      title: "Phase607R-Fix Interactive Terminal Intake",
      copy: `route=${interactiveTerminalIntake.route}; selectedProviderId=${interactiveTerminalIntake.selectedProviderId || "null"}; manualResultInputExists=${interactiveTerminalIntake.manualResultInputExists}; requestAttemptCount=${interactiveTerminalIntake.requestAttemptCount}; responseClassification=${interactiveTerminalIntake.responseClassification}; cleanupStatus=${interactiveTerminalIntake.cleanupStatus}; ${interactiveTerminalIntake.configWriteStatus}; nextAction=${interactiveTerminalIntake.nextAction}`,
    },
    phase607Ledger: {
      title: "Phase607R-Fix Evidence Ledger",
      copy: `ledger=${interactiveTerminalIntake.ledgerJson}; phase604FirstAttemptImported=${interactiveTerminalIntake.phase604FirstAttemptImported}; phase605RootCauseImported=${interactiveTerminalIntake.phase605RootCauseImported}; manualCommandPackReferenced=${interactiveTerminalIntake.manualCommandPackReferenced}; codexOneShotExecutedByThisPhase=false; providerCallsMadeByThisPhase=false`,
    },
    phase610rCodexExecResult: {
      title: "Phase610R-Fix Codex Exec Result",
      copy: `status=${codexExecIntake.status}; selectedProviderId=${codexExecIntake.selectedProviderId || "null"}; requestAttemptCount=${codexExecIntake.requestAttemptCount}; retryAttemptCount=${codexExecIntake.retryAttemptCount}; responseClassification=${codexExecIntake.responseClassification}; stderrWarningNonBlocking=${codexExecIntake.stderrWarningNonBlocking}`,
    },
    phase610rBoundary: {
      title: "Phase610R-Fix Boundary",
      copy: `notProductionReady=${codexExecIntake.notProductionReady}; notRepeatedReliabilityProven=${codexExecIntake.notRepeatedReliabilityProven}; noChatIntegration=${codexExecIntake.noChatIntegration}; codexOneShotExecutedByThisPhase=false; providerCallsMadeByThisPhase=false; authJsonRead=false; codexConfigModified=false`,
    },
    phase611rReliabilityDesign: {
      title: "Phase611R-Fix Reliability Design",
      copy: `phase610OneShotPassOnce=${repeatedReliabilityDesign.phase610OneShotPassOnce}; designReady=${repeatedReliabilityDesign.phase611ReliabilityDesignReady}; maxPlannedAttempts=${repeatedReliabilityDesign.maxPlannedAttempts}; executedYet=${repeatedReliabilityDesign.executedYet}; repeatedReliabilityProven=false; productionReadyClaimed=false`,
    },
    phase611rAttemptPlan: {
      title: "Phase611R-Fix Attempt Plan",
      copy: `selectedProviderId=${repeatedReliabilityDesign.selectedProviderId}; maxRequests=1; retryLimit=0; manualOrExplicitExecutionRequired=true; stopOnFailure=true; no /chat integration; not release ready`,
    },
    phase611rGuardedTestDesign: {
      title: "Phase611R-Fix Guarded Test Design",
      copy: `phase610OneShotPassOnce=${repeatedGuardedTestDesign.phase610OneShotPassOnce}; maxPlannedAttempts=${repeatedGuardedTestDesign.maxPlannedAttempts}; maxRequestsTotal=${repeatedGuardedTestDesign.maxRequestsTotal}; codexExecExecutedByThisPhase=false; providerCallsMadeByThisPhase=false`,
    },
    phase611rPhase612Gate: {
      title: "Phase612R-Fix Explicit Confirmation Gate",
      copy: `phase612ExecutionRequiresExplicitConfirmation=${repeatedGuardedTestDesign.phase612ExecutionRequiresExplicitConfirmation}; notProductionReady=${repeatedGuardedTestDesign.notProductionReady}; notReleaseReady=${repeatedGuardedTestDesign.notReleaseReady}; notChatIntegrated=${repeatedGuardedTestDesign.notChatIntegrated}; nextAction=${repeatedGuardedTestDesign.nextAction}`,
    },
    phase612rRepeatedResult: {
      title: "Phase612R-Fix Repeated Result",
      copy: `repeatedTestExecuted=${repeatedGuardedTestResult.repeatedTestExecuted}; selectedProviderId=${repeatedGuardedTestResult.selectedProviderId}; completedAttempts=${repeatedGuardedTestResult.completedAttempts}; totalRequestAttemptCount=${repeatedGuardedTestResult.totalRequestAttemptCount}; repeatedReliabilityClassification=${repeatedGuardedTestResult.repeatedReliabilityClassification}; allAttemptsPassed=${repeatedGuardedTestResult.allAttemptsPassed}`,
    },
    phase612rRepeatedBoundary: {
      title: "Phase612R-Fix Boundary",
      copy: `authJsonRead=false; codexConfigModified=false; projectCodexConfigModified=false; chatModified=false; chatGatewayExecuteModified=false; deploy/release/tag/push/commit=false; productionReadyClaimed=false; releaseReadyClaimed=false`,
    },
    phase613rClosure: {
      title: "Phase613R-Fix Closure",
      copy: `phase612RepeatedPass=${repeatedReliabilityClosure.phase612RepeatedPass}; selectedProviderId=${repeatedReliabilityClosure.selectedProviderId}; completedAttempts=${repeatedReliabilityClosure.completedAttempts}; totalRequestAttemptCount=${repeatedReliabilityClosure.totalRequestAttemptCount}; capabilityBoundary=${repeatedReliabilityClosure.capabilityBoundary}`,
    },
    phase613rNextGate: {
      title: "Phase613R-Fix Next Gate",
      copy: `nextGate=${repeatedReliabilityClosure.nextGate}; notProductionReady=${repeatedReliabilityClosure.notProductionReady}; notReleaseReady=${repeatedReliabilityClosure.notReleaseReady}; notChatIntegrated=${repeatedReliabilityClosure.notChatIntegrated}; notChatGatewayExecuteIntegrated=${repeatedReliabilityClosure.notChatGatewayExecuteIntegrated}`,
    },
    phase614rPreviewGate: {
      title: "Phase614R-Fix Preview Gate",
      copy: `previewOnly=${controlledIntegrationPreviewGate.previewOnly}; routeId=${controlledIntegrationPreviewGate.routeId}; integrationMode=${controlledIntegrationPreviewGate.integrationMode}; runtimeIntegrated=false; chatIntegrated=false; chatGatewayExecuteIntegrated=false`,
    },
    phase614rRouteContract: {
      title: "Phase614R-Fix Route Contract",
      copy: `allowedEntryPoints=${controlledIntegrationPreviewGate.allowedEntryPoints.join(",")}; forbiddenEntryPoints=${controlledIntegrationPreviewGate.forbiddenEntryPoints.join(",")}; maxRequestsDefault=${controlledIntegrationPreviewGate.maxRequestsDefault}; maxRequestsHardLimit=${controlledIntegrationPreviewGate.maxRequestsHardLimit}; retryLimit=0`,
    },
    phase615rApprovalPacket: {
      title: "Phase615R-Fix Approval Packet",
      copy: `approvalPacketReady=${runtimeIntegrationApprovalPacket.approvalPacketReady}; runtimeIntegrationNotExecuted=${runtimeIntegrationApprovalPacket.runtimeIntegrationNotExecuted}; approvalRequired=${runtimeIntegrationApprovalPacket.approvalRequired}; selectedProviderId=${runtimeIntegrationApprovalPacket.selectedProviderId}; productionReadyClaimed=false; releaseReadyClaimed=false`,
    },
    phase615rOperatorChecklist: {
      title: "Phase615R-Fix Operator Checklist",
      copy: `operatorChecklistGenerated=${runtimeIntegrationApprovalPacket.operatorChecklistGenerated}; rollbackPlanGenerated=${runtimeIntegrationApprovalPacket.rollbackPlanGenerated}; emergencyDisablePlanGenerated=${runtimeIntegrationApprovalPacket.emergencyDisablePlanGenerated}; maxRequestsBudgetPolicyGenerated=${runtimeIntegrationApprovalPacket.maxRequestsBudgetPolicyGenerated}; nextPhase=${runtimeIntegrationApprovalPacket.nextPhase}`,
    },
    phase616r620rDryRunCandidate: {
      title: "Phase616R-620R Dry-Run Candidate",
      copy: `dryRunCandidateSealed=${runtimeCandidateDryRunBundle.dryRunCandidateSealed}; candidateMode=${runtimeCandidateDryRunBundle.candidateMode}; selectedProviderId=${runtimeCandidateDryRunBundle.selectedProviderId}; runtimeIntegrationExecuted=${runtimeCandidateDryRunBundle.runtimeIntegrationExecuted}; productionReadyClaimed=false; releaseReadyClaimed=false`,
    },
    phase616r620rRouteContract: {
      title: "Phase616R-620R Route Contract Dry-Run",
      copy: `routeId=${runtimeCandidateDryRunBundle.routeId}; maxRequestsDefault=${runtimeCandidateDryRunBundle.maxRequestsDefault}; maxRequestsHardLimit=${runtimeCandidateDryRunBundle.maxRequestsHardLimit}; retryLimit=${runtimeCandidateDryRunBundle.retryLimit}; /chat=false; /chat-gateway/execute=false; providerRuntimeModified=false; nextPhase=${runtimeCandidateDryRunBundle.nextPhase}`,
    },
    phase621r628rIsolatedCandidate: {
      title: "Phase621R-628R Isolated Runtime Candidate",
      copy: `routeId=${controlledRuntimeCandidatePath.routeId}; dryRunSmokePassed=${controlledRuntimeCandidatePath.dryRunSmokePassed}; guardedIsolatedOneShotPassed=${controlledRuntimeCandidatePath.guardedIsolatedOneShotPassed}; runtimeIntegrated=false; /chat=false; /chat-gateway/execute=false`,
    },
    phase621r628rReliability: {
      title: "Phase621R-628R Guarded Reliability",
      copy: `classification=${controlledRuntimeCandidatePath.repeatedReliabilityClassification}; completedAttempts=${controlledRuntimeCandidatePath.completedAttempts}; totalRequestAttemptCount=${controlledRuntimeCandidatePath.totalRequestAttemptCount}; totalRetryAttemptCount=${controlledRuntimeCandidatePath.totalRetryAttemptCount}; providerCallsMadeByThisPhase=false; codexExecExecutedByThisPhase=false`,
    },
    phase629rFinalApproval: {
      title: "Phase629R-Fix Final Human Approval Packet",
      copy: `phase621r628rImported=${mainChainFinalApprovalPacket.phase621r628rImported}; approvalPacketReady=${mainChainFinalApprovalPacket.approvalPacketReady}; selectedProviderId=${mainChainFinalApprovalPacket.selectedProviderId}; mainChainIntegrationNotExecuted=${mainChainFinalApprovalPacket.mainChainIntegrationNotExecuted}; finalHumanApprovalRequired=${mainChainFinalApprovalPacket.finalHumanApprovalRequired}`,
    },
    phase629rGoNoGo: {
      title: "Phase629R-Fix Final Go/No-Go",
      copy: `chatModified=${mainChainFinalApprovalPacket.chatModified}; chatGatewayExecuteModified=${mainChainFinalApprovalPacket.chatGatewayExecuteModified}; providerRuntimeModified=${mainChainFinalApprovalPacket.providerRuntimeModified}; codexExecExecutedByThisPhase=${mainChainFinalApprovalPacket.codexExecExecutedByThisPhase}; providerCallsMadeByThisPhase=${mainChainFinalApprovalPacket.providerCallsMadeByThisPhase}; nextPhase=${mainChainFinalApprovalPacket.nextPhase}`,
    },
    phase630rDesignPatch: {
      title: "Phase630R-Fix Design Patch",
      copy: `phase629rImported=${mainChainDesignPatch.phase629rImported}; designPatchReady=${mainChainDesignPatch.designPatchReady}; patchPreviewOnly=${mainChainDesignPatch.patchPreviewOnly}; mainChainPatchNotApplied=${mainChainDesignPatch.mainChainPatchNotApplied}; selectedProviderId=${mainChainDesignPatch.selectedProviderId}; phase631ApprovalRequired=${mainChainDesignPatch.phase631ApprovalRequired}`,
    },
    phase630rRoutePreview: {
      title: "Phase630R-Fix Route Patch Preview",
      copy: `patchId=${mainChainDesignPatch.patchId}; patchMode=${mainChainDesignPatch.patchMode}; targetEntryPointsPreview=${mainChainDesignPatch.targetEntryPointsPreview.join(",")}; targetEntryPointsModified=${mainChainDesignPatch.targetEntryPointsModified.join(",") || "none"}; runtimeIntegrated=false; nextPhase=${mainChainDesignPatch.nextPhase}`,
    },
    phase639rP1ApprovalPreview: {
      title: "Phase639R P1 Approval Preview",
      copy: `mainChainApprovalPacketReady=${phase639RP1ApprovalPreview.mainChainApprovalPacketReady}; providerRuntimeApprovalPacketReady=${phase639RP1ApprovalPreview.providerRuntimeApprovalPacketReady}; implementationExecuted=${phase639RP1ApprovalPreview.implementationExecuted}; chatModified=${phase639RP1ApprovalPreview.chatModified}; chatGatewayExecuteModified=${phase639RP1ApprovalPreview.chatGatewayExecuteModified}; providerRuntimeModified=${phase639RP1ApprovalPreview.providerRuntimeModified}; providerCallsMade=${phase639RP1ApprovalPreview.providerCallsMade}; productionReady=${phase639RP1ApprovalPreview.productionReady}; releaseReady=${phase639RP1ApprovalPreview.releaseReady}; nextApprovalRequired=${phase639RP1ApprovalPreview.nextApprovalRequired}`,
    },
    phase639rNightlyFallbackPanel: {
      title: "Phase639R-Nightly Fallback Operator Panel",
      copy: `Task Scheduler status: not registered; blocker: windows_task_scheduler_access_denied; fallback cmd available=${phase639RNightlyFallbackPanel.fallbackCmdAvailable}; fallback ps1 available=${phase639RNightlyFallbackPanel.fallbackPs1Available}; Phase632 preflight required=${phase639RNightlyFallbackPanel.phase632PreflightRequired}; latest evidence path=${phase639RNightlyFallbackPanel.latestEvidencePath}; next action: admin/permissioned registration session or manual fallback launcher; no provider call; no secret access; no /chat modification; no /chat-gateway/execute modification`,
    },
    phase640rNightlyRetryPack: {
      title: "Phase640R-Nightly Permissioned Retry Pack",
      copy: `permissioned retry pack ready=${phase640RNightlyPermissionedRetryPack.permissionedRetryPackReady}; admin checklist ready=${phase640RNightlyPermissionedRetryPack.adminChecklistGenerated}; verify script ready=${phase640RNightlyPermissionedRetryPack.verifyScriptGenerated}; result intake example ready=${phase640RNightlyPermissionedRetryPack.resultInputExampleGenerated}; nightly automation enabled=false; scheduledTaskRegistered=${phase640RNightlyPermissionedRetryPack.scheduledTaskRegistered}; next action: manually run retry script in a permissioned session; no auto elevation; no permission bypass; no Provider call; no /chat or /chat-gateway/execute modification`,
    },
    phase641rNightlyRegistrationIntake: {
      title: "Phase641R-Nightly Registration Result Intake",
      copy: `resultInputExists=${phase641RNightlyRegistrationResultIntake.inputExists}; resultInputValid=${phase641RNightlyRegistrationResultIntake.inputValid}; systemVerificationExecuted=${phase641RNightlyRegistrationResultIntake.systemVerificationExecuted}; scheduledTaskRegistered=${phase641RNightlyRegistrationResultIntake.scheduledTaskRegistered}; nightlyAutomationEnabled=${phase641RNightlyRegistrationResultIntake.nightlyAutomationEnabled}; blocker=${phase641RNightlyRegistrationResultIntake.blocker || "null"}; nextRunTime=${phase641RNightlyRegistrationResultIntake.nextRunTime ?? "null"}; latestEvidencePath=${phase641RNightlyRegistrationResultIntake.latestEvidencePath}`,
    },
    phase640rExternalToolMode: {
      title: "Phase640R External Tool Mode",
      copy: `External Codex Relay Tool; token-saving tool mode; externalToolMode=${phase640RExternalToolMode.externalToolMode}; model_provider=crs controlled repeated_pass=${phase640RExternalToolMode.modelProviderCrsRepeatedPass}; Phase632 preflight mandatory=${phase640RExternalToolMode.tokenSavingPreflightRequired}; notChatIntegrated=${phase640RExternalToolMode.chatIntegrationPlanned === false}; notChatGatewayExecuteIntegrated=${phase640RExternalToolMode.chatGatewayExecuteIntegrationPlanned === false}; notProviderRuntime=${phase640RExternalToolMode.providerRuntimeIntegrationPlanned === false}; notProductionTrafficPath=${phase640RExternalToolMode.notProductionTrafficPath}`,
    },
    phase641r645rExternalToolBundle: {
      title: "Phase641R-645R External Tool Bundle",
      copy: `toolMode=${phase641R645RExternalToolBundle.toolMode}; cliWrapperReady=${phase641R645RExternalToolBundle.cliWrapperReady}; operatorPanelReady=${phase641R645RExternalToolBundle.operatorPanelReady}; nightlySafeRunnerReliabilityChecked=${phase641R645RExternalToolBundle.nightlySafeRunnerReliabilityChecked}; openSourceDryRunToolPackReady=${phase641R645RExternalToolBundle.openSourceDryRunToolPackReady}; tokenSavingBenchmarkRechecked=${phase641R645RExternalToolBundle.tokenSavingBenchmarkRechecked}; notChatIntegrated=${phase641R645RExternalToolBundle.chatIntegrationPlanned === false}; notChatGatewayExecuteIntegrated=${phase641R645RExternalToolBundle.chatGatewayExecuteIntegrationPlanned === false}; notProviderRuntime=${phase641R645RExternalToolBundle.providerRuntimeIntegrationPlanned === false}; providerCallsMade=false; codexExecExecutedByThisBundle=false`,
    },
    phase646r650rExternalToolDashboard: {
      title: "Phase646R-650R Daily Workflow Dashboard",
      copy: `externalToolMode=${phase646R650RExternalToolClosure.externalToolMode}; dailyWorkflowReady=${phase646R650RExternalToolClosure.dailyWorkflowReady}; taskQueueLedgerReady=${phase646R650RExternalToolClosure.taskQueueLedgerReady}; evidenceDashboardReady=${phase646R650RExternalToolClosure.evidenceDashboardReady}; tokenSavingReportReady=${phase646R650RExternalToolClosure.tokenSavingReportReady}; nextUsePlaybookReady=${phase646R650RExternalToolClosure.nextUsePlaybookReady}; notChatIntegrated=${phase646R650RExternalToolClosure.chatIntegrationPlanned === false}; notChatGatewayExecuteIntegrated=${phase646R650RExternalToolClosure.chatGatewayExecuteIntegrationPlanned === false}; notProviderRuntime=${phase646R650RExternalToolClosure.providerRuntimeIntegrationPlanned === false}; productionReady=false; releaseReady=false; providerCallsMade=false; codexExecExecutedByThisBundle=false`,
    },
  };
}
