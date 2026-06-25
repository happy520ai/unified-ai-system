/**
 * @module roleExecutorsCeoPm
 * @description CEO and PM role executor functions.
 */

import { buildRoleMeta, estimateConfidence } from "./roleExecutorHelpers.js";

// ---------------------------------------------------------------------------
// CEO Executor
// ---------------------------------------------------------------------------

/**
 * Generate CEO-level strategic analysis.
 * @param {string} goal
 * @param {object} [context={}]
 * @returns {object}
 */
export function executeCEOAnalysis(goal, context = {}) {
  const confidence = estimateConfidence(context);

  const strategicObjectives = [
    { id: "SO-001", objective: `Deliver measurable business value aligned with: "${goal}"`, horizon: "quarterly", owner: "Executive Sponsor", successIndicator: "Revenue uplift or cost reduction directly attributable to initiative" },
    { id: "SO-002", objective: "Establish competitive differentiation through superior user experience", horizon: "bi-annual", owner: "VP Product", successIndicator: "Net Promoter Score improvement >= 10 points" },
    { id: "SO-003", objective: "Build scalable platform capabilities that reduce future time-to-market", horizon: "annual", owner: "CTO", successIndicator: "Subsequent feature delivery velocity increases by 30%" },
  ];

  const okrs = [
    {
      objective: "Validate product-market fit for the initiative",
      keyResults: [
        { kr: "KR-1", description: "Achieve 1,000 active beta users within 60 days of launch", target: 1000, unit: "users" },
        { kr: "KR-2", description: "Attain weekly retention rate >= 40% by end of quarter", target: 40, unit: "percent" },
        { kr: "KR-3", description: "Collect >= 200 qualitative feedback submissions from target personas", target: 200, unit: "submissions" },
      ],
    },
    {
      objective: "Operationalise the solution with enterprise-grade reliability",
      keyResults: [
        { kr: "KR-4", description: "Maintain platform uptime >= 99.95% during rollout period", target: 99.95, unit: "percent" },
        { kr: "KR-5", description: "Reduce MTTR to under 15 minutes for P1 incidents", target: 15, unit: "minutes" },
        { kr: "KR-6", description: "Complete security audit with zero critical findings", target: 0, unit: "critical_findings" },
      ],
    },
  ];

  const successMetrics = [
    { kpi: "Monthly Recurring Revenue Impact", baseline: "current MRR", target: "+5% within 90 days", frequency: "monthly" },
    { kpi: "Feature Adoption Rate", baseline: "0%", target: ">= 25% of active users within 30 days", frequency: "weekly" },
    { kpi: "System Latency (p95)", baseline: "current p95", target: "< 200ms for critical paths", frequency: "daily" },
    { kpi: "Defect Escape Rate", baseline: "current rate", target: "< 2% found in production", frequency: "per release" },
  ];

  const stakeholderAnalysis = [
    { stakeholder: "End Users", impact: "high", influence: "medium", strategy: "Beta program with continuous feedback loops" },
    { stakeholder: "Engineering Team", impact: "high", influence: "high", strategy: "Involve in design reviews and architecture decision records" },
    { stakeholder: "Executive Leadership", impact: "medium", influence: "high", strategy: "Bi-weekly dashboard and risk escalation channel" },
    { stakeholder: "Compliance & Legal", impact: "low", influence: "high", strategy: "Pre-launch compliance review gate and data privacy audit" },
  ];

  const decisionBoundaries = {
    riskAppetite: "moderate",
    description: "Accept calculated technical debt to accelerate time-to-market for validated learning, provided security and data integrity are not compromised.",
    budgetCeiling: context.constraints?.budget || "To be determined by finance",
    timelineConstraint: context.constraints?.deadline || "Target launch within current quarter",
    escalationThreshold: "Risk with probability > 60% AND impact > high escalated within 24 hours",
    tradeOffRules: [
      "Security and data privacy are non-negotiable.",
      "Prefer reversible decisions; irreversible ones require written ADR and two-party sign-off.",
      "Speed over perfection for internal tools; reliability over speed for customer-facing surfaces.",
    ],
  };

  const priorities = [
    { rank: 1, item: "Core user-facing functionality validating the primary hypothesis", rationale: "Without validated learning, subsequent investment is speculative" },
    { rank: 2, item: "Security hardening and compliance verification", rationale: "Regulatory and trust requirements gate any production release" },
    { rank: 3, item: "Performance and scalability baseline", rationale: "Early benchmarks prevent costly re-architecture" },
    { rank: 4, item: "Observability and monitoring infrastructure", rationale: "Operational visibility required before scaling user base" },
  ];

  return { roleMeta: buildRoleMeta("ceo", goal, confidence), strategicObjectives, okrs, successMetrics, stakeholderAnalysis, decisionBoundaries, priorities };
}

// ---------------------------------------------------------------------------
// PM Executor
// ---------------------------------------------------------------------------

/**
 * Generate PM-level product plan analysis.
 * @param {string} goal
 * @param {object} [context={}]
 * @returns {object}
 */
