import { createClarificationAnswers } from "./workforcePlanner-core.js";

export function createConsensusPreview(goal) {
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

export function createHookEventsPreview() {
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

export function createEventLedgerPreview({ createdAt, workforceId, goal }) {
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

export function createLifecyclePreview(clarificationAnswers = []) {
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

export function createPlanState({ clarificationAnswers = [] } = {}) {
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

export function createReviewPackagePreview(plan) {
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

export function createApprovalGatePreview(plan) {
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

export function createOmxHandoffPreview({ goal, workforceId }) {
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

export function createWorkforceHudPreview({
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

