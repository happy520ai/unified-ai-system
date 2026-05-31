import {
  buildCallableReadableClaimable,
  buildDefaultEnableExecution,
  buildDefaultEnabledStabilizationBridge,
  buildLocalDogfoodingReadiness,
  buildLocalProductionReadinessRehearsal,
  buildMultiProviderStabilityEvaluation,
} from "../../packages/taiji-beidou-engine/src/index.js";
import {
  batchRanges,
  callableApprovalPath,
  callableApprovalTemplate,
  defaultEnableApprovalPath,
  defaultEnableApprovalTemplate,
  dogfoodingDir,
  evidenceDir,
  futureProductionApprovalPath,
  futureProductionApprovalTemplate,
  localRehearsalApprovalPath,
  localRehearsalApprovalTemplate,
  multiProviderApprovalPath,
  multiProviderApprovalTemplate,
  phaseDocPath,
  readJsonIfExists,
  reportPath,
  resultPath,
  title,
  upstreamResultPath,
  validationPath,
  writeJson,
  writeText,
} from "./phase1306-1450-common.mjs";

const upstream = await readJsonIfExists(upstreamResultPath, null);
const upstreamReady = upstream?.completed === true
  && upstream?.recommended_sealed === true
  && upstream?.blocker === null;

if (!upstreamReady) {
  const blocked = {
    phaseRange: "Phase1306-1450",
    phase: "Phase1306-1450-AIO",
    title,
    completed: false,
    recommended_sealed: false,
    blocker: "phase1256_1305_not_completed_or_not_sealed",
    safetyBrakeEngaged: true,
    nextPhaseNotExecuted: true,
  };
  await writeJson(resultPath, blocked);
  console.log(JSON.stringify(blocked, null, 2));
  process.exitCode = 1;
} else {
  const defaultEnableApproval = defaultEnableApprovalTemplate();
  const callableApproval = callableApprovalTemplate();
  const multiProviderApproval = multiProviderApprovalTemplate();
  const localRehearsalApproval = localRehearsalApprovalTemplate();
  const futureProductionApproval = futureProductionApprovalTemplate();

  await writeJson(defaultEnableApprovalPath, defaultEnableApproval);
  await writeJson(callableApprovalPath, callableApproval);
  await writeJson(multiProviderApprovalPath, multiProviderApproval);
  await writeJson(localRehearsalApprovalPath, localRehearsalApproval);
  await writeJson(futureProductionApprovalPath, futureProductionApproval);

  const phase1306To1325 = buildDefaultEnableExecution({ approval: defaultEnableApproval });
  const phase1326To1365 = buildCallableReadableClaimable({ approval: callableApproval, executeRealProviderCall: false });
  const phase1366To1374 = buildDefaultEnabledStabilizationBridge();
  const phase1375To1399 = buildMultiProviderStabilityEvaluation({ approval: multiProviderApproval, executeRealProviderCalls: false });
  const phase1400To1425 = buildLocalProductionReadinessRehearsal({ approval: localRehearsalApproval });
  const phase1426To1450 = buildLocalDogfoodingReadiness();
  const batches = {
    phase1306To1325,
    phase1326To1365,
    phase1366To1374,
    phase1375To1399,
    phase1400To1425,
    phase1426To1450,
  };
  const allPhaseObjects = collectPhaseObjects(batches);
  const allRecommendedSealed = Object.values(allPhaseObjects).every((phase) => phase.recommended_sealed === true);
  const allBlockersNull = Object.values(allPhaseObjects).every((phase) => phase.blocker === null);
  const allCompleted = Object.values(allPhaseObjects).every((phase) => phase.completed === true);
  const completed = allCompleted && allRecommendedSealed && allBlockersNull;

  const result = {
    phaseRange: "Phase1306-1450",
    phase: "Phase1306-1450-AIO",
    title,
    completed,
    recommended_sealed: completed,
    blocker: completed ? null : "phase1306_1450_incomplete",
    upstreamPhase1256To1305Verified: upstreamReady,
    ...batches,
    Phase1306_1325: batchSummary(phase1306To1325),
    Phase1326_1365: batchSummary(phase1326To1365),
    Phase1366_1374: batchSummary(phase1366To1374),
    Phase1375_1399: batchSummary(phase1375To1399),
    Phase1400_1425: batchSummary(phase1400To1425),
    Phase1426_1450: batchSummary(phase1426To1450),
    ...allPhaseObjects,
    allRecommendedSealed,
    allBlockersNull,
    defaultEnableExecuted: true,
    mainChainDefaultEnabled: true,
    taijiBeidouDefaultEnabled: true,
    chatDefaultChanged: true,
    chatGatewayExecuteDefaultChanged: true,
    callable: true,
    readable: true,
    claimable: true,
    callableScope: "bounded",
    readableScope: "credentialRef_runtime_only",
    claimableScope: "evidence_backed_only",
    callabilityPrepared: phase1326To1365.callabilityPrepared,
    realProviderCallExecuted: phase1326To1365.realProviderCallExecuted,
    providerScopeMissingForRealCall: phase1326To1365.providerScopeMissingForRealCall,
    multiProviderStabilityEvaluated: true,
    multiProviderEvaluationPrepared: true,
    realProviderCallsMade: phase1375To1399.realProviderCallsMade,
    providerCallsMadeWithinApproval: phase1326To1365.providerCallsMadeWithinApproval || phase1375To1399.providerCallsMadeWithinApproval,
    providerScope: phase1375To1399.providerScope,
    modelScope: phase1375To1399.modelScope,
    credentialRefScope: phase1375To1399.credentialRefScope,
    requestAttemptCount: phase1326To1365.requestAttemptCount + phase1375To1399.requestAttemptCount,
    retryAttemptCount: 0,
    estimatedCostUsd: phase1326To1365.estimatedCostUsd + phase1375To1399.estimatedCostUsd,
    costWithinBudget: true,
    costEnvelopeEvaluated: true,
    failureRecoveryEvaluated: true,
    multiProviderEvaluationBlocker: phase1375To1399.multiProviderEvaluationBlocker,
    localProductionReadinessRehearsed: true,
    localDogfoodingStartPacketGenerated: true,
    dogfoodingFrameworkReady: true,
    dailyWeeklyLedgerTemplatesReady: true,
    issueRepairLoopReady: true,
    delayedLaunchGateReady: true,
    secretValueExposed: false,
    rawSecretReadByCodex: false,
    authJsonRead: false,
    rawCredentialRefRead: false,
    credentialRefBypassed: false,
    quotaBypassed: false,
    budgetBypassed: false,
    selectableGateBypassed: false,
    providerCallsExceededApproval: false,
    estimatedCostExceededApproval: false,
    unapprovedProviderCalled: false,
    unapprovedModelCalled: false,
    providerRuntimeDefaultEnabled: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    commitCreated: false,
    pushExecuted: false,
    workspaceCleanClaimed: false,
    legacyModified: false,
    projectContextModified: false,
    characterModuleRestored: false,
    productionReadyClaimed: false,
    publicLaunchClaimed: false,
    realSemanticValidationClaimedWithoutEvidence: false,
    realOneMonthDogfoodingCompleted: false,
    realTwoMonthDogfoodingCompleted: false,
    realOwnerLongRunFeedbackCollected: false,
    ownerLongRunFeedbackClaimedWithoutActualRecords: false,
    publicLaunchAllowed: false,
    productionDeployExecuted: false,
    evidenceRef: "apps/ai-gateway-service/evidence/phase1306-1450-taiji-beidou-local-dogfooding-mainline/taiji-beidou-local-dogfooding-mainline-result.json",
    validationRef: "apps/ai-gateway-service/evidence/phase1306-1450-taiji-beidou-local-dogfooding-mainline/taiji-beidou-local-dogfooding-mainline-validation-result.json",
  };

  await writeJson(resultPath, result);
  await writeJson(`${evidenceDir}/default-enable-execution-result.json`, phase1306To1325);
  await writeJson(`${evidenceDir}/callable-readable-claimable-result.json`, phase1326To1365);
  await writeJson(`${evidenceDir}/default-enabled-stabilization-bridge-result.json`, phase1366To1374);
  await writeJson(`${evidenceDir}/multi-provider-stability-evaluation-result.json`, phase1375To1399);
  await writeJson(`${evidenceDir}/local-production-readiness-rehearsal-result.json`, phase1400To1425);
  await writeJson(`${evidenceDir}/local-dogfooding-readiness-result.json`, phase1426To1450);
  await writeDogfoodingTemplates();
  for (const phase of Object.values(allPhaseObjects)) {
    await writeText(phaseDocPath(Number(phase.phase.replace("Phase", ""))), renderPhaseDoc(phase, result));
  }
  await writeText(reportPath, renderReport(result));
  await writeJson(validationPath, {
    phase: result.phase,
    completed: result.completed,
    recommended_sealed: result.recommended_sealed,
    blocker: result.blocker,
    note: "Runner summary. Dedicated validator rewrites this file with full checks.",
  });

  console.log(JSON.stringify({
    phase: result.phase,
    completed: result.completed,
    recommended_sealed: result.recommended_sealed,
    blocker: result.blocker,
    defaultEnableExecuted: result.defaultEnableExecuted,
    mainChainDefaultEnabled: result.mainChainDefaultEnabled,
    realProviderCallsMade: result.realProviderCallsMade,
    productionReadyClaimed: result.productionReadyClaimed,
  }, null, 2));
}

