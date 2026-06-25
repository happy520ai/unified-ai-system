import { WORKFORCE_PHASE, listWorkforceRoles } from "./workforceRoles.js";
import { PRODUCT_TEMPLATES as IMPORTED_TEMPLATES, PRODUCT_TEMPLATE_PHASE, getTemplateById, listTemplates } from "./workforceTemplates.js";
import {
  PRODUCT_TEMPLATES,
  normalizeGoal,
  createWorkforceId,
  createRoleTask,
  normalizeSelectedTemplate,
  createTemplateContext,
  createProductTemplatesPreview,
  createDeliverables,
  createRoleTiers,
  createClarifyQuestions,
  createClarificationAnswers,
  createAnsweredClarifications,
  createUnresolvedClarifications,
} from "./workforcePlanner-core.js";
import {
  createConsensusPreview,
  createHookEventsPreview,
  createEventLedgerPreview,
  createPlanState,
  createLifecyclePreview,
  createOmxHandoffPreview,
  createWorkforceHudPreview,
  createReviewPackagePreview,
  createApprovalGatePreview,
} from "./workforcePlanner-previews.js";
import {
  createExecutionReadinessPreflight,
  createExternalOmxRunnerDesign,
  createRunnerRequestQueuePreview,
  createExecutionApprovalRecordPreview,
  createExternalRunnerProtocolFreeze,
  createAgentWorkforcePreviewFinalUxSeal,
} from "./workforcePlanner-runner.js";
import {
  createCodexDesktopHandoffPack,
  createManualCodexExecutionLoop,
  createCodexResultReviewPreview,
  createSafeDesktopRunnerDesign,
  createHandoffPackageManifest,
} from "./workforcePlanner-codex.js";
import {
  formatWorkforcePlanMarkdown,
  createExportableWorkforcePlan,
} from "./workforcePlanner-format.js";

export { PRODUCT_TEMPLATES, PRODUCT_TEMPLATE_PHASE, getTemplateById, listTemplates };

