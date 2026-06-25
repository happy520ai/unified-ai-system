import { WORKFORCE_ROLES, ROLE_TIERS, ROLE_COLLABORATION_MAP } from "./workforceRoles.js";

// ---------------------------------------------------------------------------
// Phase identifier
// ---------------------------------------------------------------------------

export const COLLABORATION_PHASE = "phase-102c-role-collaboration-protocols";

// ---------------------------------------------------------------------------
// Internal helpers - derive tier and lookup structures
// ---------------------------------------------------------------------------

/** @type {Map<string, object>} */
export const ROLE_BY_ID = new Map(WORKFORCE_ROLES.map((r) => [r.roleId, r]));

/**
 * Tier assignment for each role, derived from the workforce planner's
 * role-tier structure (strategy / architecture / implementation-planning / quality).
 */
export const TIER_BY_ROLE = {
  ceo: "strategy",
  pm: "strategy",
  architect: "architecture",
  "frontend-engineer": "implementation-planning",
  "backend-engineer": "implementation-planning",
  qa: "quality",
  reviewer: "quality",
};

// ---------------------------------------------------------------------------
// DEPENDENCY_GRAPH
// Directed acyclic graph describing execution order and parallel potential.
// CEO -> PM -> Architect -> [Frontend Engineer, Backend Engineer] -> QA -> Reviewer
// ---------------------------------------------------------------------------

export const DEPENDENCY_GRAPH = [
  {
    roleId: "ceo",
    dependsOn: [],
    canRunParallelWith: [],
    tier: "strategy",
    estimatedEffort: "low",
  },
  {
    roleId: "pm",
    dependsOn: ["ceo"],
    canRunParallelWith: [],
    tier: "strategy",
    estimatedEffort: "medium",
  },
  {
    roleId: "architect",
    dependsOn: ["pm"],
    canRunParallelWith: [],
    tier: "architecture",
    estimatedEffort: "high",
  },
  {
    roleId: "frontend-engineer",
    dependsOn: ["architect"],
    canRunParallelWith: ["backend-engineer"],
    tier: "implementation-planning",
    estimatedEffort: "high",
  },
  {
    roleId: "backend-engineer",
    dependsOn: ["architect"],
    canRunParallelWith: ["frontend-engineer"],
    tier: "implementation-planning",
    estimatedEffort: "high",
  },
  {
    roleId: "qa",
    dependsOn: ["frontend-engineer", "backend-engineer"],
    canRunParallelWith: [],
    tier: "quality",
    estimatedEffort: "medium",
  },
  {
    roleId: "reviewer",
    dependsOn: ["qa"],
    canRunParallelWith: [],
    tier: "quality",
    estimatedEffort: "low",
  },
];

// ---------------------------------------------------------------------------
// HANDOFF_PROTOCOLS
// Defines what each role passes to the next role in the chain.
// ---------------------------------------------------------------------------

