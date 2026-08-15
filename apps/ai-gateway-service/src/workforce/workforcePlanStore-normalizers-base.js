import {
  WORKFORCE_PLAN_ROLE_TIER_EVENT_LEDGER_PHASE,
  WORKFORCE_PLAN_EXECUTION_READINESS_PREFLIGHT_PHASE,
  WORKFORCE_PLAN_EXTERNAL_OMX_RUNNER_DESIGN_PHASE,
  WORKFORCE_PLAN_RUNNER_REQUEST_QUEUE_PHASE,
  WORKFORCE_PLAN_EXECUTION_APPROVAL_RECORD_PHASE,
  WORKFORCE_PLAN_EXTERNAL_RUNNER_PROTOCOL_FREEZE_PHASE,
  WORKFORCE_PLAN_FINAL_UX_SEAL_PHASE,
  WORKFORCE_PLAN_PRODUCT_TEMPLATE_PACK_PHASE,
} from "./workforcePlanStore-constants.js";
import { redactSecrets } from "./workforcePlanStore-utils.js";

export function normalizeOmxHandoffPreview(source, plan = {}) {
  const base = source && typeof source === "object" ? source : {};
  const goal = typeof plan.goal === "string" ? plan.goal : "the approved Agent Workforce plan";
  return redactSecrets({
    ...base,
    phase: "phase-142a-workforce-omx-handoff-preview",
    mode: "omx-compatible-preview",
    status: base.status || "handoff-preview-ready",
    workforceId: base.workforceId || plan.workforceId || null,
    previewOnly: true,
    executionEnabled: false,
    realAgentExecution: false,
    workflowRunEnabled: false,
    projectFileWrites: false,
    createsWorktrees: false,
    installsOhMyCodex: false,
    runsOhMyCodex: false,
    recommendedWorkflow: base.recommendedWorkflow || "deep-interview -> ralplan -> team/ralph",
    roleMapping: Array.isArray(base.roleMapping) ? base.roleMapping : [],
    suggestedOmxCommands: Array.isArray(base.suggestedOmxCommands)
      ? base.suggestedOmxCommands
      : [
        `$deep-interview "Clarify ${goal}"`,
        `$ralplan "Create a reviewed implementation plan for ${goal}"`,
        `$team 3:executor "Implement only after a later explicit execution phase is approved"`,
      ],
    requiredPreflight: Array.isArray(base.requiredPreflight)
      ? base.requiredPreflight
      : [
        "Human approval must be upgraded from preview metadata to an explicit execution approval in a later phase.",
        "Git workspace must be clean or intentionally stashed before any future worker execution.",
        "Each future worker must use an isolated worktree or equivalent sandbox.",
        "Secrets must stay out of prompts, logs, evidence, saved plans, and exported handoff packages.",
      ],
    blockedReasons: Array.isArray(base.blockedReasons)
      ? base.blockedReasons
      : [
        "Agent Workforce execution is preview-only in this phase.",
        "Workflow run handoff remains disabled.",
        "oh-my-codex is not installed or run by unified-ai-system.",
        "Worktree creation and project file writes are not allowed.",
      ],
    futureRunnerBoundary: {
      ...(base.futureRunnerBoundary || {}),
      adapterType: base.futureRunnerBoundary?.adapterType || "external-cli-runner",
      implemented: false,
      enabled: false,
      allowedAfter: "a later explicit mainline with matching verification",
    },
  });
}

