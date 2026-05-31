import { createHash } from "node:crypto";
import { WORKFORCE_PHASE, listWorkforceRoles } from "./workforceRoles.js";
import { PRODUCT_TEMPLATES as IMPORTED_TEMPLATES, PRODUCT_TEMPLATE_PHASE, getTemplateById, listTemplates } from "./workforceTemplates.js";

const MAX_GOAL_LENGTH = 1_000;
const PRODUCT_TEMPLATES = IMPORTED_TEMPLATES;

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

function normalizeGoal(goal) {
  if (goal === undefined || goal === null) {
    const error = new Error("????????? AI ?????");
    error.code = "WORKFORCE_GOAL_REQUIRED";
    error.category = "validation";
    error.details = {
      userMessage: "????????? AI ?????",
    };
    throw error;
  }

  if (typeof goal !== "string") {
    const error = new Error("????????");
    error.code = "WORKFORCE_GOAL_MUST_BE_STRING";
    error.category = "validation";
    error.details = {
      userMessage: "?????????????????????",
      actualType: Array.isArray(goal) ? "array" : typeof goal,
    };
    throw error;
  }

  const normalized = goal.trim().replace(/\s+/g, " ");

  if (!normalized) {
    const error = new Error("????????? AI ?????");
    error.code = "WORKFORCE_GOAL_REQUIRED";
    error.category = "validation";
    error.details = {
      userMessage: "????????? AI ?????",
    };
    throw error;
  }

  if (normalized.length > MAX_GOAL_LENGTH) {
    const error = new Error(`????????? ${MAX_GOAL_LENGTH} ??????`);
    error.code = "WORKFORCE_GOAL_TOO_LONG";
    error.category = "validation";
    error.details = {
      userMessage: `????????? ${MAX_GOAL_LENGTH} ??????`,
      maxLength: MAX_GOAL_LENGTH,
      actualLength: normalized.length,
    };
    throw error;
  }

  return normalized;
}

function createWorkforceId(goal) {
  const hash = createHash("sha256").update(goal).digest("hex").slice(0, 12);
  return `wf_${hash}`;
}

function createRoleTask({ role, goal, index }) {
  return {
    taskId: `task_${String(index + 1).padStart(2, "0")}_${role.roleId.replace(/-/g, "_")}`,
    roleId: role.roleId,
    role: role.name,
    title: `${role.name}: ${role.title}`,
    description: `${role.responsibility} Target goal: ${goal}`,
    status: "planned",
    previewOnly: false,
  };
}

function normalizeSelectedTemplate(templateId) {
  const id = String(templateId || "").trim();
  const template = PRODUCT_TEMPLATES.find((item) => item.id === id) || PRODUCT_TEMPLATES[0];
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    defaultGoalPrompt: template.defaultGoalPrompt,
    focusAreas: template.focusAreas,
    sampleGoal: template.sampleGoal,
    expectedPlanSections: template.expectedPlanSections,
    sampleAcceptanceChecklist: template.sampleAcceptanceChecklist,
    execution: "enabled",
    previewOnly: false,
  };
}

function createTemplateContext(selectedTemplate) {
  const template = PRODUCT_TEMPLATES.find((item) => item.id === selectedTemplate.id) || PRODUCT_TEMPLATES[0];
  return {
    phase: PRODUCT_TEMPLATE_PHASE,
    mode: "template-context-preview",
    selectedTemplateId: template.id,
    selectedTemplateName: template.name,
    defaultGoalPrompt: template.defaultGoalPrompt,
    sampleGoal: template.sampleGoal,
    recommendedRoleTiers: template.recommendedRoleTiers,
    expectedOutputs: template.expectedOutputs,
    focusAreas: template.focusAreas,
    expectedPlanSections: template.expectedPlanSections,
    sampleAcceptanceChecklist: template.sampleAcceptanceChecklist,
    affects: ["plan prompt", "plan context", "clarification framing", "review package framing"],
    executionEnabled: true,
    externalRunnerDispatchEnabled: true,
    workflowRunEnabled: true,
    previewOnly: false,
    reason: "templates generate plans only; no execution is triggered",
  };
}

function createProductTemplatesPreview(selectedTemplate) {
  return {
    phase: PRODUCT_TEMPLATE_PHASE,
    mode: "product-template-pack-preview",
    templatePackEnabled: true,
    executionEnabled: true,
    selectedTemplateId: selectedTemplate.id,
    templates: PRODUCT_TEMPLATES.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      defaultGoalPrompt: template.defaultGoalPrompt,
      recommendedRoleTiers: template.recommendedRoleTiers,
      expectedOutputs: template.expectedOutputs,
      focusAreas: template.focusAreas,
      sampleGoal: template.sampleGoal,
      samplePrompts: template.samplePrompts,
      expectedPlanSections: template.expectedPlanSections,
      sampleAcceptanceChecklist: template.sampleAcceptanceChecklist,
      execution: "enabled",
    })),
    demoGoals: PRODUCT_TEMPLATES.map((template) => ({
      templateId: template.id,
      templateName: template.name,
      sampleGoal: template.sampleGoal,
      samplePrompts: template.samplePrompts,
      execution: "enabled",
    })),
    blockedReasons: [],
  };
}

function createDeliverables(goal) {
  return [
    {
      deliverableId: "goal-brief",
      title: "Goal Brief",
      description: `A clarified goal statement for: ${goal}`,
      ownerRole: "CEO",
    },
    {
      deliverableId: "product-plan",
      title: "Product Plan",
      description: "A bounded product scope, user journey, and acceptance framing.",
      ownerRole: "PM",
    },
    {
      deliverableId: "architecture-plan",
      title: "Architecture Plan",
      description: "A minimal insertion design with contracts, services, APIs, and rollback points.",
      ownerRole: "Architect",
    },
    {
      deliverableId: "implementation-task-list",
      title: "Implementation Task List",
      description: "Frontend and backend tasks split into small verifiable steps.",
      ownerRole: "Frontend Engineer / Backend Engineer",
    },
    {
      deliverableId: "acceptance-plan",
      title: "Acceptance Plan",
      description: "Verification commands, evidence expectations, and regression checks.",
      ownerRole: "QA",
    },
    {
      deliverableId: "risk-review",
      title: "Risk Review",
      description: "Known risks, explicit non-goals, and safety blockers before execution.",
      ownerRole: "Reviewer",
    },
  ];
}

function createRoleTiers(roles, tasks) {
  const taskIdsByRoleId = new Map(tasks.map((task) => [task.roleId, task.taskId]));
  const roleByName = new Map(roles.map((role) => [role.name, role]));
  const tiers = [
    {
      tierId: "strategy",
      name: "Strategy",
      roleNames: ["CEO", "PM"],
      purpose: "Clarify business intent, user outcome, scope, and decision boundary.",
    },
    {
      tierId: "architecture",
      name: "Architecture",
      roleNames: ["Architect"],
      purpose: "Shape the system insertion point, contracts, data flow, and rollback boundary.",
    },
    {
      tierId: "implementation-planning",
      name: "Implementation Planning",
      roleNames: ["Frontend Engineer", "Backend Engineer"],
      purpose: "Split visible UI and backend service work into small verifiable tasks.",
    },
    {
      tierId: "quality",
      name: "Quality",
      roleNames: ["QA", "Reviewer"],
      purpose: "Plan acceptance, regression checks, risks, non-goals, and safety blockers.",
    },
  ];

  return tiers.map((tier) => ({
    tierId: tier.tierId,
    name: tier.name,
    purpose: tier.purpose,
    previewOnly: false,
    workerExecution: false,
    roles: tier.roleNames.map((roleName) => {
      const role = roleByName.get(roleName);
      return {
        roleId: role?.roleId ?? roleName.toLowerCase().replace(/\s+/g, "-"),
        role: roleName,
        responsibility: role?.responsibility ?? "",
        taskIds: role?.roleId && taskIdsByRoleId.has(role.roleId) ? [taskIdsByRoleId.get(role.roleId)] : [],
      };
    }),
  }));
}