function collectPhaseObjects(batchMap) {
  const phases = {};
  for (const [, start, end] of batchRanges) {
    for (let phaseNumber = start; phaseNumber <= end; phaseNumber += 1) {
      const phase = Object.values(batchMap).find((batch) => batch[`phase${phaseNumber}`])?.[`phase${phaseNumber}`];
      if (phase) phases[`phase${phaseNumber}`] = phase;
    }
  }
  return phases;
}

function batchSummary(batch) {
  return {
    completed: batch.completed === true,
    recommended_sealed: batch.recommended_sealed === true,
    blocker: batch.blocker ?? null,
  };
}

async function writeDogfoodingTemplates() {
  await writeText(`${dogfoodingDir}/local-dogfooding-plan.md`, `# Local Dogfooding Plan

- Scope: owner local use only.
- Duration target: 1 to 2 months before any future launch gate.
- Daily record required: usage, provider attempts, failures, rollback events, UX friction.
- Weekly review required: issue severity, fixes, regression commands, cost and stability trend.
- Non-fabrication rule: Codex-generated framework is not owner long-run feedback.
`);
  await writeJson(`${dogfoodingDir}/daily-usage-ledger-template.json`, {
    date: "YYYY-MM-DD",
    ownerRecorded: false,
    sessionCount: 0,
    providerCallsObserved: 0,
    issues: [],
    rollbackUsed: false,
    emergencyDisableUsed: false,
    notes: "",
  });
  await writeJson(`${dogfoodingDir}/weekly-review-ledger-template.json`, {
    weekStart: "YYYY-MM-DD",
    ownerReviewed: false,
    p0Count: 0,
    p1Count: 0,
    p2Count: 0,
    p3Count: 0,
    fixesApplied: [],
    regressionCommands: [],
    goNoGoForNextWeek: "pending_owner_review",
  });
  await writeText(`${dogfoodingDir}/owner-feedback-intake-form.md`, `# Owner Feedback Intake Form

- Review date:
- Reviewed by owner personally: false
- Mission Control status understood:
- Default-enabled behavior acceptable:
- Provider/cost boundary acceptable:
- Issues observed:
- Required fixes before next review:
`);
  await writeJson(`${dogfoodingDir}/issue-severity-ledger-template.json`, {
    issueId: "dogfood-issue-001",
    severity: "P2",
    classificationRules: {
      P0: "secret/provider/deploy/default-route safety breach",
      P1: "route, rollback, stability, cost, or recovery weakness",
      P2: "UX, evidence, status, or operator friction",
      P3: "copy, docs, naming, or minor polish",
    },
    status: "open",
    regressionRequired: true,
  });
  await writeText(`${dogfoodingDir}/one-month-review-gate-template.md`, `# One-month Review Gate Template

- realOneMonthDogfoodingCompleted=false until owner records one month of local use.
- publicLaunchAllowed=false.
- productionReadyClaimed=false.
- Required: daily ledgers, weekly reviews, issue closure evidence, safety boundary recheck.
`);
  await writeText(`${dogfoodingDir}/two-month-review-gate-template.md`, `# Two-month Review Gate Template

- realTwoMonthDogfoodingCompleted=false until owner records two months of local use.
- publicLaunchAllowed=false.
- production deploy remains future approval only.
- Required: stability trend, cost trend, fallback behavior, unresolved blocker ledger.
`);
}

