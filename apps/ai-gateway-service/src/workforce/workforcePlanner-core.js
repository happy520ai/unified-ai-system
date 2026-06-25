import { createHash } from "node:crypto";
import { listWorkforceRoles } from "./workforceRoles.js";
import { PRODUCT_TEMPLATES as IMPORTED_TEMPLATES, PRODUCT_TEMPLATE_PHASE } from "./workforceTemplates.js";

export const MAX_GOAL_LENGTH = 1_000;
export const PRODUCT_TEMPLATES = IMPORTED_TEMPLATES;

export function normalizeGoal(goal) {
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

export function createWorkforceId(goal) {
  const hash = createHash("sha256").update(goal).digest("hex").slice(0, 12);
  return `wf_${hash}`;
}

export function createRoleTask({ role, goal, index }) {
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

export function normalizeSelectedTemplate(templateId) {
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

export function createTemplateContext(selectedTemplate) {
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

export function createProductTemplatesPreview(selectedTemplate) {
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

export function createDeliverables(goal) {
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

export function createRoleTiers(roles, tasks) {
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

export function createClarifyQuestions(goal) {
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

export function createClarificationAnswers(answers = []) {
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

export function createAnsweredClarifications(questions, answers) {
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

export function createUnresolvedClarifications(questions, answers) {
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