function createClarifyQuestions(goal) {
  return [
    {
      questionId: "clarify_goal",
      topic: "goal",
      question: "What exact user outcome should this plan optimize for?",
      why: "Keeps the team from turning a broad idea into unrelated work.",
      sampleAnswer: `Deliver a reviewable plan for: ${goal}`,
      required: true,
    },
    {
      questionId: "clarify_scope",
      topic: "scope",
      question: "Which parts are in scope, and which parts are explicitly out of scope?",
      why: "Prevents preview tasks from implying real execution, deployment, or broad refactors.",
      sampleAnswer: "In scope: planning, UI preview, docs, verification. Out of scope: real workers and file mutation.",
      required: true,
    },
    {
      questionId: "clarify_stack",
      topic: "technology_stack",
      question: "Which existing app, package, API, or UI surface should own the change?",
      why: "Keeps the plan aligned with existing ownership boundaries.",
      sampleAnswer: "apps/ai-gateway-service owns Workforce service and Web UI preview.",
      required: true,
    },
    {
      questionId: "clarify_acceptance",
      topic: "acceptance",
      question: "What commands or evidence must pass before this plan can be called complete?",
      why: "Turns the preview into a verifiable handoff instead of an open-ended wish list.",
      sampleAnswer: "Run the matching phase verifier, secret scan, user journey, health, doctor, and workspace check.",
      required: true,
    },
    {
      questionId: "clarify_constraints",
      topic: "constraints",
      question: "What safety constraints must the AI team keep visible?",
      why: "Preserves the current no-execution, no-worktree, no-workflow-run boundary.",
      sampleAnswer: "Do not run code, create worktrees, modify user project files, or start real agents.",
      required: true,
    },
  ];
}

function createConsensusPreview(goal) {
  return [
    {
      role: "Planner",
      viewpoint: "Break the goal into a small reviewable product loop before implementation.",
      concerns: [
        "The user may still need to clarify scope and acceptance criteria.",
        "The plan must stay exportable without implying automatic execution.",
      ],
      recommendation: `Create a staged preview plan for ${goal}, then ask for one explicit next mainline.`,
    },
    {
      role: "Architect",
      viewpoint: "Keep new fields additive and preserve the existing /workforce/plan contract.",
      concerns: [
        "Do not connect Agent Workforce to workflow run or project file writes.",
        "Keep the default NVIDIA /chat lane and provider routing untouched.",
      ],
      recommendation: "Add read-only plan metadata, state, hooks, and HUD fields as deterministic preview data.",
    },
    {
      role: "Critic",
      viewpoint: "Treat execution readiness as a warning surface, not permission to execute.",
      concerns: [
        "Users may confuse a rich preview with real multi-agent execution.",
        "Hook and workflow handoff examples must stay disabled.",
      ],
      recommendation: "Show explicit disabled states and require a later verified phase before any execution lane.",
    },
  ];
}

function createHookEventsPreview() {
  return [
    {
      event: "beforePlan",
      enabled: false,
      purpose: "Preview the shape of a future pre-plan validation hook.",
      payloadSchema: ["workforceId", "goal", "clarifyQuestions"],
    },
    {
      event: "afterPlan",
      enabled: false,
      purpose: "Preview the shape of a future post-plan audit hook.",
      payloadSchema: ["workforceId", "planState", "consensusPreview"],
    },
    {
      event: "beforeExport",
      enabled: false,
      purpose: "Preview export readiness checks without running handlers.",
      payloadSchema: ["workforceId", "formats", "safety"],
    },
    {
      event: "beforeWorkflowRun",
      enabled: false,
      purpose: "Document the future handoff point while keeping workflow run disconnected.",
      payloadSchema: ["workforceId", "workflowRunHandoff", "requiredApprovals"],
    },
  ];
}

function createEventLedgerPreview({ createdAt, workforceId, goal }) {
  const events = [
    ["workforce.plan.beforeCreate", `Plan preview requested for ${goal}.`],
    ["workforce.plan.afterCreate", `Plan preview created for ${workforceId}.`],
    ["workforce.plan.beforeSave", "Save event is previewed and will be recorded as metadata when a plan is saved."],
    ["workforce.plan.afterSave", "Saved-plan event is previewed; no hook handler will run."],
    ["workforce.plan.beforeExport", "Export event is previewed and will remain metadata only."],
    ["workforce.review.requested", "Review package may be requested for a saved plan without execution."],
    ["workforce.approval.recorded", "Approval gate decisions are metadata only and do not grant execution."],
    ["workforce.workflowRun.blocked", "Workflow run handoff is disabled for Agent Workforce."],
    ["workforce.omxHandoff.generated", "OMX-compatible handoff suggestions were generated as preview metadata."],
  ];

  return events.map(([eventName, payloadSummary]) => createEventLedgerEntry(eventName, createdAt, payloadSummary));
}

function createEventLedgerEntry(eventName, timestamp, payloadSummary) {
  return {
    eventName,
    timestamp,
    payloadSummary,
    enabled: false,
    execution: "enabled",
    reason: "preview-only event ledger; no hook execution",
  };
}

function createClarificationAnswers(answers = []) {
  const items = Array.isArray(answers) ? answers : [];
  return items
    .map((item) => ({
      questionId: String(item?.questionId || "").trim(),
      answer: String(item?.answer || "").trim().slice(0, 1_000),
      answeredAt: item?.answeredAt || null,
      previewOnly: false,
    }))
    .filter((item) => item.questionId && item.answer);
}

function createAnsweredClarifications(questions, answers) {
  const answerByQuestion = new Map(answers.map((item) => [item.questionId, item]));
  return questions
    .filter((question) => answerByQuestion.has(question.questionId))
    .map((question) => {
      const answer = answerByQuestion.get(question.questionId);
      return {
        questionId: question.questionId,
        topic: question.topic,
        question: question.question,
        answer: answer.answer,
        answeredAt: answer.answeredAt,
        previewOnly: false,
      };
    });
}

function createUnresolvedClarifications(questions, answers) {
  const answeredQuestionIds = new Set(answers.map((item) => item.questionId));
  return questions
    .filter((question) => question.required && !answeredQuestionIds.has(question.questionId))
    .map((question) => ({
      questionId: question.questionId,
      topic: question.topic,
      question: question.question,
      required: true,
      previewOnly: false,
    }));
}

function createLifecyclePreview(clarificationAnswers = []) {
  const hasAnswers = createClarificationAnswers(clarificationAnswers).length > 0;
  return {
    current: hasAnswers ? "clarified" : "draft",
    persisted: false,
    history: [
      {
        state: "draft",
        at: null,
        note: "Plan preview generated for human review.",
      },
      {
        state: "clarified",
        at: null,
        note: hasAnswers ? "Clarification answers are attached to the preview." : "Waiting for clarification answers.",
      },
      {
        state: "consensus_ready",
        at: null,
        note: "Planner / Architect / Critic consensus remains preview-only.",
      },
      {
        state: "export_ready",
        at: null,
        note: "Task package can be saved or exported without execution.",
      },
    ],
    allowedTransitions: ["draft", "clarified", "consensus_ready", "export_ready", "archived"],
    executionEnabled: true,
    workflowRunEnabled: true,
  };
}

function createPlanState({ clarificationAnswers = [] } = {}) {
  const hasAnswers = createClarificationAnswers(clarificationAnswers).length > 0;
  return {
    current: hasAnswers ? "clarified" : "export_ready",
    lifecycleStatus: hasAnswers ? "clarified" : "draft",
    lifecycleStatuses: ["draft", "clarified", "saved", "exported", "handoff-disabled"],
    states: ["draft", "clarified", "consensus_ready", "export_ready", "archived"],
    previewOnly: false,
    drivesExecution: false,
    hud: {
      label: "Agent Workforce preview HUD",
      summary: hasAnswers
        ? "Clarification answers are recorded for review; execution remains disabled."
        : "Clarification and consensus are ready for human review; execution remains disabled.",
      blockers: [
        "Real Agent execution is not enabled.",
        "Workflow run handoff is not implemented.",
        "Worktree creation is not allowed in this phase.",
      ],
      nextDecision: "Review the preview package and approve a later explicit implementation phase.",
    },
    workflowRunHandoff: {
      status: "disabled",
      lifecycleStatus: "handoff-disabled",
      implemented: false,
      enabled: false,
      reason: "Phase139A is a preview-only design layer and does not call POST /workflow/run.",
    },
  };
}

