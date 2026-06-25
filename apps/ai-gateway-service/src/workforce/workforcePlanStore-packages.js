import {
  WORKFORCE_PLAN_STORE_PHASE,
  WORKFORCE_PLAN_STORE_MODE,
  WORKFORCE_PLAN_REVIEW_APPROVAL_PHASE,
} from "./workforcePlanStore-constants.js";
import { redactSecrets, createPackageClarificationSummary, createUpdatedLifecycle, updatePlanStateCurrent } from "./workforcePlanStore-utils.js";
import {
  normalizeOmxHandoffPreview, normalizeRoleTiers, normalizeEventLedgerPreview, appendEventLedgerEvent,
  createPackageHudPreview, normalizeExecutionReadinessPreflight, normalizeExternalOmxRunnerDesign,
  normalizeRunnerRequestQueuePreview, normalizeExecutionApprovalRecordPreview,
  normalizeExternalRunnerProtocolFreeze, normalizeAgentWorkforcePreviewFinalUxSeal,
  normalizeTemplateContext, normalizeProductTemplatesPreview,
} from "./workforcePlanStore-normalizers.js";
import {
  normalizeHandoffPackageManifest, normalizeCodexDesktopHandoffPack,
  normalizeManualCodexExecutionLoop, normalizeCodexResultReviewPreview, normalizeSafeDesktopRunnerDesign,
} from "./workforcePlanStore-codex.js";
import { formatTaskPackageMarkdown } from "./workforcePlanStore-markdown.js";