export const HANDOFF_PROTOCOLS = {
  "ceo-to-pm": {
    from: "ceo",
    to: "pm",
    handoffType: "strategic",
    requiredFields: [
      "goalStatement",
      "successDefinition",
      "decisionBoundary",
      "stakeholderContext",
    ],
    optionalFields: [
      "marketConstraints",
      "priorityRanking",
      "budgetIndication",
      "riskAppetite",
    ],
    validationRules: {
      goalStatement: { type: "string", minLength: 10, maxLength: 1000 },
      successDefinition: { type: "string", minLength: 5 },
      decisionBoundary: { type: "array", minItems: 1 },
      stakeholderContext: { type: "string", minLength: 3 },
    },
    template: {
      goalStatement: "Deliver a reviewable implementation plan for <goal>",
      successDefinition: "All seven role outputs are consistent and pass acceptance criteria",
      decisionBoundary: ["scope is bounded", "no uncontrolled side effects"],
      stakeholderContext: "Product team and engineering leads",
      priorityRanking: "high",
    },
  },

  "pm-to-architect": {
    from: "pm",
    to: "architect",
    handoffType: "strategic",
    requiredFields: [
      "productScope",
      "userJourneys",
      "milestones",
      "acceptanceFraming",
      "nonGoals",
    ],
    optionalFields: [
      "targetPlatform",
      "userPersonas",
      "releaseWindow",
      "rollbackExpectation",
    ],
    validationRules: {
      productScope: { type: "object", requiredKeys: ["inScope", "outOfScope"] },
      userJourneys: { type: "array", minItems: 1 },
      milestones: { type: "array", minItems: 1 },
      acceptanceFraming: { type: "string", minLength: 5 },
      nonGoals: { type: "array", minItems: 1 },
    },
    template: {
      productScope: {
        inScope: ["API gateway routing", "provider abstraction"],
        outOfScope: ["legacy migration", "database schema changes"],
      },
      userJourneys: [
        { id: "uj-1", name: "Developer configures AI provider", steps: ["login", "navigate to settings", "add provider key"] },
      ],
      milestones: [
        { id: "ms-1", name: "Architecture approved", targetDate: "2026-06-15" },
      ],
      acceptanceFraming: "Feature is accepted when all role outputs pass their validation checks",
      nonGoals: ["Rewriting the authentication layer", "Changing the default chat lane"],
    },
  },

  "architect-to-frontend-engineer": {
    from: "architect",
    to: "frontend-engineer",
    handoffType: "technical",
    requiredFields: [
      "insertionPoint",
      "apiContracts",
      "dataFlowDiagram",
      "componentBoundaries",
      "errorHandlingStrategy",
    ],
    optionalFields: [
      "uiFrameworkPreference",
      "accessibilityRequirements",
      "performanceBudget",
      "designTokens",
    ],
    validationRules: {
      insertionPoint: { type: "object", requiredKeys: ["module", "path"] },
      apiContracts: { type: "array", minItems: 1 },
      dataFlowDiagram: { type: "object", requiredKeys: ["nodes", "edges"] },
      componentBoundaries: { type: "array", minItems: 1 },
      errorHandlingStrategy: { type: "string", minLength: 5 },
    },
    template: {
      insertionPoint: {
        module: "ai-gateway-service",
        path: "src/ui/workforcePanel.js",
      },
      apiContracts: [
        { method: "GET", path: "/api/workforce/plan", responseShape: "{ plan: object }" },
      ],
      dataFlowDiagram: {
        nodes: ["client", "gateway", "service"],
        edges: [{ from: "client", to: "gateway", label: "REST" }],
      },
      componentBoundaries: [
        { component: "WorkforcePanel", responsibility: "Display plan preview" },
      ],
      errorHandlingStrategy: "Surface API errors inline with retry affordance",
    },
  },

  "architect-to-backend-engineer": {
    from: "architect",
    to: "backend-engineer",
    handoffType: "technical",
    requiredFields: [
      "insertionPoint",
      "apiContracts",
      "serviceBoundaries",
      "dataModels",
      "persistenceBoundary",
      "rollbackStrategy",
    ],
    optionalFields: [
      "scalingConsiderations",
      "cachingStrategy",
      "rateLimitingPolicy",
      "observabilityHooks",
    ],
    validationRules: {
      insertionPoint: { type: "object", requiredKeys: ["module", "path"] },
      apiContracts: { type: "array", minItems: 1 },
      serviceBoundaries: { type: "array", minItems: 1 },
      dataModels: { type: "array", minItems: 1 },
      persistenceBoundary: { type: "string", minLength: 5 },
      rollbackStrategy: { type: "string", minLength: 5 },
    },
    template: {
      insertionPoint: {
        module: "ai-gateway-service",
        path: "src/workforce/workforceService.js",
      },
      apiContracts: [
        { method: "POST", path: "/api/workforce/plan", bodyShape: "{ goal: string }", responseShape: "{ plan: object }" },
      ],
      serviceBoundaries: [
        { service: "WorkforceService", responsibility: "Orchestrate plan creation" },
      ],
      dataModels: [
        { name: "WorkforcePlan", fields: ["id", "goal", "roles", "status"] },
      ],
      persistenceBoundary: "In-memory store with optional file-backed export",
      rollbackStrategy: "Stateless service; rollback by discarding plan and regenerating",
    },
  },

  "frontend-engineer-to-qa": {
    from: "frontend-engineer",
    to: "qa",
    handoffType: "verification",
    requiredFields: [
      "implementedComponents",
      "userInteractionFlows",
      "errorStates",
      "testabilityNotes",
      "screenshotTargets",
    ],
    optionalFields: [
      "accessibilityAuditResults",
      "performanceMetrics",
      "browserCompatibilityNotes",
    ],
    validationRules: {
      implementedComponents: { type: "array", minItems: 1 },
      userInteractionFlows: { type: "array", minItems: 1 },
      errorStates: { type: "array", minItems: 1 },
      testabilityNotes: { type: "string", minLength: 5 },
      screenshotTargets: { type: "array", minItems: 1 },
    },
    template: {
      implementedComponents: [
        { name: "WorkforcePanel", testId: "workforce-panel" },
      ],
      userInteractionFlows: [
        { flow: "submit-goal", steps: ["type goal", "click submit", "view plan"] },
      ],
      errorStates: [
        { trigger: "empty goal", expectedMessage: "Please provide an AI goal" },
      ],
      testabilityNotes: "All interactive elements have data-testid attributes",
      screenshotTargets: ["plan-preview-section", "role-tier-panel"],
    },
  },

  "backend-engineer-to-qa": {
    from: "backend-engineer",
    to: "qa",
    handoffType: "verification",
    requiredFields: [
      "apiEndpoints",
      "serviceMethods",
      "validationRules",
      "integrationPoints",
      "testFixtures",
    ],
    optionalFields: [
      "databaseMigrationNotes",
      "environmentVariables",
      "rateLimitConfiguration",
    ],
    validationRules: {
      apiEndpoints: { type: "array", minItems: 1 },
      serviceMethods: { type: "array", minItems: 1 },
      validationRules: { type: "object" },
      integrationPoints: { type: "array", minItems: 1 },
      testFixtures: { type: "array", minItems: 1 },
    },
    template: {
      apiEndpoints: [
        { method: "POST", path: "/api/workforce/plan", statusCode: 200 },
      ],
      serviceMethods: [
        { name: "createWorkforcePlan", inputType: "object", outputType: "object" },
      ],
      validationRules: {
        goal: { type: "string", required: true, maxLength: 1000 },
      },
      integrationPoints: [
        { name: "workforceRoles", contract: "listWorkforceRoles()" },
      ],
      testFixtures: [
        { name: "validGoal", value: { goal: "Build a user authentication module" } },
      ],
    },
  },

  "qa-to-reviewer": {
    from: "qa",
    to: "reviewer",
    handoffType: "review",
    requiredFields: [
      "testResults",
      "coverageReport",
      "regressionStatus",
      "evidenceArtifacts",
      "knownIssues",
    ],
    optionalFields: [
      "performanceBaseline",
      "flakyTestAnalysis",
      "manualTestNotes",
    ],
    validationRules: {
      testResults: { type: "object", requiredKeys: ["passed", "failed", "skipped"] },
      coverageReport: { type: "object", requiredKeys: ["lineCoverage", "branchCoverage"] },
      regressionStatus: { type: "string", allowedValues: ["clean", "regressions-found", "partial"] },
      evidenceArtifacts: { type: "array", minItems: 1 },
      knownIssues: { type: "array" },
    },
    template: {
      testResults: { passed: 42, failed: 0, skipped: 2 },
      coverageReport: { lineCoverage: 87.3, branchCoverage: 81.5 },
      regressionStatus: "clean",
      evidenceArtifacts: [
        { type: "test-output", path: "evidence/test-run-2026-06-09.json" },
      ],
      knownIssues: [],
    },
  },
};