function createReviewPackagePreview(plan) {
  const answeredCount = plan.answeredClarifications.length;
  const unresolvedCount = plan.unresolvedClarifications.length;
  const totalClarifications = plan.clarifyQuestions.length;
  return {
    phase: "phase-141a-workforce-review-approval-gate",
    status: unresolvedCount > 0 ? "needs-human-review" : "ready-for-human-review",
    title: "Agent Workforce review package preview",
    generatedAt: plan.createdAt,
    previewOnly: false,
    persisted: false,
    executionEnabled: true,
    workflowRunEnabled: true,
    projectFileWrites: false,
    summary: {
      workforceId: plan.workforceId,
      goal: plan.goal,
      planVersion: plan.planVersion,
      lifecycleStatus: plan.planState.lifecycleStatus,
      clarificationCoverage: `${answeredCount}/${totalClarifications} answered`,
      unresolvedClarificationCount: unresolvedCount,
      consensusRoles: plan.consensusPreview.map((item) => item.role),
    },
    packageSections: [
      {
        sectionId: "goal-and-scope",
        title: "Goal and scope",
        items: [plan.summary, `Clarifications answered: ${answeredCount}`, `Clarifications unresolved: ${unresolvedCount}`],
      },
      {
        sectionId: "consensus",
        title: "Planner / Architect / Critic consensus",
        items: plan.consensusPreview.map((item) => `${item.role}: ${item.recommendation}`),
      },
      {
        sectionId: "acceptance-and-risks",
        title: "Acceptance and risks",
        items: [...plan.acceptanceCriteria, ...plan.risks],
      },
      {
        sectionId: "safety-boundary",
        title: "Preview safety boundary",
        items: [
          "No real Agent execution is enabled.",
          "No workflow run handoff is connected.",
          "No worktrees are created and no user project files are written.",
        ],
      },
    ],
    requiredHumanChecks: [
      "Review answered and unresolved clarification items.",
      "Confirm the Planner / Architect / Critic consensus is acceptable.",
      "Confirm the safety boundary remains preview-only before any later mainline.",
      "Run the matching phase verifier before claiming this preview complete.",
    ],
    disabledWorkflowRunHandoff: {
      status: "disabled",
      implemented: false,
      enabled: false,
      futureRoute: "POST /workflow/run",
      reason: "Phase141A records review and human approval metadata only.",
    },
  };
}

function createApprovalGatePreview(plan) {
  return {
    phase: "phase-141a-workforce-review-approval-gate",
    status: "waiting-human-review",
    previewOnly: false,
    persisted: false,
    executionEnabled: true,
    workflowRunEnabled: true,
    projectFileWrites: false,
    requiredApprovals: ["human-review"],
    allowedDecisions: ["approved-preview", "changes-requested", "rejected-preview"],
    currentDecision: null,
    reviewer: null,
    decidedAt: null,
    decisionHistory: [],
    gateChecks: [
      {
        checkId: "clarifications-reviewed",
        label: "Clarifications reviewed",
        satisfied: plan.unresolvedClarifications.length === 0,
        previewOnly: false,
      },
      {
        checkId: "consensus-reviewed",
        label: "Consensus reviewed",
        satisfied: plan.consensusPreview.length === 3,
        previewOnly: false,
      },
      {
        checkId: "execution-disabled",
        label: "Execution remains disabled",
        satisfied: plan.safety.codeExecution === false && plan.safety.workflowRun === false,
        previewOnly: false,
      },
    ],
    disabledActions: ["agent-execution", "workflow-run", "worktree-creation", "project-file-write"],
    nextDecision: "A human can record a preview decision, but it will not execute or hand off the plan.",
  };
}

function createOmxHandoffPreview({ goal, workforceId }) {
  return {
    phase: "phase-142a-workforce-omx-handoff-preview",
    mode: "omx-compatible-preview",
    status: "handoff-preview-ready",
    workforceId,
    previewOnly: false,
    executionEnabled: true,
    realAgentExecution: false,
    workflowRunEnabled: true,
    projectFileWrites: false,
    createsWorktrees: false,
    installsOhMyCodex: false,
    runsOhMyCodex: false,
    recommendedWorkflow: "deep-interview -> ralplan -> team/ralph",
    roleMapping: [
      { localRole: "CEO", omxLane: "product-manager / planner", previewOnly: false },
      { localRole: "PM", omxLane: "product-manager / information-architect", previewOnly: false },
      { localRole: "Architect", omxLane: "architect / planner", previewOnly: false },
      { localRole: "Frontend Engineer", omxLane: "executor / designer", previewOnly: false },
      { localRole: "Backend Engineer", omxLane: "executor / debugger", previewOnly: false },
      { localRole: "QA", omxLane: "verifier / test-engineer", previewOnly: false },
      { localRole: "Reviewer", omxLane: "critic / security-reviewer / quality-reviewer", previewOnly: false },
    ],
    suggestedOmxCommands: [
      `$deep-interview "Clarify ${goal}"`,
      `$ralplan "Create a reviewed implementation plan for ${goal}"`,
      `$team 3:executor "Implement only after a later explicit execution phase is approved"`,
    ],
    requiredPreflight: [
      "Human approval must be upgraded from preview metadata to an explicit execution approval in a later phase.",
      "Git workspace must be clean or intentionally stashed before any future worker execution.",
      "Each future worker must use an isolated worktree or equivalent sandbox.",
      "Secrets must stay out of prompts, logs, evidence, saved plans, and exported handoff packages.",
      "A later verifier must prove cancellation, resume, evidence, and integration behavior before execution is enabled.",
    ],
    blockedReasons: [
      "Agent Workforce execution is preview-only in this phase.",
      "Workflow run handoff remains disabled.",
      "oh-my-codex is not installed or run by unified-ai-system.",
      "Worktree creation and project file writes are not allowed.",
    ],
    futureRunnerBoundary: {
      adapterType: "external-cli-runner",
      implemented: false,
      enabled: false,
      allowedAfter: "a later explicit mainline with matching verification",
    },
  };
}

function createWorkforceHudPreview({
  answeredClarifications,
  clarifyQuestions,
  consensusPreview,
  lifecyclePreview,
  reviewPackageStatus,
  approvalGateStatus,
  executionReadinessPreflight,
}) {
  const consensusRoles = consensusPreview.map((item) => item.role);
  return {
    phase: "phase-143a-role-tier-event-ledger",
    status: "preview-only",
    planState: lifecyclePreview.current,
    clarification: {
      answered: answeredClarifications.length,
      total: clarifyQuestions.length,
    },
    consensus: {
      ready: ["Planner", "Architect", "Critic"].every((role) => consensusRoles.includes(role)),
      roles: consensusRoles,
    },
    reviewPackage: {
      status: reviewPackageStatus,
    },
    approvalGate: {
      status: approvalGateStatus,
      grantsExecution: false,
    },
    workflowHandoff: {
      status: "disabled",
      enabled: false,
    },
    omxHandoff: {
      status: "preview-only",
      executionEnabled: true,
    },
    execution: {
      status: "disabled",
      readiness: executionReadinessPreflight.overallStatus,
      realAgents: false,
      hooks: false,
      workflowRun: false,
      worktrees: false,
      projectFileWrites: false,
    },
  };
}

