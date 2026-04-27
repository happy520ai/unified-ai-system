import { createHash } from "node:crypto";
import { WORKFORCE_PHASE, listWorkforceRoles } from "./workforceRoles.js";

const MAX_GOAL_LENGTH = 1_000;

export function createWorkforcePlan(input = {}) {
  const goal = normalizeGoal(input.goal);
  const roles = listWorkforceRoles();
  const workforceId = createWorkforceId(goal);
  const selectedRoles = roles.map((role) => role.name);
  const taskBreakdown = roles.map((role, index) => createRoleTask({ role, goal, index }));
  const roleAssignments = roles.map((role) => ({
    roleId: role.roleId,
    role: role.name,
    responsibility: role.responsibility,
    taskIds: taskBreakdown.filter((task) => task.roleId === role.roleId).map((task) => task.taskId),
  }));

  const plan = {
    success: true,
    phase: WORKFORCE_PHASE,
    planVersion: "102C.1",
    createdAt: new Date().toISOString(),
    mode: "deterministic-plan-preview",
    workforceId,
    goal,
    summary: `AI company plan preview for: ${goal}`,
    userFriendlyStatus: "ready_to_review",
    selectedRoles,
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
      previewOnly: true,
    },
    meta: {
      roleCount: roles.length,
      planner: "rule-based",
    },
  };
  plan.markdown = formatWorkforcePlanMarkdown(plan);
  plan.exportableJson = createExportableWorkforcePlan(plan);
  return plan;
}

function normalizeGoal(goal) {
  if (goal === undefined || goal === null) {
    const error = new Error("请输入目标，再生成 AI 团队计划。");
    error.code = "WORKFORCE_GOAL_REQUIRED";
    error.category = "validation";
    error.details = {
      userMessage: "请输入目标，再生成 AI 团队计划。",
    };
    throw error;
  }

  if (typeof goal !== "string") {
    const error = new Error("目标必须是文本。");
    error.code = "WORKFORCE_GOAL_MUST_BE_STRING";
    error.category = "validation";
    error.details = {
      userMessage: "目标必须是文本，请输入一句清楚的业务目标。",
      actualType: Array.isArray(goal) ? "array" : typeof goal,
    };
    throw error;
  }

  const normalized = goal.trim().replace(/\s+/g, " ");

  if (!normalized) {
    const error = new Error("请输入目标，再生成 AI 团队计划。");
    error.code = "WORKFORCE_GOAL_REQUIRED";
    error.category = "validation";
    error.details = {
      userMessage: "请输入目标，再生成 AI 团队计划。",
    };
    throw error;
  }

  if (normalized.length > MAX_GOAL_LENGTH) {
    const error = new Error(`目标太长，请控制在 ${MAX_GOAL_LENGTH} 个字符以内。`);
    error.code = "WORKFORCE_GOAL_TOO_LONG";
    error.category = "validation";
    error.details = {
      userMessage: `目标太长，请控制在 ${MAX_GOAL_LENGTH} 个字符以内。`,
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
    previewOnly: true,
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

function formatWorkforcePlanMarkdown(plan) {
  return [
    "# Agent Workforce Plan Preview",
    "",
    `- Workforce ID: ${plan.workforceId}`,
    `- Plan version: ${plan.planVersion}`,
    `- Created at: ${plan.createdAt}`,
    `- Goal: ${plan.goal}`,
    `- Status: ${plan.userFriendlyStatus}`,
    "",
    "## Summary",
    plan.summary,
    "",
    "## Roles",
    ...plan.roleAssignments.map((item) => `- ${item.role}: ${item.responsibility}`),
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