// ---------------------------------------------------------------------------
// COLLABORATION_WORKFLOWS
// Predefined workflow patterns for common development scenarios.
// ---------------------------------------------------------------------------

export const COLLABORATION_WORKFLOWS = {
  "full-development": {
    id: "full-development",
    name: "Full Development Pipeline",
    description:
      "End-to-end development workflow from strategic goal clarification through implementation, testing, and risk review. Suitable for new features or major changes.",
    roleSequence: ["ceo", "pm", "architect", "frontend-engineer", "backend-engineer", "qa", "reviewer"],
    parallelGroups: [
      { group: "implementation", roles: ["frontend-engineer", "backend-engineer"] },
    ],
    estimatedDuration: "4-6 hours",
  },

  "bug-fix": {
    id: "bug-fix",
    name: "Bug Fix Workflow",
    description:
      "Shortened workflow for targeted bug fixes. Skips strategic roles and starts from architectural analysis of the defect.",
    roleSequence: ["architect", "backend-engineer", "qa", "reviewer"],
    parallelGroups: [],
    estimatedDuration: "1-2 hours",
  },

  "documentation": {
    id: "documentation",
    name: "Documentation Workflow",
    description:
      "Documentation-focused workflow that moves from product planning through QA verification and risk review. Optimized for doc-heavy deliverables.",
    roleSequence: ["pm", "qa", "reviewer"],
    parallelGroups: [],
    estimatedDuration: "1-2 hours",
  },

  "code-review": {
    id: "code-review",
    name: "Code Review Workflow",
    description:
      "Architecture-led review workflow. The architect examines the code structure and hands off directly to the reviewer for risk assessment.",
    roleSequence: ["architect", "reviewer"],
    parallelGroups: [],
    estimatedDuration: "30-60 minutes",
  },

  "quick-assessment": {
    id: "quick-assessment",
    name: "Quick Strategic Assessment",
    description:
      "Fastest workflow path. The CEO frames the strategic context and the reviewer performs a rapid risk assessment. Useful for feasibility checks.",
    roleSequence: ["ceo", "reviewer"],
    parallelGroups: [],
    estimatedDuration: "15-30 minutes",
  },
};

// ---------------------------------------------------------------------------
// Shared internal helpers (used by both plan and report modules)
// ---------------------------------------------------------------------------

/**
 * Infer a handoff type when no explicit protocol exists.
 * @param {string} fromRoleId
 * @param {string} toRoleId
 * @returns {string}
 */
export function inferHandoffType(fromRoleId, toRoleId) {
  const fromTier = TIER_BY_ROLE[fromRoleId] ?? "unknown";
  const toTier = TIER_BY_ROLE[toRoleId] ?? "unknown";

  if (fromTier === "strategy" && toTier === "strategy") return "strategic";
  if (fromTier === "strategy" && toTier === "architecture") return "strategic";
  if (fromTier === "architecture" && toTier === "implementation-planning") return "technical";
  if (fromTier === "implementation-planning" && toTier === "quality") return "verification";
  if (toTier === "quality" && toRoleId === "reviewer") return "review";
  return "strategic";
}

/**
 * Extract an array from an object, trying multiple possible keys.
 * @param {object|null|undefined} obj
 * @param {...string} keys
 * @returns {Array}
 */
export function extractArray(obj, ...keys) {
  if (!obj || typeof obj !== "object") return [];
  for (const key of keys) {
    if (Array.isArray(obj[key])) return obj[key];
  }
  return [];
}