export function executePMAnalysis(goal, context = {}) {
  const confidence = estimateConfidence(context);

  const userStories = [
    {
      epic: "Core Workflow Enablement",
      stories: [
        {
          id: "US-001", title: "Configure primary workflow", asA: "power user",
          iWant: "to configure the primary workflow through a guided setup wizard",
          soThat: "I can start using the system without reading extensive documentation",
          acceptanceCriteria: [
            "Setup wizard completes in <= 5 steps",
            "Each step includes inline validation with clear error messages",
            "User can pause and resume the wizard within the same session",
          ],
          storyPoints: 8, priority: "critical",
        },
        {
          id: "US-002", title: "Monitor workflow status", asA: "team manager",
          iWant: "to see a real-time dashboard of all active workflows",
          soThat: "I can identify bottlenecks and reallocate resources proactively",
          acceptanceCriteria: [
            "Dashboard refreshes within 5 seconds of a state change",
            "Supports filtering by status, assignee, and date range",
            "Includes exportable summary report (CSV/PDF)",
          ],
          storyPoints: 5, priority: "high",
        },
        {
          id: "US-003", title: "Receive completion notifications", asA: "stakeholder",
          iWant: "to receive a notification when a tracked workflow completes",
          soThat: "I can take the next action without manually polling",
          acceptanceCriteria: [
            "Notification delivered within 30 seconds of completion",
            "Supports email and in-app channels",
            "User can configure preferences per workflow type",
          ],
          storyPoints: 3, priority: "medium",
        },
      ],
    },
    {
      epic: "Administration & Governance",
      stories: [
        {
          id: "US-004", title: "Manage team permissions", asA: "system administrator",
          iWant: "to assign role-based access controls to team members",
          soThat: "sensitive operations are restricted to authorised personnel",
          acceptanceCriteria: [
            "Supports at least 4 predefined roles (viewer, editor, admin, super-admin)",
            "Permission changes take effect within 60 seconds",
            "All changes are audit-logged with actor and timestamp",
          ],
          storyPoints: 5, priority: "high",
        },
      ],
    },
  ];

  const scopeDefinition = {
    inScope: [
      "Core workflow creation, execution, and monitoring",
      "Role-based access control with audit logging",
      "Real-time dashboard with filtering and export",
      "Email and in-app notification system",
      "RESTful API for programmatic access",
    ],
    outOfScope: [
      "Native mobile application (deferred to Phase 2)",
      "Third-party marketplace / plugin system",
      "On-premise deployment option",
      "Multi-language support beyond English",
    ],
    deferred: [
      "Advanced analytics and predictive insights",
      "Workflow templates library",
      "Offline mode with sync capabilities",
    ],
  };

  const milestones = [
    { id: "M1", name: "Foundation Sprint", week: "1-2", deliverables: ["Project scaffold", "Auth system", "DB schema v1"], dependencies: [] },
    { id: "M2", name: "Core Workflow MVP", week: "3-5", deliverables: ["Workflow CRUD", "Execution engine v1", "Basic dashboard"], dependencies: ["M1"] },
    { id: "M3", name: "Notification & Permissions", week: "6-7", deliverables: ["Notification service", "RBAC system", "Audit log"], dependencies: ["M2"] },
    { id: "M4", name: "Hardening & QA", week: "8-9", deliverables: ["Performance tuning", "Security audit", "E2E test suite"], dependencies: ["M3"] },
    { id: "M5", name: "Beta Launch", week: "10", deliverables: ["Beta deploy", "Onboarding flow", "Feedback collection"], dependencies: ["M4"] },
    { id: "M6", name: "General Availability", week: "12", deliverables: ["Production deploy", "Documentation", "Enablement training"], dependencies: ["M5"] },
  ];

  const userJourneys = [
    {
      journeyName: "First-Time Setup", persona: "New Power User",
      steps: [
        "User receives invitation email and clicks activation link",
        "User completes guided onboarding wizard (5 steps)",
        "System provisions default workspace with sample data",
        "User creates first workflow using template",
        "User invites team members and assigns roles",
      ],
    },
    {
      journeyName: "Daily Workflow Management", persona: "Team Manager",
      steps: [
        "Manager opens dashboard and reviews active workflows",
        "Manager filters by 'blocked' status to identify issues",
        "Manager reassigns a task from overloaded team member",
        "Manager exports weekly summary report for stakeholder meeting",
      ],
    },
  ];

  const priorityMatrix = [
    { feature: "Core workflow engine", impact: "very-high", effort: "high", quadrant: "strategic", priority: 1 },
    { feature: "Real-time dashboard", impact: "high", effort: "medium", quadrant: "high-value", priority: 2 },
    { feature: "RBAC system", impact: "high", effort: "medium", quadrant: "high-value", priority: 3 },
    { feature: "Notification service", impact: "medium", effort: "low", quadrant: "quick-win", priority: 4 },
    { feature: "API access", impact: "medium", effort: "medium", quadrant: "strategic", priority: 5 },
    { feature: "Plugin marketplace", impact: "high", effort: "very-high", quadrant: "big-bet", priority: 6 },
  ];

  const definitionOfDone = [
    { deliverable: "User Story", criteria: ["Code reviewed and merged", "Unit tests >= 80% coverage", "Acceptance criteria verified by QA", "Feature flagged for staged rollout"] },
    { deliverable: "Epic", criteria: ["All child stories complete", "Integration tests passing", "Performance benchmarks met", "Product owner sign-off"] },
    { deliverable: "Release", criteria: ["All epics complete", "Security scan clean", "Runbook documented", "Rollback tested", "Stakeholder demo done"] },
  ];

  return { roleMeta: buildRoleMeta("pm", goal, confidence), userStories, scopeDefinition, milestones, userJourneys, priorityMatrix, definitionOfDone };
}