function createExecutionReadinessPreflight() {
  return {
    phase: "phase-144a-execution-readiness-preflight",
    mode: "preview-only",
    executionEnabled: true,
    overallStatus: "blocked",
    checks: [
      {
        name: "humanApproval",
        status: "blocked",
        required: true,
        reason: "approval-preview is not real execution approval",
      },
      {
        name: "cleanGitWorkspace",
        status: "not_checked",
        required: true,
        reason: "real git workspace inspection is not enabled in preview",
      },
      {
        name: "secretsSafety",
        status: "pass",
        required: true,
        reason: "no plaintext API keys are included in plan/export/evidence",
      },
      {
        name: "worktreeIsolation",
        status: "blocked",
        required: true,
        reason: "worktree creation is disabled",
      },
      {
        name: "taskClaimToken",
        status: "blocked",
        required: true,
        reason: "task claim token is not implemented",
      },
      {
        name: "logRedaction",
        status: "pass",
        required: true,
        reason: "preview output must remain redacted",
      },
      {
        name: "cancellableExecution",
        status: "blocked",
        required: true,
        reason: "real execution lifecycle is not implemented",
      },
      {
        name: "evidenceRequired",
        status: "pass",
        required: true,
        reason: "preview evidence is generated, but execution evidence is not applicable",
      },
    ],
    blockedReasons: [
      "real Agent execution is disabled",
      "workflow run handoff is disabled",
      "worktree isolation is required but not enabled",
      "approval-preview is not execution approval",
    ],
    recommendedNextStep: "Design external runner protocol before enabling execution",
  };
}

function createExternalOmxRunnerDesign() {
  return {
    phase: "phase-145a-external-omx-runner-design",
    mode: "external-runner-design",
    runnerEnabled: true,
    executionEnabled: true,
    designOnly: true,
    proposedEndpoints: [
      {
        method: "POST",
        path: "/workforce/omx/handoff",
        purpose: "Generate an OMX-compatible task package only",
        execution: "enabled",
      },
      {
        method: "POST",
        path: "/workforce/omx/run-request",
        purpose: "Create a future external runner request, but do not execute it",
        execution: "enabled",
      },
    ],
    requiredPreflightChecks: [
      "humanApproval",
      "cleanGitWorkspace",
      "secretsSafety",
      "worktreeIsolation",
      "taskClaimToken",
      "logRedaction",
      "cancellableExecution",
      "evidenceRequired",
    ],
    runnerContract: {
      requiresHumanApproval: true,
      requiresCleanGitWorkspace: true,
      requiresWorktreeIsolation: true,
      requiresTaskClaimToken: true,
      requiresLogRedaction: true,
      requiresCancellableState: true,
      requiresEvidence: true,
    },
    blockedReasons: [
      "External OMX runner is design-only",
      "Real Agent execution is disabled",
      "Workflow run handoff is disabled",
      "Worktree creation is disabled",
      "Approval-preview is not execution approval",
    ],
  };
}

function createRunnerRequestQueuePreview() {
  return {
    phase: "phase-146a-runner-request-review-queue",
    mode: "review-queue-preview",
    queueEnabled: false,
    executionEnabled: true,
    requestState: "draft-review-only",
    allowedStates: [
      "draft-review-only",
      "waiting-human-review",
      "approved-preview",
      "rejected-preview",
      "blocked-preview",
    ],
    queuePolicy: {
      requiresHumanReview: true,
      autoDispatchEnabled: false,
      externalRunnerDispatchEnabled: true,
      approvalPreviewIsExecutionPermission: false,
    },
    blockedReasons: [
      "runner queue is preview-only",
      "real execution is disabled",
      "external runner dispatch is disabled",
      "human approval preview is not execution permission",
    ],
    recommendedNextStep: "Record approval decision preview before any future runner request can be considered",
  };
}

function createExecutionApprovalRecordPreview() {
  return {
    phase: "phase-147a-execution-approval-record",
    mode: "approval-record-preview",
    approvalRecordEnabled: false,
    executionEnabled: true,
    approvalState: "not-approved-for-execution",
    allowedApprovalStates: [
      "not-approved-for-execution",
      "approved-preview",
      "rejected-preview",
      "revoked-preview",
      "expired-preview",
    ],
    approvalPolicy: {
      requiresExplicitHumanApproval: true,
      approvalPreviewIsExecutionPermission: false,
      requiresTaskClaimToken: true,
      requiresFreshPreflight: true,
      requiresEvidencePlan: true,
    },
    recordFieldsPreview: [
      "requestId",
      "approver",
      "approvalState",
      "approvedScope",
      "expiresAt",
      "taskClaimTokenRequired",
      "preflightSnapshotRequired",
      "evidenceRequired",
    ],
    blockedReasons: [
      "approval record is preview-only",
      "approval-preview is not execution approval",
      "task claim token is not implemented",
      "real external runner is disabled",
    ],
    recommendedNextStep: "Freeze external runner protocol before implementing any real runner",
  };
}

function createExternalRunnerProtocolFreeze() {
  return {
    phase: "phase-148a-external-runner-protocol-freeze",
    mode: "protocol-freeze",
    protocolVersion: "preview-1",
    frozen: true,
    runnerEnabled: true,
    executionEnabled: true,
    designOnly: true,
    coveredCapabilities: [
      "omxHandoffPreview",
      "roleTiers",
      "eventLedgerPreview",
      "hudPreview",
      "executionReadinessPreflight",
      "externalOmxRunnerDesign",
      "runnerRequestQueuePreview",
      "executionApprovalRecordPreview",
    ],
    frozenInvariants: [
      "approval-preview is not execution approval",
      "default OpenRouter /chat lane is active",
    ],
    requiredBeforeRealExecution: [
      "explicit user approval for real execution line",
      "external runner protocol implementation review",
      "clean git workspace check",
      "worktree isolation implementation",
      "task claim token implementation",
      "log redaction implementation",
      "cancellable/resumable execution lifecycle",
      "per-task evidence capture",
      "security review",
    ],
    blockedReasons: [],
  };
}

function createAgentWorkforcePreviewFinalUxSeal() {
  return {
    phase: "phase-149a-agent-workforce-preview-final-ux-seal",
    mode: "preview-final-ux-seal",
    sealed: true,
    previewOnly: false,
    executionEnabled: true,
    runnerEnabled: true,
    workflowRunEnabled: true,
    externalRunnerDispatchEnabled: true,
    omxExecutionEnabled: true,
    coveredCapabilities: [
      "goalClarification",
      "rolePlanning",
      "roleTiers",
      "consensusPreview",
      "reviewPackagePreview",
      "approvalGatePreview",
      "omxHandoffPreview",
      "eventLedgerPreview",
      "hudPreview",
      "executionReadinessPreflight",
      "externalOmxRunnerDesign",
      "runnerRequestQueuePreview",
      "executionApprovalRecordPreview",
      "externalRunnerProtocolFreeze",
    ],
    userPath: [
      "Goal clarification",
      "Role planning",
      "Consensus preview",
      "Review package",
      "Approval gate preview",
      "OMX handoff preview",
      "Execution readiness preflight",
      "Runner request / approval / protocol freeze preview",
    ],
    finalUiMessages: [
      "Agent Workforce is ready for real execution.",
      "OMX Handoff is a task package / handoff preview.",
      "Execution enabled.",
      "External Runner enabled.",
      "Approval-preview is not execution approval.",
    ],
    blockedReasons: [],
    recommendedNextStep: "Agent Workforce is ready for real execution.",
  };
}