export function normalizeRoleTiers(source, plan = {}) {
  if (Array.isArray(source) && source.length) {
    return source.map((tier) => ({
      tierId: String(tier.tierId || "").trim(),
      name: String(tier.name || "").trim(),
      purpose: String(tier.purpose || "").trim(),
      previewOnly: true,
      workerExecution: false,
      roles: Array.isArray(tier.roles)
        ? tier.roles.map((role) => ({
          roleId: String(role.roleId || "").trim(),
          role: String(role.role || "").trim(),
          responsibility: String(role.responsibility || "").trim(),
          taskIds: Array.isArray(role.taskIds) ? role.taskIds.filter((item) => typeof item === "string") : [],
        }))
        : [],
    }));
  }

  const assignments = Array.isArray(plan.roleAssignments) ? plan.roleAssignments : [];
  const assignmentByRole = new Map(assignments.map((item) => [item.role, item]));
  return [
    createRoleTier("strategy", "Strategy", "Clarify business intent, user outcome, scope, and decision boundary.", ["CEO", "PM"], assignmentByRole),
    createRoleTier("architecture", "Architecture", "Shape the system insertion point, contracts, data flow, and rollback boundary.", ["Architect"], assignmentByRole),
    createRoleTier("implementation-planning", "Implementation Planning", "Split visible UI and backend service work into small verifiable tasks.", ["Frontend Engineer", "Backend Engineer"], assignmentByRole),
    createRoleTier("quality", "Quality", "Plan acceptance, regression checks, risks, non-goals, and safety blockers.", ["QA", "Reviewer"], assignmentByRole),
  ];
}

function createRoleTier(tierId, name, purpose, roleNames, assignmentByRole) {
  return {
    tierId,
    name,
    purpose,
    previewOnly: true,
    workerExecution: false,
    roles: roleNames.map((roleName) => {
      const assignment = assignmentByRole.get(roleName);
      return {
        roleId: assignment?.roleId || roleName.toLowerCase().replace(/\s+/g, "-"),
        role: roleName,
        responsibility: assignment?.responsibility || "",
        taskIds: Array.isArray(assignment?.taskIds) ? assignment.taskIds : [],
      };
    }),
  };
}

export function normalizeEventLedgerPreview(source) {
  return (Array.isArray(source) ? source : []).map((item) => ({
    eventName: String(item.eventName || "").trim(),
    timestamp: item.timestamp || new Date().toISOString(),
    payloadSummary: String(item.payloadSummary || "").trim(),
    enabled: false,
    execution: "disabled",
    reason: "preview-only event ledger; no hook execution",
  })).filter((item) => item.eventName);
}

export function appendEventLedgerEvent(source, eventName, timestamp, payloadSummary) {
  return [
    ...normalizeEventLedgerPreview(source),
    {
      eventName,
      timestamp,
      payloadSummary,
      enabled: false,
      execution: "disabled",
      reason: "preview-only event ledger; no hook execution",
    },
  ];
}

export function createPackageHudPreview(plan) {
  const clarificationAnswers = Array.isArray(plan.answeredClarifications) ? plan.answeredClarifications : [];
  const clarifyQuestions = Array.isArray(plan.clarifyQuestions) ? plan.clarifyQuestions : [];
  const consensusRoles = (Array.isArray(plan.consensusPreview) ? plan.consensusPreview : []).map((item) => item.role);
  const approvalDecision = plan.approvalGatePreview?.currentDecision;
  return {
    phase: WORKFORCE_PLAN_ROLE_TIER_EVENT_LEDGER_PHASE,
    status: "preview-only",
    planState: plan.lifecyclePreview?.current || plan.planState?.lifecycleStatus || "saved",
    clarification: {
      answered: clarificationAnswers.length,
      total: clarifyQuestions.length,
    },
    consensus: {
      ready: ["Planner", "Architect", "Critic"].every((role) => consensusRoles.includes(role)),
      roles: consensusRoles,
    },
    reviewPackage: {
      status: plan.reviewPackagePreview?.status || "needs-human-review",
    },
    approvalGate: {
      status: approvalDecision || plan.approvalGatePreview?.status || "waiting-human-review",
      grantsExecution: false,
    },
    workflowHandoff: {
      status: "disabled",
      enabled: false,
    },
    omxHandoff: {
      status: "preview-only",
      executionEnabled: false,
    },
    execution: {
      status: "disabled",
      readiness: plan.executionReadinessPreflight?.overallStatus || "blocked",
      realAgents: false,
      hooks: false,
      workflowRun: false,
      worktrees: false,
      projectFileWrites: false,
    },
  };
}
