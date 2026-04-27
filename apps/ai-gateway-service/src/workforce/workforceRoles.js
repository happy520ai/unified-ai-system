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