export function createTaskPackage({ plan, planId, savedAt }) {
  const baseExportableJson = redactSecrets(plan.exportableJson || plan);
  const clarificationAnswers = Array.isArray(plan.clarificationAnswers) ? plan.clarificationAnswers : [];
  const clarifyQuestions = Array.isArray(plan.clarifyQuestions) ? plan.clarifyQuestions : [];
  const clarificationSummary = createPackageClarificationSummary(clarifyQuestions, clarificationAnswers);
  const omxHandoffPreview = normalizeOmxHandoffPreview(plan.omxHandoffPreview ?? baseExportableJson.omxHandoffPreview, plan);
  const executionReadinessPreflight = normalizeExecutionReadinessPreflight(plan.executionReadinessPreflight ?? baseExportableJson.executionReadinessPreflight);
  const externalOmxRunnerDesign = normalizeExternalOmxRunnerDesign(plan.externalOmxRunnerDesign ?? baseExportableJson.externalOmxRunnerDesign);
  const runnerRequestQueuePreview = normalizeRunnerRequestQueuePreview(plan.runnerRequestQueuePreview ?? baseExportableJson.runnerRequestQueuePreview);
  const executionApprovalRecordPreview = normalizeExecutionApprovalRecordPreview(plan.executionApprovalRecordPreview ?? baseExportableJson.executionApprovalRecordPreview);
  const externalRunnerProtocolFreeze = normalizeExternalRunnerProtocolFreeze(plan.externalRunnerProtocolFreeze ?? baseExportableJson.externalRunnerProtocolFreeze);
  const agentWorkforcePreviewFinalUxSeal = normalizeAgentWorkforcePreviewFinalUxSeal(plan.agentWorkforcePreviewFinalUxSeal ?? baseExportableJson.agentWorkforcePreviewFinalUxSeal);
  const codexDesktopHandoffPack = normalizeCodexDesktopHandoffPack(plan.codexDesktopHandoffPack ?? baseExportableJson.codexDesktopHandoffPack, plan);
  const manualCodexExecutionLoop = normalizeManualCodexExecutionLoop(plan.manualCodexExecutionLoop ?? baseExportableJson.manualCodexExecutionLoop);
  const codexResultReviewPreview = normalizeCodexResultReviewPreview(plan.codexResultReviewPreview ?? baseExportableJson.codexResultReviewPreview);
  const safeDesktopRunnerDesign = normalizeSafeDesktopRunnerDesign(plan.safeDesktopRunnerDesign ?? baseExportableJson.safeDesktopRunnerDesign);
  const selectedTemplate = redactSecrets(plan.selectedTemplate ?? baseExportableJson.selectedTemplate ?? null);
  const templateContext = normalizeTemplateContext(plan.templateContext ?? baseExportableJson.templateContext, selectedTemplate);
  const productTemplatesPreview = normalizeProductTemplatesPreview(plan.productTemplatesPreview ?? baseExportableJson.productTemplatesPreview, selectedTemplate);
  const roleTiers = normalizeRoleTiers(plan.roleTiers ?? baseExportableJson.roleTiers, plan);
  const eventLedgerPreview = appendEventLedgerEvent(
    appendEventLedgerEvent(normalizeEventLedgerPreview(plan.eventLedgerPreview ?? baseExportableJson.eventLedgerPreview), "workforce.plan.beforeSave", savedAt, `Save preview requested for plan ${planId}.`),
    "workforce.plan.afterSave", savedAt, `Plan ${planId} saved in dev-only local plan store.`,
  );
  const planState = updatePlanStateCurrent(plan.planState ?? baseExportableJson.planState, "saved");
  const lifecyclePreview = createUpdatedLifecycle(plan.lifecyclePreview ?? baseExportableJson.lifecyclePreview, "saved", "Plan package saved in the dev-only preview store.", savedAt);
  const previewPlan = {
    ...baseExportableJson, ...plan, planId, planState, lifecyclePreview, clarificationAnswers,
    answeredClarifications: clarificationSummary.answeredClarifications,
    unresolvedClarifications: clarificationSummary.unresolvedClarifications,
    omxHandoffPreview, executionReadinessPreflight, externalOmxRunnerDesign, runnerRequestQueuePreview,
    executionApprovalRecordPreview, externalRunnerProtocolFreeze, agentWorkforcePreviewFinalUxSeal,
    codexDesktopHandoffPack, manualCodexExecutionLoop, codexResultReviewPreview, safeDesktopRunnerDesign,
    selectedTemplate, templateContext, productTemplatesPreview, roleTiers, eventLedgerPreview,
  };
  const reviewPackagePreview = createPackageReviewPackagePreview({ source: plan.reviewPackagePreview ?? baseExportableJson.reviewPackagePreview, plan: previewPlan, planId, savedAt });
  const approvalGatePreview = createPackageApprovalGatePreview({ source: plan.approvalGatePreview ?? baseExportableJson.approvalGatePreview, plan: previewPlan, planId, updatedAt: savedAt });
  const handoffPackageManifest = normalizeHandoffPackageManifest(plan.handoffPackageManifest ?? baseExportableJson.handoffPackageManifest, { ...previewPlan, reviewPackagePreview, approvalGatePreview, savedAt });
  const workforceHudPreview = createPackageHudPreview({ ...previewPlan, reviewPackagePreview, approvalGatePreview });
  const exportableJson = redactSecrets({
    ...baseExportableJson, roleTiers, clarifyQuestions, clarificationAnswers,
    answeredClarifications: clarificationSummary.answeredClarifications,
    unresolvedClarifications: clarificationSummary.unresolvedClarifications,
    omxHandoffPreview, executionReadinessPreflight, externalOmxRunnerDesign, runnerRequestQueuePreview,
    executionApprovalRecordPreview, externalRunnerProtocolFreeze, agentWorkforcePreviewFinalUxSeal,
    codexDesktopHandoffPack, manualCodexExecutionLoop, codexResultReviewPreview, safeDesktopRunnerDesign,
    selectedTemplate, templateContext, productTemplatesPreview, handoffPackageManifest,
    planState, lifecyclePreview, reviewPackagePreview, approvalGatePreview, eventLedgerPreview, workforceHudPreview,
  });
  return {
    planId, workforceId: plan.workforceId, goal: plan.goal, summary: plan.summary, roleTiers,
    clarifyQuestions, clarificationAnswers,
    answeredClarifications: clarificationSummary.answeredClarifications,
    unresolvedClarifications: clarificationSummary.unresolvedClarifications,
    consensusPreview: Array.isArray(plan.consensusPreview) ? plan.consensusPreview : [],
    hookEventsPreview: Array.isArray(plan.hookEventsPreview) ? plan.hookEventsPreview : [],
    eventLedgerPreview, omxHandoffPreview, executionReadinessPreflight, externalOmxRunnerDesign,
    runnerRequestQueuePreview, executionApprovalRecordPreview, externalRunnerProtocolFreeze,
    agentWorkforcePreviewFinalUxSeal, codexDesktopHandoffPack, manualCodexExecutionLoop,
    codexResultReviewPreview, safeDesktopRunnerDesign, selectedTemplate, templateContext,
    productTemplatesPreview, handoffPackageManifest, workforceHudPreview, planState, lifecyclePreview,
    reviewPackagePreview, approvalGatePreview,
    roles: Array.isArray(plan.roleAssignments) ? plan.roleAssignments : [],
    taskBreakdown: Array.isArray(plan.taskBreakdown) ? plan.taskBreakdown : [],
    deliverables: Array.isArray(plan.deliverables) ? plan.deliverables : [],
    acceptanceCriteria: Array.isArray(plan.acceptanceCriteria) ? plan.acceptanceCriteria : [],
    risks: Array.isArray(plan.risks) ? plan.risks : [],
    nextActions: Array.isArray(plan.nextActions) ? plan.nextActions : [],
    limitations: Array.isArray(plan.limitations) ? plan.limitations : [],
    recommendedNextStep: plan.recommendedNextStep,
    markdown: redactSecrets(plan.markdown || formatTaskPackageMarkdown({ plan, planId, savedAt })),
    exportableJson, planVersion: plan.planVersion, createdAt: plan.createdAt, savedAt,
    meta: { phase: WORKFORCE_PLAN_STORE_PHASE, mode: WORKFORCE_PLAN_STORE_MODE, devOnly: true, projectFileWrites: false, secretValuesStored: false },
  };
}