export function createWorkforcePlan(input = {}) {
  const goal = normalizeGoal(input.goal);
  const selectedTemplate = normalizeSelectedTemplate(input.selectedTemplate ?? input.templateId);
  const templateContext = createTemplateContext(selectedTemplate);
  const productTemplatesPreview = createProductTemplatesPreview(selectedTemplate);
  const roles = listWorkforceRoles();
  const workforceId = createWorkforceId(goal);
  const createdAt = new Date().toISOString();
  const selectedRoles = roles.map((role) => role.name);
  const taskBreakdown = roles.map((role, index) => createRoleTask({ role, goal, index }));
  const roleTiers = createRoleTiers(roles, taskBreakdown);
  const clarifyQuestions = createClarifyQuestions(goal);
  const clarificationAnswers = createClarificationAnswers(input.clarificationAnswers);
  const answeredClarifications = createAnsweredClarifications(clarifyQuestions, clarificationAnswers);
  const unresolvedClarifications = createUnresolvedClarifications(clarifyQuestions, clarificationAnswers);
  const consensusPreview = createConsensusPreview(goal);
  const hookEventsPreview = createHookEventsPreview();
  const eventLedgerPreview = createEventLedgerPreview({ createdAt, workforceId, goal });
  const planState = createPlanState({ clarificationAnswers });
  const lifecyclePreview = createLifecyclePreview(clarificationAnswers);
  const omxHandoffPreview = createOmxHandoffPreview({ goal, workforceId });
  const executionReadinessPreflight = createExecutionReadinessPreflight();
  const externalOmxRunnerDesign = createExternalOmxRunnerDesign();
  const runnerRequestQueuePreview = createRunnerRequestQueuePreview();
  const executionApprovalRecordPreview = createExecutionApprovalRecordPreview();
  const externalRunnerProtocolFreeze = createExternalRunnerProtocolFreeze();
  const agentWorkforcePreviewFinalUxSeal = createAgentWorkforcePreviewFinalUxSeal();
  const workforceHudPreview = createWorkforceHudPreview({
    answeredClarifications,
    clarifyQuestions,
    consensusPreview,
    lifecyclePreview,
    reviewPackageStatus: unresolvedClarifications.length > 0 ? "needs-human-review" : "ready-for-human-review",
    approvalGateStatus: "waiting-human-review",
    executionReadinessPreflight,
  });
  const roleAssignments = roles.map((role) => ({
    roleId: role.roleId,
    role: role.name,
    responsibility: role.responsibility,
    taskIds: taskBreakdown.filter((task) => task.roleId === role.roleId).map((task) => task.taskId),
  }));

  const plan = {
    success: true,
    phase: WORKFORCE_PHASE,
    planVersion: "204A.1",
    createdAt,
    mode: "deterministic-plan-preview",
    workforceId,
    goal,
    summary: `AI company plan preview for: ${goal}`,
    userFriendlyStatus: "ready_to_review",
    selectedRoles,
    selectedTemplate,
    templateContext,
    productTemplatesPreview,
    roleTiers,
    clarifyQuestions,
    clarificationAnswers,
    answeredClarifications,
    unresolvedClarifications,
    consensusPreview,
    hookEventsPreview,
    eventLedgerPreview,
    planState,
    lifecyclePreview,
    omxHandoffPreview,
    executionReadinessPreflight,
    externalOmxRunnerDesign,
    runnerRequestQueuePreview,
    executionApprovalRecordPreview,
    externalRunnerProtocolFreeze,
    agentWorkforcePreviewFinalUxSeal,
    workforceHudPreview,
    taskBreakdown,
    roleAssignments,
    deliverables: createDeliverables(goal),
    acceptanceCriteria: [
      "The plan includes all seven MVP roles.",
      "The output is deterministic and reviewable before any implementation starts.",
      "No real LLM call, agent concurrency, code execution, or project file mutation is performed.",
      "The default NVIDIA chat lane, provider registry, knowledge, and workflow semantics remain unchanged.",
    ],
    risks: [
      "The plan is a preview only and can miss project-specific constraints until a human confirms the next mainline.",
      "Role output is rule-based, not an autonomous agent execution result.",
      "Execution, code changes, and external integrations require a separate explicit phase.",
    ],
    limitations: [
      "This is a deterministic preview, not real autonomous agent execution.",
      "No code is executed and no user project files are written.",
      "No real LLM call, provider call, or workflow run is performed.",
      "The default NVIDIA chat lane and provider registry are not changed.",
    ],
    nextActions: [
      "Review the plan with the user.",
      "Pick exactly one approved implementation mainline.",
      "Convert selected tasks into a small, verifiable change set.",
      "Run the matching phase verification before claiming completion.",
    ],
    recommendedNextStep: "Review this preview with the user, then approve exactly one small implementation mainline.",
    safety: {
      realLlmCalls: false,
      agentConcurrency: false,
      codeExecution: false,
      projectFileWrites: false,
      workflowRun: false,
      previewOnly: false,
    },
    meta: {
      roleCount: roles.length,
      planner: "rule-based",
      selectedTemplateId: selectedTemplate.id,
    },
  };
  plan.codexDesktopHandoffPack = createCodexDesktopHandoffPack(plan);
  plan.manualCodexExecutionLoop = createManualCodexExecutionLoop();
  plan.codexResultReviewPreview = createCodexResultReviewPreview();
  plan.safeDesktopRunnerDesign = createSafeDesktopRunnerDesign();
  plan.reviewPackagePreview = createReviewPackagePreview(plan);
  plan.approvalGatePreview = createApprovalGatePreview(plan);
  plan.handoffPackageManifest = createHandoffPackageManifest(plan);
  plan.markdown = formatWorkforcePlanMarkdown(plan);
  plan.exportableJson = createExportableWorkforcePlan(plan);
  return plan;
}