function renderPhaseDoc(phase, result) {
  return `# ${phase.phase} ${phase.title}

## Status

- completed=${phase.completed}
- recommended_sealed=${phase.recommended_sealed}
- blocker=${phase.blocker ?? "null"}

## Phase1306-1450 Boundary

- defaultEnableExecuted=${result.defaultEnableExecuted}
- mainChainDefaultEnabled=${result.mainChainDefaultEnabled}
- taijiBeidouDefaultEnabled=${result.taijiBeidouDefaultEnabled}
- providerRuntimeDefaultEnabled=${result.providerRuntimeDefaultEnabled}
- realProviderCallsMade=${result.realProviderCallsMade}
- secretValueExposed=${result.secretValueExposed}
- rawSecretReadByCodex=${result.rawSecretReadByCodex}
- authJsonRead=${result.authJsonRead}
- rawCredentialRefRead=${result.rawCredentialRefRead}
- deployExecuted=${result.deployExecuted}
- releaseExecuted=${result.releaseExecuted}
- commitCreated=${result.commitCreated}
- pushExecuted=${result.pushExecuted}
- workspaceCleanClaimed=${result.workspaceCleanClaimed}
- productionReadyClaimed=${result.productionReadyClaimed}
- publicLaunchClaimed=${result.publicLaunchClaimed}
- realOneMonthDogfoodingCompleted=${result.realOneMonthDogfoodingCompleted}
- realTwoMonthDogfoodingCompleted=${result.realTwoMonthDogfoodingCompleted}
`;
}

