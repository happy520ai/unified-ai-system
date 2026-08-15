import {
  createPackageClarificationSummary,
  createUpdatedLifecycle,
  normalizeApprovalDecision,
  redactSecrets,
  updatePlanStateCurrent,
} from "./workforcePlanStore-utils.js";
import {
  appendEventLedgerEvent,
  createPackageHudPreview,
  normalizeAgentWorkforcePreviewFinalUxSeal,
  normalizeExecutionApprovalRecordPreview,
  normalizeExternalOmxRunnerDesign,
  normalizeExternalRunnerProtocolFreeze,
  normalizeRunnerRequestQueuePreview,
} from "./workforcePlanStore-normalizers.js";
import {
  normalizeCodexDesktopHandoffPack,
  normalizeCodexResultReviewPreview,
  normalizeHandoffPackageManifest,
  normalizeManualCodexExecutionLoop,
  normalizeSafeDesktopRunnerDesign,
} from "./workforcePlanStore-codex.js";
import {
  createPackageApprovalGatePreview,
  createPackageReviewPackagePreview,
} from "./workforcePlanStore-packages.js";
import { formatTaskPackageMarkdown } from "./workforcePlanStore-markdown.js";

export function applyClarificationAnswers(taskPackage, answers, updatedAt) {
  const clarificationSummary = createPackageClarificationSummary(taskPackage.clarifyQuestions || [], answers);
  const next = redactSecrets({
    ...taskPackage,
    clarificationAnswers: answers,
    answeredClarifications: clarificationSummary.answeredClarifications,
    unresolvedClarifications: clarificationSummary.unresolvedClarifications,
    lifecyclePreview: createUpdatedLifecycle(taskPackage.lifecyclePreview, "clarified", "Clarification answers saved in preview store.", updatedAt),
  });
  next.workforceHudPreview = createPackageHudPreview(next);
  next.exportableJson = redactSecrets({
    ...(next.exportableJson || {}),
    clarificationAnswers: next.clarificationAnswers,
    answeredClarifications: next.answeredClarifications,
    unresolvedClarifications: next.unresolvedClarifications,
    lifecyclePreview: next.lifecyclePreview,
    executionReadinessPreflight: next.executionReadinessPreflight,
    externalOmxRunnerDesign: next.externalOmxRunnerDesign,
    runnerRequestQueuePreview: next.runnerRequestQueuePreview,
    executionApprovalRecordPreview: next.executionApprovalRecordPreview,
    externalRunnerProtocolFreeze: next.externalRunnerProtocolFreeze,
    agentWorkforcePreviewFinalUxSeal: next.agentWorkforcePreviewFinalUxSeal,
    codexDesktopHandoffPack: next.codexDesktopHandoffPack,
    manualCodexExecutionLoop: next.manualCodexExecutionLoop,
    codexResultReviewPreview: next.codexResultReviewPreview,
    safeDesktopRunnerDesign: next.safeDesktopRunnerDesign,
    workforceHudPreview: next.workforceHudPreview,
    planState: updatePlanStateCurrent(next.planState || next.exportableJson?.planState, "clarified"),
  });
  next.handoffPackageManifest = normalizeHandoffPackageManifest(next.handoffPackageManifest || next.exportableJson?.handoffPackageManifest, next);
  next.exportableJson.handoffPackageManifest = next.handoffPackageManifest;
  next.planState = next.exportableJson.planState;
  refreshReviewAndApprovalPreviews(next, updatedAt);
  next.markdown = formatTaskPackageMarkdown({ plan: next, planId: next.planId, savedAt: next.savedAt });
  return next;
}