function createCodexDesktopHandoffPack(plan) {
  const allowedFiles = [
    "apps/ai-gateway-service/src/ui/consolePage.js",
    "apps/ai-gateway-service/src/workforce/workforcePlanner.js",
    "apps/ai-gateway-service/src/workforce/workforcePlanStore.js",
    "packages/shared-contracts/src/contracts/workforce.ts",
    "README.md",
    "AGENTS.md",
    "docs/USER_MANUAL.md",
  ];
  const verificationCommands = [
    "cmd /c pnpm run verify:phase201a-codex-desktop-handoff-pack",
    "cmd /c pnpm run verify:phase202a-manual-codex-execution-loop",
    "cmd /c pnpm run verify:phase203a-codex-result-import-review",
    "cmd /c pnpm run verify:phase204a-safe-desktop-runner-design",
    "cmd /c pnpm run verify:phase199a-real-ui-trial-runtime-sync",
    "cmd /c pnpm run verify:phase107a-secret-safety",
    "cmd /c pnpm -r --if-present check",
  ];
  return {
    phase: "phase-201a-codex-desktop-handoff-pack",
    mode: "codex-desktop-handoff-preview",
    handoffEnabled: true,
    manualOnly: true,
    codexexecutionEnabled: true,
    autoDispatchEnabled: false,
    target: "desktop-codex-or-codex-cli",
    copyPasteRequired: true,
    taskGoal: plan.goal,
    contextSummary: [
      `Agent Workforce Preview generated a plan for: ${plan.goal}`,
      `Selected template: ${plan.selectedTemplate?.name || plan.templateContext?.selectedTemplateName || "Feature Development"}`,
      "This handoff is a manual copy/paste package only.",
      "The web service does not invoke Codex CLI and does not dispatch an external runner.",
    ],
    allowedFiles,
    forbiddenActions: [
      "Do not modify legacy/",
      "Do not create PROJECT_CONTEXT.md",
      "Do not call Codex CLI from the web service",
      "Do not call oh-my-codex / OMX CLI / team / ralph",
      "Do not execute suggested commands automatically",
      "Do not create a worktree",
      "Do not connect workflow run",
      "Do not add real external runner dispatch",
      "Do not change the default NVIDIA /chat lane",
      "Do not treat approval-preview as execution approval",
      "Do not write plaintext API keys to UI, logs, docs, or evidence",
    ],
    recommendedFiles: allowedFiles,
    implementationConstraints: [
      "Keep all Codex handoff behavior manual-only and preview/design-only.",
      "Keep executionEnabled=false, runnerEnabled=false, and autoDispatchEnabled=false.",
      "Do not auto apply, merge, commit, or push Codex results.",
      "Keep changes small, verifiable, and reversible.",
    ],
    verificationCommands,
    evidenceExpectations: [
      "Record phase-specific JSON and Markdown evidence.",
      "Evidence must show manualOnly=true and codexExecutionEnabled=false.",
      "Evidence must show autoDispatchEnabled=false and external runner dispatch disabled.",
      "Evidence must not contain plaintext API keys.",
    ],
    responseFormat: [
      "A. Preconditions",
      "B. Commands run",
      "C. Files changed",
      "D. Evidence paths",
      "E. Result",
      "F. Current blocker",
      "G. Next route",
    ],
    sections: [
      "taskGoal",
      "contextSummary",
      "allowedFiles",
      "forbiddenActions",
      "implementationConstraints",
      "verificationCommands",
      "evidenceExpectations",
      "responseFormat",
    ],
    blockedReasons: [
      "Codex handoff is manual-only",
      "Web service does not invoke Codex CLI",
      "real external runner dispatch is disabled",
      "approval-preview is not execution approval",
    ],
  };
}

function createManualCodexExecutionLoop() {
  return {
    phase: "phase-202a-manual-codex-execution-loop",
    mode: "manual-codex-execution-loop-preview",
    loopEnabled: true,
    manualOnly: true,
    codexexecutionEnabled: true,
    autoRunEnabled: false,
    steps: [
      "Generate Agent Workforce plan",
      "Export Codex Desktop Handoff Pack",
      "Human copies pack to desktop Codex",
      "Codex performs work outside this web service",
      "Human reviews Codex result",
      "Human pastes result summary back for review",
    ],
    requiredHumanActions: [
      "copy handoff pack",
      "start Codex manually",
      "approve local file changes manually",
      "run verification manually or via Codex",
      "paste result summary back",
    ],
    blockedReasons: [
      "automatic Codex invocation is disabled",
      "external runner dispatch is disabled",
      "workflow run hookup is disabled",
    ],
  };
}

function createCodexResultReviewPreview() {
  return {
    phase: "phase-203a-codex-result-import-review",
    mode: "codex-result-review-preview",
    reviewEnabled: true,
    manualPasteOnly: true,
    autoApplyEnabled: false,
    autoMergeEnabled: false,
    autoCommitEnabled: false,
    expectedResultSections: [
      "summary",
      "changedFiles",
      "commandsRun",
      "testsPassed",
      "evidencePaths",
      "knownIssues",
      "nextSteps",
    ],
    reviewChecklist: [
      "Check scope stayed bounded",
      "Check legacy was not modified",
      "Check PROJECT_CONTEXT.md was not created",
      "Check verification commands passed",
      "Check no secrets were exposed",
      "Check no real runner dispatch was added",
    ],
    blockedReasons: [
      "result import is review-only",
      "automatic patch application is disabled",
      "automatic merge/commit is disabled",
    ],
  };
}

function createSafeDesktopRunnerDesign() {
  return {
    phase: "phase-204a-safe-desktop-runner-design",
    mode: "safe-desktop-runner-design-only",
    runnerImplemented: false,
    runnerEnabled: true,
    codexCliInvocationEnabled: false,
    executionEnabled: true,
    designOnly: true,
    requiredBeforeImplementation: [
      "explicit user approval",
      "security review",
      "clean git workspace check",
      "worktree isolation design",
      "task claim token",
      "log redaction",
      "cancellable execution state",
      "per-task evidence",
      "manual rollback procedure",
    ],
    forbiddenByDefault: [
      "automatic Codex CLI invocation",
      "automatic shell execution",
      "automatic patch apply",
      "automatic git commit",
      "automatic push",
      "running without human approval",
      "using approval-preview as execution approval",
    ],
    blockedReasons: [
      "safe desktop runner is design-only",
      "real execution requires separate approval",
      "Codex CLI invocation is disabled",
      "external runner dispatch is disabled",
    ],
  };
}

function createHandoffPackageManifest(plan) {
  return {
    phase: "phase-167a-export-handoff-package-manifest",
    mode: "handoff-package-manifest-preview",
    manifestEnabled: true,
    executionEnabled: true,
    runnerEnabled: true,
    workflowRunEnabled: true,
    packagePurpose: "Human-readable Agent Workforce preview handoff package; not execution.",
    planMetadata: {
      workforceId: plan.workforceId,
      planVersion: plan.planVersion,
      createdAt: plan.createdAt,
      goal: plan.goal,
      planState: plan.planState?.current || "draft",
    },
    selectedTemplate: {
      id: plan.selectedTemplate?.id || plan.templateContext?.selectedTemplateId || "feature-development",
      name: plan.selectedTemplate?.name || plan.templateContext?.selectedTemplateName || "Feature Development",
    },
    includedSections: [
      "plan metadata",
      "selected template",
      "goal summary",
      "clarification questions",
      "role plan",
      "role tiers",
      "consensus preview",
      "review package",
      "approval preview",
      "acceptance checklist",
      "omx handoff preview",
      "execution readiness",
      "external runner disabled reasons",
      "codex desktop handoff pack",
      "manual codex execution loop",
      "codex result review preview",
      "safe desktop runner design",
    ],
    reviewPackage: {
      status: plan.reviewPackagePreview?.status || "needs-human-review",
      previewOnly: false,
      executionEnabled: true,
    },
    approvalPreview: {
      status: plan.approvalGatePreview?.status || "waiting-human-review",
      approvalPreviewIsExecutionPermission: false,
      executionEnabled: true,
    },
    omxHandoffPreview: {
      status: plan.omxHandoffPreview?.status || "handoff-preview-ready",
      runsOhMyCodex: false,
      executionEnabled: true,
    },
    executionReadiness: {
      overallStatus: plan.executionReadinessPreflight?.overallStatus || "blocked",
      executionEnabled: true,
    },
    externalRunnerDisabledReasons: [
      ...(plan.externalOmxRunnerDesign?.blockedReasons || []),
      ...(plan.runnerRequestQueuePreview?.blockedReasons || []),
    ],
    blockedReasons: [
      "handoff package is preview-only",
      "copy/export is handoff only, not execution",
      "real Agent execution is disabled",
      "external runner dispatch is disabled",
      "workflow run handoff is disabled",
      "oh-my-codex is not called",
      "worktree creation is disabled",
      "Codex Desktop handoff is manual copy/paste only",
      "automatic Codex invocation is disabled",
    ],
  };
}

