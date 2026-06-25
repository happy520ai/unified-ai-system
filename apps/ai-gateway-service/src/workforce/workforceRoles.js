export const WORKFORCE_PHASE = "phase-102a-agent-workforce-skeleton";

export const WORKFORCE_ROLES = [
  {
    roleId: "ceo",
    name: "CEO",
    title: "Goal Clarification",
    responsibility: "Clarify the business goal, success definition, and decision boundary before work starts.",
  },
  {
    roleId: "pm",
    name: "PM",
    title: "Product Plan",
    responsibility: "Turn the goal into a user-facing scope, milestones, and acceptance framing.",
  },
  {
    roleId: "architect",
    name: "Architect",
    title: "Architecture Design",
    responsibility: "Define the safest system insertion point, contracts, data flow, and rollback boundary.",
  },
  {
    roleId: "frontend-engineer",
    name: "Frontend Engineer",
    title: "Frontend Tasks",
    responsibility: "Plan the visible interaction surface, states, error messages, and usability checks.",
  },
  {
    roleId: "backend-engineer",
    name: "Backend Engineer",
    title: "Backend Tasks",
    responsibility: "Plan APIs, services, validation, persistence boundary, and integration checks.",
  },
  {
    roleId: "qa",
    name: "QA",
    title: "Test Acceptance",
    responsibility: "Plan deterministic verification, regression coverage, and evidence requirements.",
  },
  {
    roleId: "reviewer",
    name: "Reviewer",
    title: "Risk Review",
    responsibility: "Identify safety risks, non-goals, abuse paths, and release blockers.",
  },
];

export function listWorkforceRoles() {
  return WORKFORCE_ROLES.map((role) => ({ ...role }));
}

export function getRoleById(roleId) {
  const id = String(roleId || "").trim().toLowerCase();
  return WORKFORCE_ROLES.find((r) => String(r.roleId).toLowerCase() === id) || null;
}

export function getRoleCapabilities(roleId) {
  const role = getRoleById(roleId);
  if (!role) return [];
  // Map each role to a concise capability string list used to enrich LLM prompts.
  const CAPABILITY_MAP = {
    ceo: ["goal_clarification", "stakeholder_analysis", "okr_definition", "decision_boundary"],
    pm: ["scope_definition", "milestone_planning", "acceptance_criteria", "user_value"],
    architect: ["system_design", "integration_points", "data_flow", "rollback_boundary"],
    "frontend-engineer": ["ui_surface", "state_management", "error_handling", "usability"],
    "backend-engineer": ["api_design", "service_implementation", "validation", "persistence"],
    qa: ["test_strategy", "regression_coverage", "acceptance_verification", "evidence_capture"],
    reviewer: ["risk_assessment", "safety_review", "abuse_path_analysis", "release_blockers"],
  };
  return CAPABILITY_MAP[role.roleId] || [];
}