export function applyLifecycleState(taskPackage, state, note, updatedAt) {
  const next = redactSecrets({
    ...taskPackage,
    lifecyclePreview: createUpdatedLifecycle(taskPackage.lifecyclePreview, state, note || `Lifecycle preview moved to ${state}.`, updatedAt),
  });
  next.workforceHudPreview = createPackageHudPreview(next);
  next.exportableJson = redactSecrets({
    ...(next.exportableJson || {}),
    lifecyclePreview: next.lifecyclePreview,
    executionReadinessPreflight: next.executionReadinessPreflight,
    externalOmxRunnerDesign: next.externalOmxRunnerDesign,
    runnerRequestQueuePreview: next.runnerRequestQueuePreview,
    executionApprovalRecordPreview: next.executionApprovalRecordPreview,
    externalRunnerProtocolFreeze: next.externalRunnerProtocolFreeze,
    agentWorkforcePreviewFinalUxSeal: next.agentWorkforcePreviewFinalUxSeal,
    codexDesktopHandoffPack: next.codexDesktopHandoffPack,
    manualCodexExecutionLoop: next.manualCodexExecutionLoop,
    codexResultReviewPreview: next.codexResultReviewPreview,
    safeDesktopRunnerDesign: next.safeDesktopRunnerDesign,
    workforceHudPreview: next.workforceHudPreview,
    planState: updatePlanStateCurrent(next.planState || next.exportableJson?.planState, state === "archived" ? "export_ready" : state),
  });
  next.handoffPackageManifest = normalizeHandoffPackageManifest(next.handoffPackageManifest || next.exportableJson?.handoffPackageManifest, next);
  next.exportableJson.handoffPackageManifest = next.handoffPackageManifest;
  next.planState = next.exportableJson.planState;
  refreshReviewAndApprovalPreviews(next, updatedAt);
  next.markdown = formatTaskPackageMarkdown({ plan: next, planId: next.planId, savedAt: next.savedAt });
  return next;
}

export function applyApprovalGateDecision(taskPackage, input, updatedAt) {
  const decision = normalizeApprovalDecision(input.decision);
  const reviewer = String(input.reviewer || input.approver || "human-reviewer").trim().slice(0, 120) || "human-reviewer";
  const note = String(input.note || "").trim().slice(0, 1_000);
  const base = refreshReviewAndApprovalPreviews(redactSecrets({ ...taskPackage }), updatedAt);
  const history = Array.isArray(base.approvalGatePreview?.decisionHistory)
    ? base.approvalGatePreview.decisionHistory
    : [];
  const decisionEvent = {
    decision,
    reviewer,
    note,
    decidedAt: updatedAt,
    previewOnly: true,
    executionEnabled: false,
    workflowRun: false,
    projectFileWrites: false,
  };
  const statusByDecision = {
    "approved-preview": "approved-preview-recorded",
    "changes-requested": "changes-requested-recorded",
    "rejected-preview": "rejected-preview-recorded",
  };
  const approvalGatePreview = redactSecrets({
    ...base.approvalGatePreview,
    status: statusByDecision[decision],
    currentDecision: decision,
    reviewer,
    note,
    decidedAt: updatedAt,
    persisted: true,
    executionEnabled: false,
    workflowRunEnabled: false,
    projectFileWrites: false,
    decisionHistory: [...history, decisionEvent],
  });
  const next = redactSecrets({
    ...base,
    approvalGatePreview,
    eventLedgerPreview: appendEventLedgerEvent(
      base.eventLedgerPreview,
      "workforce.approval.recorded",
      updatedAt,
      `Approval gate decision ${decision} recorded as preview metadata.`,
    ),
    lifecyclePreview: createUpdatedLifecycle(
      base.lifecyclePreview,
      "handoff-disabled",
      "Human approval gate preview recorded; workflow run remains disabled.",
      updatedAt,
    ),
  });
  next.workforceHudPreview = createPackageHudPreview(next);
  next.exportableJson = redactSecrets({
    ...(next.exportableJson || {}),
    approvalGatePreview,
    eventLedgerPreview: next.eventLedgerPreview,
    lifecyclePreview: next.lifecyclePreview,
    executionReadinessPreflight: next.executionReadinessPreflight,
    externalOmxRunnerDesign: next.externalOmxRunnerDesign,
    runnerRequestQueuePreview: next.runnerRequestQueuePreview,
    executionApprovalRecordPreview: next.executionApprovalRecordPreview,
    externalRunnerProtocolFreeze: next.externalRunnerProtocolFreeze,
    agentWorkforcePreviewFinalUxSeal: next.agentWorkforcePreviewFinalUxSeal,
    codexDesktopHandoffPack: next.codexDesktopHandoffPack,
    manualCodexExecutionLoop: next.manualCodexExecutionLoop,
    codexResultReviewPreview: next.codexResultReviewPreview,
    safeDesktopRunnerDesign: next.safeDesktopRunnerDesign,
    workforceHudPreview: next.workforceHudPreview,
    planState: updatePlanStateCurrent(next.planState || next.exportableJson?.planState, "handoff-disabled"),
  });
  next.handoffPackageManifest = normalizeHandoffPackageManifest(next.handoffPackageManifest || next.exportableJson?.handoffPackageManifest, next);
  next.exportableJson.handoffPackageManifest = next.handoffPackageManifest;
  next.planState = next.exportableJson.planState;
  refreshReviewAndApprovalPreviews(next, updatedAt);
  next.markdown = formatTaskPackageMarkdown({ plan: next, planId: next.planId, savedAt: next.savedAt });
  return next;
}

