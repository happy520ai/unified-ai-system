/**
 * Product Templates for Agent Workforce Planner
 * Extracted from workforcePlanner.js for better maintainability.
 */

export const PRODUCT_TEMPLATE_PHASE = "phase-153a-agent-workforce-product-template-pack";

export const PRODUCT_TEMPLATES = [
  {
    id: "feature-development",
    name: "Feature Development",
    description: "Plan a new feature with roles, clarification, consensus, review package, and acceptance criteria.",
    defaultGoalPrompt: "Plan a new product feature safely.",
    recommendedRoleTiers: ["Strategy", "Architecture", "Implementation Planning", "Quality"],
    expectedOutputs: ["clarification questions", "role plan", "implementation plan preview", "review package", "acceptance checklist"],
    focusAreas: ["requirements clarification", "architecture impact", "frontend/backend split", "testing", "acceptance criteria"],
    sampleGoal: "Plan a customer-facing export settings feature with reviewable acceptance criteria.",
    samplePrompts: ["Plan a new dashboard filter feature for internal users.", "Plan a safe API settings feature with frontend and backend work split."],
    expectedPlanSections: ["Goal clarification", "Role tiers", "Implementation planning", "Review package", "Acceptance checklist"],
    sampleAcceptanceChecklist: ["Requirements and non-goals are clarified.", "Architecture impact is listed before implementation planning.", "Frontend and backend tasks are separated.", "Tests and user acceptance criteria are stated."],
    execution: "enabled",
  },
  {
    id: "bug-fix",
    name: "Bug Fix",
    description: "Plan a bug fix with reproduction, impact, root cause, repair plan, and regression checks.",
    defaultGoalPrompt: "Plan a safe bug fix.",
    recommendedRoleTiers: ["Strategy", "Architecture", "Implementation Planning", "Quality"],
    expectedOutputs: ["reproduction notes", "impact scope", "root-cause analysis preview", "fix plan", "regression checklist"],
    focusAreas: ["reproduction steps", "impact scope", "root cause", "fix approach", "regression testing"],
    sampleGoal: "Plan a safe fix for a broken Markdown export button in the web console.",
    samplePrompts: ["Plan a regression-safe fix for a login error message.", "Plan a fix for a saved-plan history item that fails to reload."],
    expectedPlanSections: ["Reproduction", "Impact scope", "Root-cause analysis", "Fix plan", "Regression checklist"],
    sampleAcceptanceChecklist: ["Reproduction steps are clear.", "Affected users and surfaces are listed.", "Root-cause hypotheses are separated from the fix plan.", "Regression checks cover the reported path and nearby paths."],
    execution: "enabled",
  },
  {
    id: "documentation",
    name: "Documentation",
    description: "Plan user docs, manuals, or API docs with structure, examples, and acceptance criteria.",
    defaultGoalPrompt: "Plan clear documentation for a user-facing workflow.",
    recommendedRoleTiers: ["Strategy", "Architecture", "Quality"],
    expectedOutputs: ["audience summary", "document outline", "examples", "review package", "acceptance checklist"],
    focusAreas: ["target audience", "document structure", "examples", "acceptance criteria"],
    sampleGoal: "Plan a user manual section for exporting Agent Workforce task packages.",
    samplePrompts: ["Plan API documentation for a read-only status endpoint.", "Plan a quick-start guide for a local preview console."],
    expectedPlanSections: ["Audience", "Outline", "Examples", "Review package", "Acceptance checklist"],
    sampleAcceptanceChecklist: ["Target readers and assumptions are named.", "Document outline is ordered for first-time users.", "Examples are concrete and copyable.", "Acceptance checks are understandable without developer context."],
    execution: "enabled",
  },
  {
    id: "code-review",
    name: "Code Review",
    description: "Plan a code review focused on risks, maintainability, safety, tests, and change boundaries.",
    defaultGoalPrompt: "Plan a focused code review.",
    recommendedRoleTiers: ["Architecture", "Implementation Planning", "Quality"],
    expectedOutputs: ["risk review", "maintainability notes", "security checklist", "test coverage review", "change boundary summary"],
    focusAreas: ["risk points", "maintainability", "security", "test coverage", "change boundaries"],
    sampleGoal: "Plan a code review for a UI export change without executing code.",
    samplePrompts: ["Plan a review of a small API contract change.", "Plan a review of a persistence-layer patch for saved plans."],
    expectedPlanSections: ["Risk review", "Maintainability", "Security", "Test coverage", "Change boundary"],
    sampleAcceptanceChecklist: ["Behavioral risks are listed first.", "Security and secret-safety checks are included.", "Missing or weak tests are called out.", "Review output stays within the requested change boundary."],
    execution: "enabled",
  },
  {
    id: "release-checklist",
    name: "Release Checklist",
    description: "Plan a pre-release checklist with verification, evidence, secrets safety, rollback, and boundaries.",
    defaultGoalPrompt: "Plan a release readiness checklist.",
    recommendedRoleTiers: ["Strategy", "Architecture", "Quality"],
    expectedOutputs: ["verification commands", "evidence index", "secret-safety checks", "rollback plan", "boundary statement"],
    focusAreas: ["verification commands", "evidence", "secret safety", "rollback plan", "boundary wording"],
    sampleGoal: "Plan a preview release checklist for Agent Workforce documentation updates.",
    samplePrompts: ["Plan a local release-readiness checklist for a UI-only preview.", "Plan a regression checklist before publishing a draft prerelease."],
    expectedPlanSections: ["Verification matrix", "Evidence index", "Secret safety", "Rollback plan", "Boundary statement"],
    sampleAcceptanceChecklist: ["Required verification commands are listed.", "Evidence files and expected statuses are named.", "Secret-safety and redaction boundaries are explicit.", "Rollback or stop condition is described."],
    execution: "enabled",
  },
  {
    id: "research-design-study",
    name: "Research / Design Study",
    description: "Plan a design study with goals, options, comparison criteria, risks, and a recommendation.",
    defaultGoalPrompt: "Plan a research or technical design study.",
    recommendedRoleTiers: ["Strategy", "Architecture", "Quality"],
    expectedOutputs: ["study goal", "candidate options", "comparison matrix", "risk list", "recommendation"],
    focusAreas: ["goal", "candidate solutions", "comparison dimensions", "risks", "recommended conclusion"],
    sampleGoal: "Plan a design study comparing two safe export package formats.",
    samplePrompts: ["Plan a design study for an external runner protocol without execution.", "Plan a technical selection study for a local-only evidence format."],
    expectedPlanSections: ["Study goal", "Candidate options", "Comparison criteria", "Risk list", "Recommendation"],
    sampleAcceptanceChecklist: ["Study goal and decision boundary are clear.", "Candidate options are compared on the same dimensions.", "Risks and unknowns are visible.", "Recommendation is stated with a reason and non-goals."],
    execution: "enabled",
  },
];

export function getTemplateById(templateId) {
  return PRODUCT_TEMPLATES.find((t) => t.id === templateId) || null;
}

export function listTemplates() {
  return PRODUCT_TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description }));
}