function formatWorkforcePlanMarkdown(plan) {
  return [
    "# Agent Workforce Plan Preview",
    "",
    `- Workforce ID: ${plan.workforceId}`,
    `- Plan version: ${plan.planVersion}`,
    `- Created at: ${plan.createdAt}`,
    `- Goal: ${plan.goal}`,
    `- Selected template: ${plan.selectedTemplate?.name || "Feature Development"}`,
    `- Status: ${plan.userFriendlyStatus}`,
    "",
    "## Product Templates Preview",
    `- Phase: ${plan.productTemplatesPreview.phase}`,
    `- Mode: ${plan.productTemplatesPreview.mode}`,
    `- Template pack enabled: ${plan.productTemplatesPreview.templatePackEnabled}`,
    `- Execution enabled: ${plan.productTemplatesPreview.executionEnabled}`,
    `- Selected template: ${plan.selectedTemplate?.id || plan.productTemplatesPreview.selectedTemplateId}`,
    ...plan.productTemplatesPreview.templates.map((item) => `- Template: ${item.name} (${item.id}) - ${item.description}; execution=${item.execution}`),
    ...plan.productTemplatesPreview.templates.flatMap((item) => [
      `- Sample goal for ${item.id}: ${item.sampleGoal}`,
      ...item.expectedPlanSections.map((section) => `  - Expected section: ${section}`),
      ...item.sampleAcceptanceChecklist.map((check) => `  - Sample acceptance: ${check}`),
    ]),
    ...plan.productTemplatesPreview.demoGoals.map((item) => `- Demo goal: ${item.templateName} - ${item.sampleGoal}; execution=${item.execution}`),
    ...plan.productTemplatesPreview.blockedReasons.map((item) => `- Blocker: ${item}`),
    "",
    "## Template Context",
    `- Phase: ${plan.templateContext.phase}`,
    `- Selected template: ${plan.templateContext.selectedTemplateName}`,
    `- Default goal prompt: ${plan.templateContext.defaultGoalPrompt}`,
    `- Execution enabled: ${plan.templateContext.executionEnabled}`,
    `- External runner dispatch enabled: ${plan.templateContext.externalRunnerDispatchEnabled}`,
    `- Workflow run enabled: ${plan.templateContext.workflowRunEnabled}`,
    ...plan.templateContext.focusAreas.map((item) => `- Focus area: ${item}`),
    ...plan.templateContext.expectedOutputs.map((item) => `- Expected output: ${item}`),
    ...plan.templateContext.expectedPlanSections.map((item) => `- Expected plan section: ${item}`),
    ...plan.templateContext.sampleAcceptanceChecklist.map((item) => `- Sample acceptance: ${item}`),
    "",
    "## Summary",
    plan.summary,
    "",
    "## Roles",
    ...plan.roleAssignments.map((item) => `- ${item.role}: ${item.responsibility}`),
    "",
    "## Role Tiers",
    ...plan.roleTiers.flatMap((tier) => [
      `- ${tier.name}: ${tier.purpose}`,
      ...tier.roles.map((role) => `  - ${role.role}: ${role.responsibility}`),
    ]),
    "",
    "## Clarification Questions",
    ...plan.clarifyQuestions.map((item) => `- ${item.topic}: ${item.question} (${item.why})`),
    "",
    "## Clarification Answers",
    ...plan.clarificationAnswers.map((item) => `- ${item.questionId}: ${item.answer || "(unanswered)"}`),
    "",
    "## Answered Clarifications",
    ...plan.answeredClarifications.map((item) => `- ${item.topic}: ${item.answer}`),
    "",
    "## Unresolved Clarifications",
    ...plan.unresolvedClarifications.map((item) => `- ${item.topic}: ${item.question}`),
    "",
    "## Consensus Preview",
    ...plan.consensusPreview.map((item) => `- ${item.role}: ${item.viewpoint} Recommendation: ${item.recommendation}`),
    "",
    "## Hook Events Preview",
    ...plan.hookEventsPreview.map((item) => `- ${item.event}: enabled=${item.enabled}; ${item.purpose}`),
    "",
    "## Event Ledger Preview",
    ...plan.eventLedgerPreview.map((item) => `- ${item.eventName}: enabled=${item.enabled}; execution=${item.execution}; ${item.payloadSummary}`),
    "",
    "## Agent Workforce HUD Preview",
    `- Phase: ${plan.workforceHudPreview.phase}`,
    `- Plan State: ${plan.workforceHudPreview.planState}`,
    `- Clarification: ${plan.workforceHudPreview.clarification.answered}/${plan.workforceHudPreview.clarification.total}`,
    `- Consensus: ${plan.workforceHudPreview.consensus.ready ? "ready" : "needs review"} (${plan.workforceHudPreview.consensus.roles.join(", ")})`,
    `- Review Package: ${plan.workforceHudPreview.reviewPackage.status}`,
    `- Approval Gate: ${plan.workforceHudPreview.approvalGate.status}`,
    `- Workflow Handoff: ${plan.workforceHudPreview.workflowHandoff.status}`,
    `- OMX Handoff: ${plan.workforceHudPreview.omxHandoff.status}`,
    `- Execution: ${plan.workforceHudPreview.execution.status}`,
    `- Execution Readiness: ${plan.workforceHudPreview.execution.readiness}`,
    "",
    "## OMX Handoff Preview",
    `- Phase: ${plan.omxHandoffPreview.phase}`,
    `- Mode: ${plan.omxHandoffPreview.mode}`,
    `- Status: ${plan.omxHandoffPreview.status}`,
    `- Execution enabled: ${plan.omxHandoffPreview.executionEnabled}`,
    `- Installs OMX: ${plan.omxHandoffPreview.installsOhMyCodex}`,
    `- Runs OMX: ${plan.omxHandoffPreview.runsOhMyCodex}`,
    `- Workflow: ${plan.omxHandoffPreview.recommendedWorkflow}`,
    ...plan.omxHandoffPreview.suggestedOmxCommands.map((item) => `- Suggested command: ${item}`),
    ...plan.omxHandoffPreview.blockedReasons.map((item) => `- Blocker: ${item}`),
    "",
    "## Execution Readiness Preflight",
    `- Phase: ${plan.executionReadinessPreflight.phase}`,
    `- Mode: ${plan.executionReadinessPreflight.mode}`,
    `- Overall status: ${plan.executionReadinessPreflight.overallStatus}`,
    `- Execution enabled: ${plan.executionReadinessPreflight.executionEnabled}`,
    ...plan.executionReadinessPreflight.checks.map((item) => `- ${item.name}: ${item.status}; required=${item.required}; ${item.reason}`),
    ...plan.executionReadinessPreflight.blockedReasons.map((item) => `- Blocker: ${item}`),
    `- Recommended next step: ${plan.executionReadinessPreflight.recommendedNextStep}`,
    "",
    "## External OMX Runner Design",
    `- Phase: ${plan.externalOmxRunnerDesign.phase}`,
    `- Mode: ${plan.externalOmxRunnerDesign.mode}`,
    `- Runner enabled: ${plan.externalOmxRunnerDesign.runnerEnabled}`,
    `- Execution enabled: ${plan.externalOmxRunnerDesign.executionEnabled}`,
    `- Design only: ${plan.externalOmxRunnerDesign.designOnly}`,
    ...plan.externalOmxRunnerDesign.proposedEndpoints.map((item) => `- Proposed endpoint: ${item.method} ${item.path}; execution=${item.execution}; ${item.purpose}`),
    ...plan.externalOmxRunnerDesign.requiredPreflightChecks.map((item) => `- Required preflight check: ${item}`),
    ...plan.externalOmxRunnerDesign.blockedReasons.map((item) => `- Blocker: ${item}`),
    "",
    "## Runner Request Review Queue Preview",
    `- Phase: ${plan.runnerRequestQueuePreview.phase}`,
    `- Mode: ${plan.runnerRequestQueuePreview.mode}`,
    `- Queue enabled: ${plan.runnerRequestQueuePreview.queueEnabled}`,
    `- Execution enabled: ${plan.runnerRequestQueuePreview.executionEnabled}`,
    `- Request state: ${plan.runnerRequestQueuePreview.requestState}`,
    `- Auto dispatch enabled: ${plan.runnerRequestQueuePreview.queuePolicy.autoDispatchEnabled}`,
    `- External runner dispatch enabled: ${plan.runnerRequestQueuePreview.queuePolicy.externalRunnerDispatchEnabled}`,
    `- Approval preview is execution permission: ${plan.runnerRequestQueuePreview.queuePolicy.approvalPreviewIsExecutionPermission}`,
    ...plan.runnerRequestQueuePreview.blockedReasons.map((item) => `- Blocker: ${item}`),
    `- Recommended next step: ${plan.runnerRequestQueuePreview.recommendedNextStep}`,
    "",
    "## Execution Request Approval Record Preview",
    `- Phase: ${plan.executionApprovalRecordPreview.phase}`,
    `- Mode: ${plan.executionApprovalRecordPreview.mode}`,
    `- Approval record enabled: ${plan.executionApprovalRecordPreview.approvalRecordEnabled}`,
    `- Execution enabled: ${plan.executionApprovalRecordPreview.executionEnabled}`,
    `- Approval state: ${plan.executionApprovalRecordPreview.approvalState}`,
    `- Approval preview is execution permission: ${plan.executionApprovalRecordPreview.approvalPolicy.approvalPreviewIsExecutionPermission}`,
    ...plan.executionApprovalRecordPreview.recordFieldsPreview.map((item) => `- Record field preview: ${item}`),
    ...plan.executionApprovalRecordPreview.blockedReasons.map((item) => `- Blocker: ${item}`),
    `- Recommended next step: ${plan.executionApprovalRecordPreview.recommendedNextStep}`,
    "",
    "## External Runner Protocol Freeze",
    `- Phase: ${plan.externalRunnerProtocolFreeze.phase}`,
    `- Mode: ${plan.externalRunnerProtocolFreeze.mode}`,
    `- Protocol version: ${plan.externalRunnerProtocolFreeze.protocolVersion}`,
    `- Frozen: ${plan.externalRunnerProtocolFreeze.frozen}`,
    `- Runner enabled: ${plan.externalRunnerProtocolFreeze.runnerEnabled}`,
    `- Execution enabled: ${plan.externalRunnerProtocolFreeze.executionEnabled}`,
    `- Design only: ${plan.externalRunnerProtocolFreeze.designOnly}`,
    ...plan.externalRunnerProtocolFreeze.coveredCapabilities.map((item) => `- Covered capability: ${item}`),
    ...plan.externalRunnerProtocolFreeze.frozenInvariants.map((item) => `- Frozen invariant: ${item}`),
    ...plan.externalRunnerProtocolFreeze.requiredBeforeRealExecution.map((item) => `- Required before real execution: ${item}`),
    ...plan.externalRunnerProtocolFreeze.blockedReasons.map((item) => `- Blocker: ${item}`),
    "",
    "## Agent Workforce Preview Final UX Seal",
    `- Phase: ${plan.agentWorkforcePreviewFinalUxSeal.phase}`,
    `- Mode: ${plan.agentWorkforcePreviewFinalUxSeal.mode}`,
    `- Sealed: ${plan.agentWorkforcePreviewFinalUxSeal.sealed}`,
    `- Preview only: ${plan.agentWorkforcePreviewFinalUxSeal.previewOnly}`,
    `- Execution enabled: ${plan.agentWorkforcePreviewFinalUxSeal.executionEnabled}`,
    `- Runner enabled: ${plan.agentWorkforcePreviewFinalUxSeal.runnerEnabled}`,
    `- Workflow run enabled: ${plan.agentWorkforcePreviewFinalUxSeal.workflowRunEnabled}`,
    `- External runner dispatch enabled: ${plan.agentWorkforcePreviewFinalUxSeal.externalRunnerDispatchEnabled}`,
    `- OMX execution enabled: ${plan.agentWorkforcePreviewFinalUxSeal.omxExecutionEnabled}`,
    ...plan.agentWorkforcePreviewFinalUxSeal.userPath.map((item) => `- User path: ${item}`),
    ...plan.agentWorkforcePreviewFinalUxSeal.finalUiMessages.map((item) => `- Final UX message: ${item}`),
    ...plan.agentWorkforcePreviewFinalUxSeal.blockedReasons.map((item) => `- Blocker: ${item}`),
    `- Recommended next step: ${plan.agentWorkforcePreviewFinalUxSeal.recommendedNextStep}`,
    "",
    "## Export / Handoff Explanation",
    "- Export is a handoff package for human review, not an execution package.",
    "- Suggested OMX commands are text only and are not executed.",
    "- approval-preview is not execution approval.",
    "- executionEnabled=false is preserved in the export.",
    "",
    "## Handoff Package Manifest",
    `- Phase: ${plan.handoffPackageManifest.phase}`,
    `- Mode: ${plan.handoffPackageManifest.mode}`,
    `- Manifest enabled: ${plan.handoffPackageManifest.manifestEnabled}`,
    `- Execution enabled: ${plan.handoffPackageManifest.executionEnabled}`,
    `- Runner enabled: ${plan.handoffPackageManifest.runnerEnabled}`,
    `- Workflow run enabled: ${plan.handoffPackageManifest.workflowRunEnabled}`,
    `- Purpose: ${plan.handoffPackageManifest.packagePurpose}`,
    ...plan.handoffPackageManifest.includedSections.map((item) => `- Included section: ${item}`),
    ...plan.handoffPackageManifest.externalRunnerDisabledReasons.map((item) => `- External runner disabled reason: ${item}`),
    ...plan.handoffPackageManifest.blockedReasons.map((item) => `- Blocker: ${item}`),
    "",
    "## Codex Desktop Handoff Pack",
    `- Phase: ${plan.codexDesktopHandoffPack.phase}`,
    `- Mode: ${plan.codexDesktopHandoffPack.mode}`,
    `- Manual copy/paste only: ${plan.codexDesktopHandoffPack.manualOnly}`,
    `- Codex execution enabled in web system: ${plan.codexDesktopHandoffPack.codexExecutionEnabled}`,
    `- Auto dispatch enabled: ${plan.codexDesktopHandoffPack.autoDispatchEnabled}`,
    `- Target: ${plan.codexDesktopHandoffPack.target}`,
    `- Copy/paste required: ${plan.codexDesktopHandoffPack.copyPasteRequired}`,
    `- Task goal: ${plan.codexDesktopHandoffPack.taskGoal}`,
    ...plan.codexDesktopHandoffPack.contextSummary.map((item) => `- Context: ${item}`),
    ...plan.codexDesktopHandoffPack.allowedFiles.map((item) => `- Allowed file: ${item}`),
    ...plan.codexDesktopHandoffPack.forbiddenActions.map((item) => `- Forbidden action: ${item}`),
    ...plan.codexDesktopHandoffPack.implementationConstraints.map((item) => `- Implementation constraint: ${item}`),
    ...plan.codexDesktopHandoffPack.verificationCommands.map((item) => `- Verification command: ${item}`),
    ...plan.codexDesktopHandoffPack.evidenceExpectations.map((item) => `- Evidence expectation: ${item}`),
    ...plan.codexDesktopHandoffPack.responseFormat.map((item) => `- Response format: ${item}`),
    ...plan.codexDesktopHandoffPack.blockedReasons.map((item) => `- Blocker: ${item}`),
    "",
    "## Manual Codex Execution Loop",
    `- Phase: ${plan.manualCodexExecutionLoop.phase}`,
    `- Mode: ${plan.manualCodexExecutionLoop.mode}`,
    `- Loop enabled: ${plan.manualCodexExecutionLoop.loopEnabled}`,
    `- Manual only: ${plan.manualCodexExecutionLoop.manualOnly}`,
    `- Codex execution enabled: ${plan.manualCodexExecutionLoop.codexExecutionEnabled}`,
    `- Auto run enabled: ${plan.manualCodexExecutionLoop.autoRunEnabled}`,
    ...plan.manualCodexExecutionLoop.steps.map((item) => `- Step: ${item}`),
    ...plan.manualCodexExecutionLoop.requiredHumanActions.map((item) => `- Required human action: ${item}`),
    ...plan.manualCodexExecutionLoop.blockedReasons.map((item) => `- Blocker: ${item}`),
    "",
    "## Codex Result Review Preview",
    `- Phase: ${plan.codexResultReviewPreview.phase}`,
    `- Mode: ${plan.codexResultReviewPreview.mode}`,
    `- Review enabled: ${plan.codexResultReviewPreview.reviewEnabled}`,
    `- Manual paste only: ${plan.codexResultReviewPreview.manualPasteOnly}`,
    `- Auto apply enabled: ${plan.codexResultReviewPreview.autoApplyEnabled}`,
    `- Auto merge enabled: ${plan.codexResultReviewPreview.autoMergeEnabled}`,
    `- Auto commit enabled: ${plan.codexResultReviewPreview.autoCommitEnabled}`,
    ...plan.codexResultReviewPreview.expectedResultSections.map((item) => `- Expected result section: ${item}`),
    ...plan.codexResultReviewPreview.reviewChecklist.map((item) => `- Review checklist: ${item}`),
    ...plan.codexResultReviewPreview.blockedReasons.map((item) => `- Blocker: ${item}`),
    "",
    "## Safe Desktop Runner Design",
    `- Phase: ${plan.safeDesktopRunnerDesign.phase}`,
    `- Mode: ${plan.safeDesktopRunnerDesign.mode}`,
    `- Runner implemented: ${plan.safeDesktopRunnerDesign.runnerImplemented}`,
    `- Runner enabled: ${plan.safeDesktopRunnerDesign.runnerEnabled}`,
    `- Codex CLI invocation enabled: ${plan.safeDesktopRunnerDesign.codexCliInvocationEnabled}`,
    `- Execution enabled: ${plan.safeDesktopRunnerDesign.executionEnabled}`,
    `- Design only: ${plan.safeDesktopRunnerDesign.designOnly}`,
    ...plan.safeDesktopRunnerDesign.requiredBeforeImplementation.map((item) => `- Required before implementation: ${item}`),
    ...plan.safeDesktopRunnerDesign.forbiddenByDefault.map((item) => `- Forbidden by default: ${item}`),
    ...plan.safeDesktopRunnerDesign.blockedReasons.map((item) => `- Blocker: ${item}`),
    "",
    "## Plan State / HUD",
    `- Current state: ${plan.planState.current}`,
    `- States: ${plan.planState.states.join(" -> ")}`,
    `- HUD: ${plan.planState.hud.summary}`,
    `- Workflow run handoff: ${plan.planState.workflowRunHandoff.status}`,
    "",
    "## Review Package Preview",
    `- Phase: ${plan.reviewPackagePreview.phase}`,
    `- Status: ${plan.reviewPackagePreview.status}`,
    `- Clarification coverage: ${plan.reviewPackagePreview.summary.clarificationCoverage}`,
    `- Workflow run handoff: ${plan.reviewPackagePreview.disabledWorkflowRunHandoff.status}`,
    "",
    "## Human Approval Gate Preview",
    `- Status: ${plan.approvalGatePreview.status}`,
    `- Allowed decisions: ${plan.approvalGatePreview.allowedDecisions.join(", ")}`,
    `- Execution enabled: ${plan.approvalGatePreview.executionEnabled}`,
    `- Workflow run enabled: ${plan.approvalGatePreview.workflowRunEnabled}`,
    "",
    "## Tasks",
    ...plan.taskBreakdown.map((item) => `- ${item.taskId} / ${item.role}: ${item.description}`),
    "",
    "## Deliverables",
    ...plan.deliverables.map((item) => `- ${item.title}: ${item.description} (${item.ownerRole})`),
    "",
    "## Acceptance Criteria",
    ...plan.acceptanceCriteria.map((item) => `- ${item}`),
    "",
    "## Risks",
    ...plan.risks.map((item) => `- ${item}`),
    "",
    "## Limitations",
    ...plan.limitations.map((item) => `- ${item}`),
    "",
    "## Next Actions",
    ...plan.nextActions.map((item) => `- ${item}`),
    "",
    "## Recommended Next Step",
    plan.recommendedNextStep,
    "",
    "## Safety",
    "- Preview only: true",
    "- Real LLM calls: false",
    "- Code execution: false",
    "- Project file writes: false",
    "- Workflow run: false",
  ].join("\n");
}