export function refreshReviewAndApprovalPreviews(taskPackage, updatedAt) {
  taskPackage.externalOmxRunnerDesign = normalizeExternalOmxRunnerDesign(taskPackage.externalOmxRunnerDesign);
  taskPackage.runnerRequestQueuePreview = normalizeRunnerRequestQueuePreview(taskPackage.runnerRequestQueuePreview);
  taskPackage.executionApprovalRecordPreview = normalizeExecutionApprovalRecordPreview(taskPackage.executionApprovalRecordPreview);
  taskPackage.externalRunnerProtocolFreeze = normalizeExternalRunnerProtocolFreeze(taskPackage.externalRunnerProtocolFreeze);
  taskPackage.agentWorkforcePreviewFinalUxSeal = normalizeAgentWorkforcePreviewFinalUxSeal(taskPackage.agentWorkforcePreviewFinalUxSeal);
  taskPackage.codexDesktopHandoffPack = normalizeCodexDesktopHandoffPack(taskPackage.codexDesktopHandoffPack || taskPackage.exportableJson?.codexDesktopHandoffPack, taskPackage);
  taskPackage.manualCodexExecutionLoop = normalizeManualCodexExecutionLoop(taskPackage.manualCodexExecutionLoop || taskPackage.exportableJson?.manualCodexExecutionLoop);
  taskPackage.codexResultReviewPreview = normalizeCodexResultReviewPreview(taskPackage.codexResultReviewPreview || taskPackage.exportableJson?.codexResultReviewPreview);
  taskPackage.safeDesktopRunnerDesign = normalizeSafeDesktopRunnerDesign(taskPackage.safeDesktopRunnerDesign || taskPackage.exportableJson?.safeDesktopRunnerDesign);
  taskPackage.handoffPackageManifest = normalizeHandoffPackageManifest(taskPackage.handoffPackageManifest || taskPackage.exportableJson?.handoffPackageManifest, taskPackage);
  const requestedReview = appendEventLedgerEvent(
    taskPackage.eventLedgerPreview,
    "workforce.review.requested",
    updatedAt,
    `Review package requested for plan ${taskPackage.planId}.`,
  );
  taskPackage.eventLedgerPreview = requestedReview;
  const refreshedReview = createPackageReviewPackagePreview({
    source: taskPackage.reviewPackagePreview || taskPackage.exportableJson?.reviewPackagePreview,
    plan: taskPackage,
    planId: taskPackage.planId,
    savedAt: taskPackage.savedAt || updatedAt,
  });
  const refreshedApproval = createPackageApprovalGatePreview({
    source: taskPackage.approvalGatePreview || taskPackage.exportableJson?.approvalGatePreview,
    plan: taskPackage,
    planId: taskPackage.planId,
    updatedAt,
  });
  taskPackage.reviewPackagePreview = refreshedReview;
  taskPackage.approvalGatePreview = refreshedApproval;
  taskPackage.workforceHudPreview = createPackageHudPreview(taskPackage);
  taskPackage.exportableJson = redactSecrets({
    ...(taskPackage.exportableJson || {}),
    reviewPackagePreview: refreshedReview,
    approvalGatePreview: refreshedApproval,
    eventLedgerPreview: taskPackage.eventLedgerPreview,
    executionReadinessPreflight: taskPackage.executionReadinessPreflight,
    externalOmxRunnerDesign: taskPackage.externalOmxRunnerDesign,
    runnerRequestQueuePreview: taskPackage.runnerRequestQueuePreview,
    executionApprovalRecordPreview: taskPackage.executionApprovalRecordPreview,
    externalRunnerProtocolFreeze: taskPackage.externalRunnerProtocolFreeze,
    agentWorkforcePreviewFinalUxSeal: taskPackage.agentWorkforcePreviewFinalUxSeal,
    codexDesktopHandoffPack: taskPackage.codexDesktopHandoffPack,
    manualCodexExecutionLoop: taskPackage.manualCodexExecutionLoop,
    codexResultReviewPreview: taskPackage.codexResultReviewPreview,
    safeDesktopRunnerDesign: taskPackage.safeDesktopRunnerDesign,
    handoffPackageManifest: taskPackage.handoffPackageManifest,
    workforceHudPreview: taskPackage.workforceHudPreview,
  });
  return taskPackage;
}