export function createPackageReviewPackagePreview({ source, plan, planId, savedAt }) {
  const base = source && typeof source === "object" ? source : {};
  const clarifyQuestions = Array.isArray(plan.clarifyQuestions) ? plan.clarifyQuestions : [];
  const answeredClarifications = Array.isArray(plan.answeredClarifications) ? plan.answeredClarifications : [];
  const unresolvedClarifications = Array.isArray(plan.unresolvedClarifications) ? plan.unresolvedClarifications : [];
  const consensusPreview = Array.isArray(plan.consensusPreview) ? plan.consensusPreview : [];
  const acceptanceCriteria = Array.isArray(plan.acceptanceCriteria) ? plan.acceptanceCriteria : [];
  const risks = Array.isArray(plan.risks) ? plan.risks : [];
  const answeredCount = answeredClarifications.length;
  const totalClarifications = clarifyQuestions.length || answeredCount + unresolvedClarifications.length;
  const unresolvedCount = unresolvedClarifications.length;
  return redactSecrets({
    ...base,
    phase: WORKFORCE_PLAN_REVIEW_APPROVAL_PHASE,
    status: unresolvedCount > 0 ? "needs-human-review" : "ready-for-human-review",
    title: base.title || "Agent Workforce review package preview",
    generatedAt: base.generatedAt || plan.createdAt || savedAt,
    savedAt, planId, workforceId: plan.workforceId,
    previewOnly: false, persisted: true, executionEnabled: true, workflowRunEnabled: true, projectFileWrites: false,
    summary: {
      ...(base.summary || {}), workforceId: plan.workforceId, goal: plan.goal, planVersion: plan.planVersion,
      lifecycleStatus: plan.planState?.lifecycleStatus || plan.lifecyclePreview?.current || "saved",
      clarificationCoverage: `${answeredCount}/${totalClarifications} answered`,
      unresolvedClarificationCount: unresolvedCount,
      consensusRoles: consensusPreview.map((item) => item.role).filter(Boolean),
    },
    packageSections: [
      { sectionId: "goal-and-scope", title: "Goal and scope", items: [plan.summary || `Agent Workforce plan preview for: ${plan.goal}`, `Clarifications answered: ${answeredCount}`, `Clarifications unresolved: ${unresolvedCount}`] },
      { sectionId: "consensus", title: "Planner / Architect / Critic consensus", items: consensusPreview.map((item) => `${item.role}: ${item.recommendation || item.viewpoint || ""}`) },
      { sectionId: "acceptance-and-risks", title: "Acceptance and risks", items: [...acceptanceCriteria, ...risks] },
      { sectionId: "safety-boundary", title: "Preview safety boundary", items: ["No real Agent execution is enabled.", "No workflow run handoff is connected.", "No worktrees are created and no user project files are written."] },
    ],
    requiredHumanChecks: [
      "Review answered and unresolved clarification items.",
      "Confirm the Planner / Architect / Critic consensus is acceptable.",
      "Confirm the safety boundary remains preview-only before any later mainline.",
      "Run the matching phase verifier before claiming this preview complete.",
    ],
    disabledWorkflowRunHandoff: { status: "disabled", implemented: false, enabled: false, futureRoute: "POST /workflow/run", reason: "Phase141A records review and human approval metadata only." },
  });
}

export function createPackageApprovalGatePreview({ source, plan, planId, updatedAt }) {
  const base = source && typeof source === "object" ? source : {};
  const decisionHistory = Array.isArray(base.decisionHistory) ? base.decisionHistory : [];
  const currentDecision = base.currentDecision || null;
  const unresolvedCount = Array.isArray(plan.unresolvedClarifications) ? plan.unresolvedClarifications.length : 0;
  const consensusCount = Array.isArray(plan.consensusPreview) ? plan.consensusPreview.length : 0;
  return redactSecrets({
    ...base,
    phase: WORKFORCE_PLAN_REVIEW_APPROVAL_PHASE,
    status: base.status || (currentDecision ? "approval-gate-recorded" : "waiting-human-review"),
    planId, updatedAt,
    previewOnly: false, persisted: true, executionEnabled: true, workflowRunEnabled: true, projectFileWrites: false,
    requiredApprovals: ["human-review"],
    allowedDecisions: ["approved-preview", "changes-requested", "rejected-preview"],
    currentDecision, reviewer: base.reviewer || null, decidedAt: base.decidedAt || null, decisionHistory,
    gateChecks: [
      { checkId: "clarifications-reviewed", label: "Clarifications reviewed", satisfied: unresolvedCount === 0, previewOnly: false },
      { checkId: "consensus-reviewed", label: "Consensus reviewed", satisfied: consensusCount >= 3, previewOnly: false },
      { checkId: "execution-disabled", label: "Execution remains disabled", satisfied: true, previewOnly: false },
    ],
    disabledActions: ["agent-execution", "workflow-run", "worktree-creation", "project-file-write"],
    nextDecision: "A human can record a preview decision, but it will not execute or hand off the plan.",
  });
}