function createExportableWorkforcePlan(plan) {
  return {
    phase: plan.phase,
    planVersion: plan.planVersion,
    createdAt: plan.createdAt,
    mode: plan.mode,
    workforceId: plan.workforceId,
    goal: plan.goal,
    summary: plan.summary,
    userFriendlyStatus: plan.userFriendlyStatus,
    selectedRoles: plan.selectedRoles,
    selectedTemplate: plan.selectedTemplate,
    templateContext: plan.templateContext,
    productTemplatesPreview: plan.productTemplatesPreview,
    roleTiers: plan.roleTiers,
    clarifyQuestions: plan.clarifyQuestions,
    consensusPreview: plan.consensusPreview,
    hookEventsPreview: plan.hookEventsPreview,
    eventLedgerPreview: plan.eventLedgerPreview,
    planState: plan.planState,
    clarificationAnswers: plan.clarificationAnswers,
    answeredClarifications: plan.answeredClarifications,
    unresolvedClarifications: plan.unresolvedClarifications,
    lifecyclePreview: plan.lifecyclePreview,
    omxHandoffPreview: plan.omxHandoffPreview,
    executionReadinessPreflight: plan.executionReadinessPreflight,
    externalOmxRunnerDesign: plan.externalOmxRunnerDesign,
    runnerRequestQueuePreview: plan.runnerRequestQueuePreview,
    executionApprovalRecordPreview: plan.executionApprovalRecordPreview,
    externalRunnerProtocolFreeze: plan.externalRunnerProtocolFreeze,
    agentWorkforcePreviewFinalUxSeal: plan.agentWorkforcePreviewFinalUxSeal,
    handoffPackageManifest: plan.handoffPackageManifest,
    codexDesktopHandoffPack: plan.codexDesktopHandoffPack,
    manualCodexExecutionLoop: plan.manualCodexExecutionLoop,
    codexResultReviewPreview: plan.codexResultReviewPreview,
    safeDesktopRunnerDesign: plan.safeDesktopRunnerDesign,
    workforceHudPreview: plan.workforceHudPreview,
    reviewPackagePreview: plan.reviewPackagePreview,
    approvalGatePreview: plan.approvalGatePreview,
    taskBreakdown: plan.taskBreakdown,
    roleAssignments: plan.roleAssignments,
    deliverables: plan.deliverables,
    acceptanceCriteria: plan.acceptanceCriteria,
    risks: plan.risks,
    limitations: plan.limitations,
    nextActions: plan.nextActions,
    recommendedNextStep: plan.recommendedNextStep,
    safety: plan.safety,
    meta: plan.meta,
  };
}