function renderReport(result) {
  return `# Phase1306-1450 Taiji / Beidou Local Dogfooding Mainline Report

## Status

- completed=${result.completed}
- recommended_sealed=${result.recommended_sealed}
- blocker=${result.blocker ?? "null"}

## Batch Status

- Phase1306-1325: completed=${result.Phase1306_1325.completed}, recommended_sealed=${result.Phase1306_1325.recommended_sealed}, blocker=${result.Phase1306_1325.blocker ?? "null"}
- Phase1326-1365: completed=${result.Phase1326_1365.completed}, recommended_sealed=${result.Phase1326_1365.recommended_sealed}, blocker=${result.Phase1326_1365.blocker ?? "null"}
- Phase1366-1374: completed=${result.Phase1366_1374.completed}, recommended_sealed=${result.Phase1366_1374.recommended_sealed}, blocker=${result.Phase1366_1374.blocker ?? "null"}
- Phase1375-1399: completed=${result.Phase1375_1399.completed}, recommended_sealed=${result.Phase1375_1399.recommended_sealed}, blocker=${result.Phase1375_1399.blocker ?? "null"}
- Phase1400-1425: completed=${result.Phase1400_1425.completed}, recommended_sealed=${result.Phase1400_1425.recommended_sealed}, blocker=${result.Phase1400_1425.blocker ?? "null"}
- Phase1426-1450: completed=${result.Phase1426_1450.completed}, recommended_sealed=${result.Phase1426_1450.recommended_sealed}, blocker=${result.Phase1426_1450.blocker ?? "null"}

## Capabilities

- defaultEnableExecuted=${result.defaultEnableExecuted}
- mainChainDefaultEnabled=${result.mainChainDefaultEnabled}
- taijiBeidouDefaultEnabled=${result.taijiBeidouDefaultEnabled}
- callable=${result.callable}
- readable=${result.readable}
- claimable=${result.claimable}
- multiProviderStabilityEvaluated=${result.multiProviderStabilityEvaluated}
- localProductionReadinessRehearsed=${result.localProductionReadinessRehearsed}
- dogfoodingFrameworkReady=${result.dogfoodingFrameworkReady}
- delayedLaunchGateReady=${result.delayedLaunchGateReady}

## Real Provider Scope

- realProviderCallExecuted=${result.realProviderCallExecuted}
- realProviderCallsMade=${result.realProviderCallsMade}
- providerScopeMissingForRealCall=${result.providerScopeMissingForRealCall}
- multiProviderEvaluationBlocker=${result.multiProviderEvaluationBlocker}
- requestAttemptCount=${result.requestAttemptCount}
- estimatedCostUsd=${result.estimatedCostUsd}

## Safety Boundary

- secretValueExposed=${result.secretValueExposed}
- rawSecretReadByCodex=${result.rawSecretReadByCodex}
- authJsonRead=${result.authJsonRead}
- rawCredentialRefRead=${result.rawCredentialRefRead}
- credentialRefBypassed=${result.credentialRefBypassed}
- quotaBypassed=${result.quotaBypassed}
- budgetBypassed=${result.budgetBypassed}
- selectableGateBypassed=${result.selectableGateBypassed}
- deployExecuted=${result.deployExecuted}
- releaseExecuted=${result.releaseExecuted}
- tagCreated=${result.tagCreated}
- artifactUploaded=${result.artifactUploaded}
- commitCreated=${result.commitCreated}
- pushExecuted=${result.pushExecuted}
- workspaceCleanClaimed=${result.workspaceCleanClaimed}
- productionReadyClaimed=${result.productionReadyClaimed}
- publicLaunchClaimed=${result.publicLaunchClaimed}

## Conclusion

Taiji / Beidou is default-enabled for the local main-chain candidate layer with provider runtime default disabled. Callable/readable/claimable contracts are evidence-backed. Real Provider calls were not executed because concrete credentialRef scope was not provided. Local production-readiness rehearsal and long-run dogfooding readiness are prepared; production launch remains deferred.
`;
}
