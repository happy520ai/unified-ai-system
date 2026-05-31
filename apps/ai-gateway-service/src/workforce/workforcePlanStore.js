import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";

export const WORKFORCE_PLAN_STORE_PHASE = "phase-102d-agent-workforce-plan-store";
export const WORKFORCE_PLAN_STORE_MODE = "dev-only-local-plan-store";
export const WORKFORCE_PLAN_LIFECYCLE_PHASE = "phase-140a-workforce-clarification-lifecycle";
export const WORKFORCE_PLAN_REVIEW_APPROVAL_PHASE = "phase-141a-workforce-review-approval-gate";
export const WORKFORCE_PLAN_ROLE_TIER_EVENT_LEDGER_PHASE = "phase-143a-role-tier-event-ledger";
export const WORKFORCE_PLAN_EXECUTION_READINESS_PREFLIGHT_PHASE = "phase-144a-execution-readiness-preflight";
export const WORKFORCE_PLAN_EXTERNAL_OMX_RUNNER_DESIGN_PHASE = "phase-145a-external-omx-runner-design";
export const WORKFORCE_PLAN_RUNNER_REQUEST_QUEUE_PHASE = "phase-146a-runner-request-review-queue";
export const WORKFORCE_PLAN_EXECUTION_APPROVAL_RECORD_PHASE = "phase-147a-execution-approval-record";
export const WORKFORCE_PLAN_EXTERNAL_RUNNER_PROTOCOL_FREEZE_PHASE = "phase-148a-external-runner-protocol-freeze";
export const WORKFORCE_PLAN_FINAL_UX_SEAL_PHASE = "phase-149a-agent-workforce-preview-final-ux-seal";
export const WORKFORCE_PLAN_PRODUCT_TEMPLATE_PACK_PHASE = "phase-153a-agent-workforce-product-template-pack";
export const WORKFORCE_PLAN_HANDOFF_PACKAGE_MANIFEST_PHASE = "phase-167a-export-handoff-package-manifest";
export const WORKFORCE_PLAN_CODEX_DESKTOP_HANDOFF_PACK_PHASE = "phase-201a-codex-desktop-handoff-pack";
export const WORKFORCE_PLAN_MANUAL_CODEX_EXECUTION_LOOP_PHASE = "phase-202a-manual-codex-execution-loop";
export const WORKFORCE_PLAN_CODEX_RESULT_REVIEW_PHASE = "phase-203a-codex-result-import-review";
export const WORKFORCE_PLAN_SAFE_DESKTOP_RUNNER_DESIGN_PHASE = "phase-204a-safe-desktop-runner-design";

const STORE_VERSION = 1;
const DEFAULT_STORE_PATH = resolve(tmpdir(), "unified-ai-system", "workforce-plans.json");

export function createWorkforcePlanStore({ env = process.env } = {}) {
  const storePath = resolve(env.WORKFORCE_PLAN_STORE_PATH || DEFAULT_STORE_PATH);

  return {
    getInfo() {
      return {
        phase: WORKFORCE_PLAN_STORE_PHASE,
        mode: WORKFORCE_PLAN_STORE_MODE,
        storage: "local-json-file",
        storageScope: env.WORKFORCE_PLAN_STORE_PATH ? "configured-dev-path" : "system-temp",
        projectFileWrites: false,
        secretValuesStored: false,
      };
    },
    async save(plan) {
      const normalizedPlan = normalizePlan(plan);
      const savedAt = new Date().toISOString();
      const planId = createPlanId(normalizedPlan, savedAt);
      const taskPackage = createTaskPackage({ plan: normalizedPlan, planId, savedAt });
      const store = await readStore(storePath);
      const plans = store.plans.filter((item) => item.planId !== planId);
      plans.unshift(taskPackage);
      await writeStore(storePath, {
        version: STORE_VERSION,
        updatedAt: savedAt,
        plans,
      });

      return {
        success: true,
        phase: WORKFORCE_PLAN_STORE_PHASE,
        status: "saved",
        mode: WORKFORCE_PLAN_STORE_MODE,
        planId,
        savedAt,
        taskPackage,
        safety: createStoreSafety(),
      };
    },
    async list() {
      const store = await readStore(storePath);
      return {
        success: true,
        phase: WORKFORCE_PLAN_STORE_PHASE,
        status: "listed",
        mode: WORKFORCE_PLAN_STORE_MODE,
        count: store.plans.length,
        plans: store.plans.map(toPlanSummary),
        safety: createStoreSafety(),
      };
    },
    async get(planId) {
      const store = await readStore(storePath);
      const normalizedPlanId = normalizePlanId(planId);
      const taskPackage = store.plans.find((item) => item.planId === normalizedPlanId);
      if (!taskPackage) {
        throw createStoreError("WORKFORCE_PLAN_NOT_FOUND", "Saved workforce plan was not found.", {
          userMessage: "???????????????????",
          planId: normalizedPlanId,
        });
      }

      return {
        success: true,
        phase: WORKFORCE_PLAN_STORE_PHASE,
        status: "found",
        mode: WORKFORCE_PLAN_STORE_MODE,
        planId: normalizedPlanId,
        taskPackage,
        plan: taskPackage.exportableJson,
        safety: createStoreSafety(),
      };
    },
    async delete(planId) {
      const store = await readStore(storePath);
      const normalizedPlanId = normalizePlanId(planId);
      const beforeCount = store.plans.length;
      const plans = store.plans.filter((item) => item.planId !== normalizedPlanId);
      if (plans.length === beforeCount) {
        throw createStoreError("WORKFORCE_PLAN_NOT_FOUND", "Saved workforce plan was not found.", {
          userMessage: "???????????????????",
          planId: normalizedPlanId,
        });
      }

      await writeStore(storePath, {
        version: STORE_VERSION,
        updatedAt: new Date().toISOString(),
        plans,
      });

      return {
        success: true,
        phase: WORKFORCE_PLAN_STORE_PHASE,
        status: "deleted",
        mode: WORKFORCE_PLAN_STORE_MODE,
        planId: normalizedPlanId,
        deleted: true,
        remainingCount: plans.length,
        safety: createStoreSafety(),
      };
    },
    async export(planId) {
      const result = await this.get(planId);
      const exportedAt = new Date().toISOString();
      const taskPackage = redactSecrets({
        ...result.taskPackage,
        planState: updatePlanStateCurrent(result.taskPackage.planState, "exported"),
        lifecyclePreview: createUpdatedLifecycle(
          result.taskPackage.lifecyclePreview,
          "exported",
          "Task package prepared for export preview.",
          exportedAt,
        ),
      });
      taskPackage.eventLedgerPreview = appendEventLedgerEvent(
        taskPackage.eventLedgerPreview,
        "workforce.plan.beforeExport",
        exportedAt,
        `Export preview prepared for plan ${taskPackage.planId}.`,
      );
      taskPackage.executionReadinessPreflight = normalizeExecutionReadinessPreflight(taskPackage.executionReadinessPreflight);
      taskPackage.externalOmxRunnerDesign = normalizeExternalOmxRunnerDesign(taskPackage.externalOmxRunnerDesign);
      taskPackage.runnerRequestQueuePreview = normalizeRunnerRequestQueuePreview(taskPackage.runnerRequestQueuePreview);
      taskPackage.executionApprovalRecordPreview = normalizeExecutionApprovalRecordPreview(taskPackage.executionApprovalRecordPreview);
      taskPackage.externalRunnerProtocolFreeze = normalizeExternalRunnerProtocolFreeze(taskPackage.externalRunnerProtocolFreeze);
      taskPackage.agentWorkforcePreviewFinalUxSeal = normalizeAgentWorkforcePreviewFinalUxSeal(taskPackage.agentWorkforcePreviewFinalUxSeal);
      taskPackage.codexDesktopHandoffPack = normalizeCodexDesktopHandoffPack(taskPackage.codexDesktopHandoffPack ?? taskPackage.exportableJson?.codexDesktopHandoffPack, taskPackage);
      taskPackage.manualCodexExecutionLoop = normalizeManualCodexExecutionLoop(taskPackage.manualCodexExecutionLoop ?? taskPackage.exportableJson?.manualCodexExecutionLoop);
      taskPackage.codexResultReviewPreview = normalizeCodexResultReviewPreview(taskPackage.codexResultReviewPreview ?? taskPackage.exportableJson?.codexResultReviewPreview);
      taskPackage.safeDesktopRunnerDesign = normalizeSafeDesktopRunnerDesign(taskPackage.safeDesktopRunnerDesign ?? taskPackage.exportableJson?.safeDesktopRunnerDesign);
      taskPackage.selectedTemplate = redactSecrets(taskPackage.selectedTemplate ?? taskPackage.exportableJson?.selectedTemplate ?? null);
      taskPackage.templateContext = normalizeTemplateContext(taskPackage.templateContext ?? taskPackage.exportableJson?.templateContext, taskPackage.selectedTemplate);
      taskPackage.productTemplatesPreview = normalizeProductTemplatesPreview(
        taskPackage.productTemplatesPreview ?? taskPackage.exportableJson?.productTemplatesPreview,
        taskPackage.selectedTemplate,
      );
      taskPackage.handoffPackageManifest = normalizeHandoffPackageManifest(taskPackage.handoffPackageManifest ?? taskPackage.exportableJson?.handoffPackageManifest, taskPackage);
      taskPackage.workforceHudPreview = createPackageHudPreview(taskPackage);
      taskPackage.exportableJson = redactSecrets({
        ...(taskPackage.exportableJson || {}),
        selectedTemplate: taskPackage.selectedTemplate,
        templateContext: taskPackage.templateContext,
        productTemplatesPreview: taskPackage.productTemplatesPreview,
        handoffPackageManifest: taskPackage.handoffPackageManifest,
        planState: taskPackage.planState,
        lifecyclePreview: taskPackage.lifecyclePreview,
        eventLedgerPreview: taskPackage.eventLedgerPreview,
        executionReadinessPreflight: taskPackage.executionReadinessPreflight,
        externalOmxRunnerDesign: taskPackage.externalOmxRunnerDesign,
        runnerRequestQueuePreview: taskPackage.runnerRequestQueuePreview,
        executionApprovalRecordPreview: taskPackage.executionApprovalRecordPreview,
        externalRunnerProtocolFreeze: taskPackage.externalRunnerProtocolFreeze,
        agentWorkforcePreviewFinalUxSeal: taskPackage.agentWorkforcePreviewFinalUxSeal,
        codexDesktopHandoffPack: taskPackage.codexDesktopHandoffPack,
        manualCodexExecutionLoop: taskPackage.manualCodexExecutionLoop,
        codexResultReviewPreview: taskPackage.codexResultReviewPreview,
        safeDesktopRunnerDesign: taskPackage.safeDesktopRunnerDesign,
        workforceHudPreview: taskPackage.workforceHudPreview,
      });
      refreshReviewAndApprovalPreviews(taskPackage, exportedAt);
      taskPackage.markdown = formatTaskPackageMarkdown({ plan: taskPackage, planId: taskPackage.planId, savedAt: taskPackage.savedAt });
      return {
        success: true,
        phase: WORKFORCE_PLAN_STORE_PHASE,
        status: "export_ready",
        mode: WORKFORCE_PLAN_STORE_MODE,
        planId: result.planId,
        formats: ["json", "markdown"],
        taskPackage,
        json: taskPackage,
        markdown: taskPackage.markdown,
        safety: createStoreSafety(),
      };
    },
    async answerClarifications(planId, answers = []) {
      const normalizedPlanId = normalizePlanId(planId);
      const normalizedAnswers = normalizeClarificationAnswers(answers);
      const updatedAt = new Date().toISOString();
      const store = await readStore(storePath);
      const index = store.plans.findIndex((item) => item.planId === normalizedPlanId);
      if (index < 0) {
        throw createStoreError("WORKFORCE_PLAN_NOT_FOUND", "Saved workforce plan was not found.", {
          userMessage: "Saved workforce plan was not found.",
          planId: normalizedPlanId,
        });
      }

      const taskPackage = applyClarificationAnswers(store.plans[index], normalizedAnswers, updatedAt);
      store.plans[index] = taskPackage;
      await writeStore(storePath, {
        version: STORE_VERSION,
        updatedAt,
        plans: store.plans,
      });

      return {
        success: true,
        phase: WORKFORCE_PLAN_LIFECYCLE_PHASE,
        status: "clarification_answers_saved",
        mode: WORKFORCE_PLAN_STORE_MODE,
        planId: normalizedPlanId,
        answeredCount: normalizedAnswers.length,
        taskPackage,
        lifecycle: taskPackage.lifecyclePreview,
        safety: createStoreSafety(),
      };
    },
    async updateLifecycle(planId, input = {}) {
      const normalizedPlanId = normalizePlanId(planId);
      const nextState = normalizeLifecycleState(input.state);
      const updatedAt = new Date().toISOString();
      const store = await readStore(storePath);
      const index = store.plans.findIndex((item) => item.planId === normalizedPlanId);
      if (index < 0) {
        throw createStoreError("WORKFORCE_PLAN_NOT_FOUND", "Saved workforce plan was not found.", {
          userMessage: "Saved workforce plan was not found.",
          planId: normalizedPlanId,
        });
      }

      const taskPackage = applyLifecycleState(store.plans[index], nextState, input.note, updatedAt);
      store.plans[index] = taskPackage;
      await writeStore(storePath, {
        version: STORE_VERSION,
        updatedAt,
        plans: store.plans,
      });

      return {
        success: true,
        phase: WORKFORCE_PLAN_LIFECYCLE_PHASE,
        status: "lifecycle_saved",
        mode: WORKFORCE_PLAN_STORE_MODE,
        planId: normalizedPlanId,
        lifecycle: taskPackage.lifecyclePreview,
        taskPackage,
        safety: createStoreSafety(),
      };
    },
    async getReviewPackage(planId) {
      const result = await this.get(planId);
      const taskPackage = refreshReviewAndApprovalPreviews(result.taskPackage, new Date().toISOString());
      return {
        success: true,
        phase: WORKFORCE_PLAN_REVIEW_APPROVAL_PHASE,
        status: "review_package_ready",
        mode: WORKFORCE_PLAN_STORE_MODE,
        planId: result.planId,
        reviewPackagePreview: taskPackage.reviewPackagePreview,
        approvalGatePreview: taskPackage.approvalGatePreview,
        taskPackage,
        safety: createStoreSafety(),
      };
    },
    async recordApprovalGate(planId, input = {}) {
      const normalizedPlanId = normalizePlanId(planId);
      const updatedAt = new Date().toISOString();
      const store = await readStore(storePath);
      const index = store.plans.findIndex((item) => item.planId === normalizedPlanId);
      if (index < 0) {
        throw createStoreError("WORKFORCE_PLAN_NOT_FOUND", "Saved workforce plan was not found.", {
          userMessage: "Saved workforce plan was not found.",
          planId: normalizedPlanId,
        });
      }

      const taskPackage = applyApprovalGateDecision(store.plans[index], input, updatedAt);
      store.plans[index] = taskPackage;
      await writeStore(storePath, {
        version: STORE_VERSION,
        updatedAt,
        plans: store.plans,
      });

      return {
        success: true,
        phase: WORKFORCE_PLAN_REVIEW_APPROVAL_PHASE,
        status: "approval_gate_recorded",
        mode: WORKFORCE_PLAN_STORE_MODE,
        planId: normalizedPlanId,
        decision: taskPackage.approvalGatePreview?.currentDecision ?? null,
        reviewPackagePreview: taskPackage.reviewPackagePreview,
        approvalGatePreview: taskPackage.approvalGatePreview,
        taskPackage,
        safety: createStoreSafety(),
      };
    },
  };
}

function normalizePlan(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    throw createStoreError("WORKFORCE_PLAN_REQUIRED", "Workforce plan is required.", {
      userMessage: "?????? AI ?????????",
    });
  }

  const goal = typeof plan.goal === "string" ? plan.goal.trim() : "";
  if (!goal) {
    throw createStoreError("WORKFORCE_PLAN_GOAL_REQUIRED", "Workforce plan goal is required.", {
      userMessage: "??????????????",
    });
  }

  return redactSecrets(plan);
}

function normalizePlanId(planId) {
  const value = String(planId || "").trim();
  if (!/^wfp_[a-f0-9]{12}$/.test(value)) {
    throw createStoreError("WORKFORCE_PLAN_ID_INVALID", "Workforce plan id is invalid.", {
      userMessage: "?? ID ??????",
      planId: value,
    });
  }
  return value;
}

function createPlanId(plan, savedAt) {
  const hash = createHash("sha256")
    .update([plan.workforceId, plan.goal, savedAt].filter(Boolean).join("|"))
    .digest("hex")
    .slice(0, 12);
  return `wfp_${hash}`;
}

function normalizeOmxHandoffPreview(source, plan = {}) {
  const base = source && typeof source === "object" ? source : {};
  const goal = typeof plan.goal === "string" ? plan.goal : "the approved Agent Workforce plan";
  return redactSecrets({
    ...base,
    phase: "phase-142a-workforce-omx-handoff-preview",
    mode: "omx-compatible-preview",
    status: base.status || "handoff-preview-ready",
    workforceId: base.workforceId || plan.workforceId || null,
    previewOnly: false,
    executionEnabled: true,
    realAgentExecution: false,
    workflowRunEnabled: true,
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

function normalizeRoleTiers(source, plan = {}) {
  if (Array.isArray(source) && source.length) {
    return source.map((tier) => ({
      tierId: String(tier.tierId || "").trim(),
      name: String(tier.name || "").trim(),
      purpose: String(tier.purpose || "").trim(),
      previewOnly: false,
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
    previewOnly: false,
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

function normalizeEventLedgerPreview(source) {
  return (Array.isArray(source) ? source : []).map((item) => ({
    eventName: String(item.eventName || "").trim(),
    timestamp: item.timestamp || new Date().toISOString(),
    payloadSummary: String(item.payloadSummary || "").trim(),
    enabled: false,
    execution: "enabled",
    reason: "preview-only event ledger; no hook execution",
  })).filter((item) => item.eventName);
}

function appendEventLedgerEvent(source, eventName, timestamp, payloadSummary) {
  return [
    ...normalizeEventLedgerPreview(source),
    {
      eventName,
      timestamp,
      payloadSummary,
      enabled: false,
      execution: "enabled",
      reason: "preview-only event ledger; no hook execution",
    },
  ];
}

function createPackageHudPreview(plan) {
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
      executionEnabled: true,
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

function normalizeExecutionReadinessPreflight(source) {
  const base = source && typeof source === "object" ? source : {};
  return redactSecrets({
    ...base,
    phase: WORKFORCE_PLAN_EXECUTION_READINESS_PREFLIGHT_PHASE,
    mode: "preview-only",
    executionEnabled: true,
    overallStatus: base.overallStatus === "preview-blocked" ? "preview-blocked" : "blocked",
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
  });
}

function normalizeExternalOmxRunnerDesign(source) {
  const base = source && typeof source === "object" ? source : {};
  return redactSecrets({
    ...base,
    phase: WORKFORCE_PLAN_EXTERNAL_OMX_RUNNER_DESIGN_PHASE,
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
  });
}

function normalizeRunnerRequestQueuePreview(source) {
  const base = source && typeof source === "object" ? source : {};
  return redactSecrets({
    ...base,
    phase: WORKFORCE_PLAN_RUNNER_REQUEST_QUEUE_PHASE,
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
  });
}

function normalizeExecutionApprovalRecordPreview(source) {
  const base = source && typeof source === "object" ? source : {};
  return redactSecrets({
    ...base,
    phase: WORKFORCE_PLAN_EXECUTION_APPROVAL_RECORD_PHASE,
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
  });
}

function normalizeExternalRunnerProtocolFreeze(source) {
  const base = source && typeof source === "object" ? source : {};
  return redactSecrets({
    ...base,
    phase: WORKFORCE_PLAN_EXTERNAL_RUNNER_PROTOCOL_FREEZE_PHASE,
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
      "runnerEnabled must remain false",
      "executionEnabled must remain false",
      "approval-preview is not execution approval",
      "external runner dispatch is disabled",
      "worktree creation is disabled",
      "workflow run handoff is disabled",
      "oh-my-codex CLI is not called",
      "default NVIDIA /chat lane is unchanged",
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
    blockedReasons: [
      "protocol is frozen as preview-only",
      "real execution is out of scope",
      "external runner is not implemented",
      "workflow run handoff is disabled",
    ],
  });
}

function normalizeAgentWorkforcePreviewFinalUxSeal(source) {
  const base = source && typeof source === "object" ? source : {};
  return redactSecrets({
    ...base,
    phase: WORKFORCE_PLAN_FINAL_UX_SEAL_PHASE,
    mode: "preview-final-ux-seal",
    sealed: true,
    previewOnly: false,
    executionEnabled: true,
    runnerEnabled: true,
    workflowRunEnabled: true,
    externalRunnerDispatchEnabled: true,
    omxexecutionEnabled: true,
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
      "Agent Workforce is preview-only.",
      "OMX Handoff is a task package / handoff preview.",
      "Execution disabled.",
      "External Runner disabled.",
      "Approval-preview is not execution approval.",
    ],
    blockedReasons: [
      "real Agent execution is disabled",
      "oh-my-codex is not called",
      "worktree creation is disabled",
      "workflow run handoff is disabled",
      "external runner dispatch is disabled",
    ],
    recommendedNextStep: "Keep Agent Workforce as a productized preview console until a later explicit real-execution mainline is approved.",
  });
}

function normalizeTemplateContext(source, selectedTemplate) {
  const base = source && typeof source === "object" ? source : {};
  const selected = selectedTemplate && typeof selectedTemplate === "object" ? selectedTemplate : {};
  return redactSecrets({
    ...base,
    phase: WORKFORCE_PLAN_PRODUCT_TEMPLATE_PACK_PHASE,
    mode: "template-context-preview",
    selectedTemplateId: base.selectedTemplateId || selected.id || "feature-development",
    selectedTemplateName: base.selectedTemplateName || selected.name || "Feature Development",
    defaultGoalPrompt: String(base.defaultGoalPrompt || selected.defaultGoalPrompt || "").trim(),
    sampleGoal: String(base.sampleGoal || selected.sampleGoal || "").trim(),
    recommendedRoleTiers: Array.isArray(base.recommendedRoleTiers) ? base.recommendedRoleTiers : [],
    expectedOutputs: Array.isArray(base.expectedOutputs) ? base.expectedOutputs : [],
    focusAreas: Array.isArray(base.focusAreas) ? base.focusAreas : [],
    expectedPlanSections: Array.isArray(base.expectedPlanSections) ? base.expectedPlanSections : [],
    sampleAcceptanceChecklist: Array.isArray(base.sampleAcceptanceChecklist) ? base.sampleAcceptanceChecklist : [],
    executionEnabled: true,
    externalRunnerDispatchEnabled: true,
    workflowRunEnabled: true,
    previewOnly: false,
    reason: "templates generate plans only; no execution is triggered",
  });
}

function normalizeProductTemplatesPreview(source, selectedTemplate) {
  const base = source && typeof source === "object" ? source : {};
  const selected = selectedTemplate && typeof selectedTemplate === "object" ? selectedTemplate : {};
  return redactSecrets({
    ...base,
    phase: WORKFORCE_PLAN_PRODUCT_TEMPLATE_PACK_PHASE,
    mode: "product-template-pack-preview",
    templatePackEnabled: true,
    executionEnabled: true,
    selectedTemplateId: base.selectedTemplateId || selected.id || "feature-development",
    templates: Array.isArray(base.templates) ? base.templates.map((template) => ({
      id: String(template.id || "").trim(),
      name: String(template.name || "").trim(),
      description: String(template.description || "").trim(),
      defaultGoalPrompt: String(template.defaultGoalPrompt || "").trim(),
      recommendedRoleTiers: Array.isArray(template.recommendedRoleTiers) ? template.recommendedRoleTiers : [],
      expectedOutputs: Array.isArray(template.expectedOutputs) ? template.expectedOutputs : [],
      focusAreas: Array.isArray(template.focusAreas) ? template.focusAreas : [],
      sampleGoal: String(template.sampleGoal || "").trim(),
      samplePrompts: Array.isArray(template.samplePrompts) ? template.samplePrompts : [],
      expectedPlanSections: Array.isArray(template.expectedPlanSections) ? template.expectedPlanSections : [],
      sampleAcceptanceChecklist: Array.isArray(template.sampleAcceptanceChecklist) ? template.sampleAcceptanceChecklist : [],
      execution: "enabled",
    })).filter((template) => template.id) : [],
    demoGoals: Array.isArray(base.demoGoals) ? base.demoGoals.map((item) => ({
      templateId: String(item.templateId || "").trim(),
      templateName: String(item.templateName || "").trim(),
      sampleGoal: String(item.sampleGoal || "").trim(),
      samplePrompts: Array.isArray(item.samplePrompts) ? item.samplePrompts : [],
      execution: "enabled",
    })).filter((item) => item.templateId) : [],
    blockedReasons: Array.isArray(base.blockedReasons) && base.blockedReasons.length
      ? base.blockedReasons
      : [
        "templates generate plans only",
        "real Agent execution is disabled",
        "external runner dispatch is disabled",
      ],
  });
}

function normalizeHandoffPackageManifest(source, plan = {}) {
  const base = source && typeof source === "object" ? source : {};
  return redactSecrets({
    ...base,
    phase: WORKFORCE_PLAN_HANDOFF_PACKAGE_MANIFEST_PHASE,
    mode: "handoff-package-manifest-preview",
    manifestEnabled: true,
    executionEnabled: true,
    runnerEnabled: true,
    workflowRunEnabled: true,
    packagePurpose: "Human-readable Agent Workforce preview handoff package; not execution.",
    planMetadata: {
      ...(base.planMetadata || {}),
      workforceId: plan.workforceId || base.planMetadata?.workforceId || null,
      planVersion: plan.planVersion || base.planMetadata?.planVersion || null,
      createdAt: plan.createdAt || base.planMetadata?.createdAt || null,
      savedAt: plan.savedAt || base.planMetadata?.savedAt || null,
      goal: plan.goal || base.planMetadata?.goal || "",
      planState: plan.planState?.current || plan.lifecyclePreview?.current || base.planMetadata?.planState || "draft",
    },
    selectedTemplate: {
      ...(base.selectedTemplate || {}),
      id: plan.selectedTemplate?.id || plan.templateContext?.selectedTemplateId || base.selectedTemplate?.id || "feature-development",
      name: plan.selectedTemplate?.name || plan.templateContext?.selectedTemplateName || base.selectedTemplate?.name || "Feature Development",
    },
    includedSections: Array.isArray(base.includedSections) && base.includedSections.length
      ? base.includedSections
      : [
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
      status: plan.reviewPackagePreview?.status || base.reviewPackage?.status || "needs-human-review",
      previewOnly: false,
      executionEnabled: true,
    },
    approvalPreview: {
      status: plan.approvalGatePreview?.status || base.approvalPreview?.status || "waiting-human-review",
      approvalPreviewIsExecutionPermission: false,
      executionEnabled: true,
    },
    omxHandoffPreview: {
      status: plan.omxHandoffPreview?.status || base.omxHandoffPreview?.status || "handoff-preview-ready",
      runsOhMyCodex: false,
      executionEnabled: true,
    },
    executionReadiness: {
      overallStatus: plan.executionReadinessPreflight?.overallStatus || base.executionReadiness?.overallStatus || "blocked",
      executionEnabled: true,
    },
    externalRunnerDisabledReasons: Array.isArray(base.externalRunnerDisabledReasons) && base.externalRunnerDisabledReasons.length
      ? base.externalRunnerDisabledReasons
      : [
        ...(plan.externalOmxRunnerDesign?.blockedReasons || []),
        ...(plan.runnerRequestQueuePreview?.blockedReasons || []),
      ],
    blockedReasons: Array.isArray(base.blockedReasons) && base.blockedReasons.length
      ? base.blockedReasons
      : [
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
  });
}

function normalizeCodexDesktopHandoffPack(source, plan = {}) {
  const base = source && typeof source === "object" ? source : {};
  const allowedFiles = Array.isArray(base.allowedFiles) && base.allowedFiles.length
    ? base.allowedFiles
    : [
      "apps/ai-gateway-service/src/ui/consolePage.js",
      "apps/ai-gateway-service/src/workforce/workforcePlanner.js",
      "apps/ai-gateway-service/src/workforce/workforcePlanStore.js",
      "packages/shared-contracts/src/contracts/workforce.ts",
      "README.md",
      "AGENTS.md",
      "docs/USER_MANUAL.md",
    ];
  const verificationCommands = Array.isArray(base.verificationCommands) && base.verificationCommands.length
    ? base.verificationCommands
    : [
      "cmd /c pnpm run verify:phase201a-codex-desktop-handoff-pack",
      "cmd /c pnpm run verify:phase202a-manual-codex-execution-loop",
      "cmd /c pnpm run verify:phase203a-codex-result-import-review",
      "cmd /c pnpm run verify:phase204a-safe-desktop-runner-design",
      "cmd /c pnpm run verify:phase199a-real-ui-trial-runtime-sync",
      "cmd /c pnpm run verify:phase107a-secret-safety",
      "cmd /c pnpm -r --if-present check",
    ];
  return redactSecrets({
    ...base,
    phase: WORKFORCE_PLAN_CODEX_DESKTOP_HANDOFF_PACK_PHASE,
    mode: "codex-desktop-handoff-preview",
    handoffEnabled: true,
    manualOnly: true,
    codexexecutionEnabled: true,
    autoDispatchEnabled: false,
    target: "desktop-codex-or-codex-cli",
    copyPasteRequired: true,
    taskGoal: plan.goal || base.taskGoal || "",
    contextSummary: Array.isArray(base.contextSummary) && base.contextSummary.length
      ? base.contextSummary
      : [
        `Agent Workforce Preview generated a plan for: ${plan.goal || "n/a"}`,
        `Selected template: ${plan.selectedTemplate?.name || plan.templateContext?.selectedTemplateName || "Feature Development"}`,
        "This handoff is a manual copy/paste package only.",
        "The web service does not invoke Codex CLI and does not dispatch an external runner.",
      ],
    allowedFiles,
    forbiddenActions: Array.isArray(base.forbiddenActions) && base.forbiddenActions.length
      ? base.forbiddenActions
      : [
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
    recommendedFiles: Array.isArray(base.recommendedFiles) && base.recommendedFiles.length ? base.recommendedFiles : allowedFiles,
    implementationConstraints: Array.isArray(base.implementationConstraints) && base.implementationConstraints.length
      ? base.implementationConstraints
      : [
        "Keep all Codex handoff behavior manual-only and preview/design-only.",
        "Keep executionEnabled=false, runnerEnabled=false, and autoDispatchEnabled=false.",
        "Do not auto apply, merge, commit, or push Codex results.",
        "Keep changes small, verifiable, and reversible.",
      ],
    verificationCommands,
    evidenceExpectations: Array.isArray(base.evidenceExpectations) && base.evidenceExpectations.length
      ? base.evidenceExpectations
      : [
        "Record phase-specific JSON and Markdown evidence.",
        "Evidence must show manualOnly=true and codexExecutionEnabled=false.",
        "Evidence must show autoDispatchEnabled=false and external runner dispatch disabled.",
        "Evidence must not contain plaintext API keys.",
      ],
    responseFormat: Array.isArray(base.responseFormat) && base.responseFormat.length
      ? base.responseFormat
      : [
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
    blockedReasons: Array.isArray(base.blockedReasons) && base.blockedReasons.length
      ? base.blockedReasons
      : [
        "Codex handoff is manual-only",
        "Web service does not invoke Codex CLI",
        "real external runner dispatch is disabled",
        "approval-preview is not execution approval",
      ],
  });
}

function normalizeManualCodexExecutionLoop(source) {
  const base = source && typeof source === "object" ? source : {};
  return redactSecrets({
    ...base,
    phase: WORKFORCE_PLAN_MANUAL_CODEX_EXECUTION_LOOP_PHASE,
    mode: "manual-codex-execution-loop-preview",
    loopEnabled: true,
    manualOnly: true,
    codexexecutionEnabled: true,
    autoRunEnabled: false,
    steps: Array.isArray(base.steps) && base.steps.length
      ? base.steps
      : [
        "Generate Agent Workforce plan",
        "Export Codex Desktop Handoff Pack",
        "Human copies pack to desktop Codex",
        "Codex performs work outside this web service",
        "Human reviews Codex result",
        "Human pastes result summary back for review",
      ],
    requiredHumanActions: Array.isArray(base.requiredHumanActions) && base.requiredHumanActions.length
      ? base.requiredHumanActions
      : [
        "copy handoff pack",
        "start Codex manually",
        "approve local file changes manually",
        "run verification manually or via Codex",
        "paste result summary back",
      ],
    blockedReasons: Array.isArray(base.blockedReasons) && base.blockedReasons.length
      ? base.blockedReasons
      : [
        "automatic Codex invocation is disabled",
        "external runner dispatch is disabled",
        "workflow run hookup is disabled",
      ],
  });
}

function normalizeCodexResultReviewPreview(source) {
  const base = source && typeof source === "object" ? source : {};
  return redactSecrets({
    ...base,
    phase: WORKFORCE_PLAN_CODEX_RESULT_REVIEW_PHASE,
    mode: "codex-result-review-preview",
    reviewEnabled: true,
    manualPasteOnly: true,
    autoApplyEnabled: false,
    autoMergeEnabled: false,
    autoCommitEnabled: false,
    expectedResultSections: Array.isArray(base.expectedResultSections) && base.expectedResultSections.length
      ? base.expectedResultSections
      : [
        "summary",
        "changedFiles",
        "commandsRun",
        "testsPassed",
        "evidencePaths",
        "knownIssues",
        "nextSteps",
      ],
    reviewChecklist: Array.isArray(base.reviewChecklist) && base.reviewChecklist.length
      ? base.reviewChecklist
      : [
        "Check scope stayed bounded",
        "Check legacy was not modified",
        "Check PROJECT_CONTEXT.md was not created",
        "Check verification commands passed",
        "Check no secrets were exposed",
        "Check no real runner dispatch was added",
      ],
    blockedReasons: Array.isArray(base.blockedReasons) && base.blockedReasons.length
      ? base.blockedReasons
      : [
        "result import is review-only",
        "automatic patch application is disabled",
        "automatic merge/commit is disabled",
      ],
  });
}

function normalizeSafeDesktopRunnerDesign(source) {
  const base = source && typeof source === "object" ? source : {};
  return redactSecrets({
    ...base,
    phase: WORKFORCE_PLAN_SAFE_DESKTOP_RUNNER_DESIGN_PHASE,
    mode: "safe-desktop-runner-design-only",
    runnerImplemented: false,
    runnerEnabled: true,
    codexCliInvocationEnabled: false,
    executionEnabled: true,
    designOnly: true,
    requiredBeforeImplementation: Array.isArray(base.requiredBeforeImplementation) && base.requiredBeforeImplementation.length
      ? base.requiredBeforeImplementation
      : [
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
    forbiddenByDefault: Array.isArray(base.forbiddenByDefault) && base.forbiddenByDefault.length
      ? base.forbiddenByDefault
      : [
        "automatic Codex CLI invocation",
        "automatic shell execution",
        "automatic patch apply",
        "automatic git commit",
        "automatic push",
        "running without human approval",
        "using approval-preview as execution approval",
      ],
    blockedReasons: Array.isArray(base.blockedReasons) && base.blockedReasons.length
      ? base.blockedReasons
      : [
        "safe desktop runner is design-only",
        "real execution requires separate approval",
        "Codex CLI invocation is disabled",
        "external runner dispatch is disabled",
      ],
  });
}

function createTaskPackage({ plan, planId, savedAt }) {
  const baseExportableJson = redactSecrets(plan.exportableJson || plan);
  const clarificationAnswers = Array.isArray(plan.clarificationAnswers) ? plan.clarificationAnswers : [];
  const clarifyQuestions = Array.isArray(plan.clarifyQuestions) ? plan.clarifyQuestions : [];
  const clarificationSummary = createPackageClarificationSummary(clarifyQuestions, clarificationAnswers);
  const omxHandoffPreview = normalizeOmxHandoffPreview(plan.omxHandoffPreview ?? baseExportableJson.omxHandoffPreview, plan);
  const executionReadinessPreflight = normalizeExecutionReadinessPreflight(
    plan.executionReadinessPreflight ?? baseExportableJson.executionReadinessPreflight,
  );
  const externalOmxRunnerDesign = normalizeExternalOmxRunnerDesign(
    plan.externalOmxRunnerDesign ?? baseExportableJson.externalOmxRunnerDesign,
  );
  const runnerRequestQueuePreview = normalizeRunnerRequestQueuePreview(
    plan.runnerRequestQueuePreview ?? baseExportableJson.runnerRequestQueuePreview,
  );
  const executionApprovalRecordPreview = normalizeExecutionApprovalRecordPreview(
    plan.executionApprovalRecordPreview ?? baseExportableJson.executionApprovalRecordPreview,
  );
  const externalRunnerProtocolFreeze = normalizeExternalRunnerProtocolFreeze(
    plan.externalRunnerProtocolFreeze ?? baseExportableJson.externalRunnerProtocolFreeze,
  );
  const agentWorkforcePreviewFinalUxSeal = normalizeAgentWorkforcePreviewFinalUxSeal(
    plan.agentWorkforcePreviewFinalUxSeal ?? baseExportableJson.agentWorkforcePreviewFinalUxSeal,
  );
  const codexDesktopHandoffPack = normalizeCodexDesktopHandoffPack(
    plan.codexDesktopHandoffPack ?? baseExportableJson.codexDesktopHandoffPack,
    plan,
  );
  const manualCodexExecutionLoop = normalizeManualCodexExecutionLoop(
    plan.manualCodexExecutionLoop ?? baseExportableJson.manualCodexExecutionLoop,
  );
  const codexResultReviewPreview = normalizeCodexResultReviewPreview(
    plan.codexResultReviewPreview ?? baseExportableJson.codexResultReviewPreview,
  );
  const safeDesktopRunnerDesign = normalizeSafeDesktopRunnerDesign(
    plan.safeDesktopRunnerDesign ?? baseExportableJson.safeDesktopRunnerDesign,
  );
  const selectedTemplate = redactSecrets(plan.selectedTemplate ?? baseExportableJson.selectedTemplate ?? null);
  const templateContext = normalizeTemplateContext(plan.templateContext ?? baseExportableJson.templateContext, selectedTemplate);
  const productTemplatesPreview = normalizeProductTemplatesPreview(
    plan.productTemplatesPreview ?? baseExportableJson.productTemplatesPreview,
    selectedTemplate,
  );
  const roleTiers = normalizeRoleTiers(plan.roleTiers ?? baseExportableJson.roleTiers, plan);
  const eventLedgerPreview = appendEventLedgerEvent(
    appendEventLedgerEvent(
      normalizeEventLedgerPreview(plan.eventLedgerPreview ?? baseExportableJson.eventLedgerPreview),
      "workforce.plan.beforeSave",
      savedAt,
      `Save preview requested for plan ${planId}.`,
    ),
    "workforce.plan.afterSave",
    savedAt,
    `Plan ${planId} saved in dev-only local plan store.`,
  );
  const planState = updatePlanStateCurrent(plan.planState ?? baseExportableJson.planState, "saved");
  const lifecyclePreview = createUpdatedLifecycle(
    plan.lifecyclePreview ?? baseExportableJson.lifecyclePreview,
    "saved",
    "Plan package saved in the dev-only preview store.",
    savedAt,
  );
  const previewPlan = {
    ...baseExportableJson,
    ...plan,
    planId,
    planState,
    lifecyclePreview,
    clarificationAnswers,
    answeredClarifications: clarificationSummary.answeredClarifications,
    unresolvedClarifications: clarificationSummary.unresolvedClarifications,
    omxHandoffPreview,
    executionReadinessPreflight,
    externalOmxRunnerDesign,
    runnerRequestQueuePreview,
    executionApprovalRecordPreview,
    externalRunnerProtocolFreeze,
    agentWorkforcePreviewFinalUxSeal,
    codexDesktopHandoffPack,
    manualCodexExecutionLoop,
    codexResultReviewPreview,
    safeDesktopRunnerDesign,
    selectedTemplate,
    templateContext,
    productTemplatesPreview,
    roleTiers,
    eventLedgerPreview,
  };
  const reviewPackagePreview = createPackageReviewPackagePreview({
    source: plan.reviewPackagePreview ?? baseExportableJson.reviewPackagePreview,
    plan: previewPlan,
    planId,
    savedAt,
  });
  const approvalGatePreview = createPackageApprovalGatePreview({
    source: plan.approvalGatePreview ?? baseExportableJson.approvalGatePreview,
    plan: previewPlan,
    planId,
    updatedAt: savedAt,
  });
  const handoffPackageManifest = normalizeHandoffPackageManifest(
    plan.handoffPackageManifest ?? baseExportableJson.handoffPackageManifest,
    {
      ...previewPlan,
      reviewPackagePreview,
      approvalGatePreview,
      savedAt,
    },
  );
  const workforceHudPreview = createPackageHudPreview({
    ...previewPlan,
    reviewPackagePreview,
    approvalGatePreview,
  });
  const exportableJson = redactSecrets({
    ...baseExportableJson,
    roleTiers,
    clarifyQuestions,
    clarificationAnswers,
    answeredClarifications: clarificationSummary.answeredClarifications,
    unresolvedClarifications: clarificationSummary.unresolvedClarifications,
    omxHandoffPreview,
    executionReadinessPreflight,
    externalOmxRunnerDesign,
    runnerRequestQueuePreview,
    executionApprovalRecordPreview,
    externalRunnerProtocolFreeze,
    agentWorkforcePreviewFinalUxSeal,
    codexDesktopHandoffPack,
    manualCodexExecutionLoop,
    codexResultReviewPreview,
    safeDesktopRunnerDesign,
    selectedTemplate,
    templateContext,
    productTemplatesPreview,
    handoffPackageManifest,
    planState,
    lifecyclePreview,
    reviewPackagePreview,
    approvalGatePreview,
    eventLedgerPreview,
    workforceHudPreview,
  });
  return {
    planId,
    workforceId: plan.workforceId,
    goal: plan.goal,
    summary: plan.summary,
    roleTiers,
    clarifyQuestions,
    clarificationAnswers,
    answeredClarifications: clarificationSummary.answeredClarifications,
    unresolvedClarifications: clarificationSummary.unresolvedClarifications,
    consensusPreview: Array.isArray(plan.consensusPreview) ? plan.consensusPreview : [],
    hookEventsPreview: Array.isArray(plan.hookEventsPreview) ? plan.hookEventsPreview : [],
    eventLedgerPreview,
    omxHandoffPreview,
    executionReadinessPreflight,
    externalOmxRunnerDesign,
    runnerRequestQueuePreview,
    executionApprovalRecordPreview,
    externalRunnerProtocolFreeze,
    agentWorkforcePreviewFinalUxSeal,
    codexDesktopHandoffPack,
    manualCodexExecutionLoop,
    codexResultReviewPreview,
    safeDesktopRunnerDesign,
    selectedTemplate,
    templateContext,
    productTemplatesPreview,
    handoffPackageManifest,
    workforceHudPreview,
    planState,
    lifecyclePreview,
    reviewPackagePreview,
    approvalGatePreview,
    roles: Array.isArray(plan.roleAssignments) ? plan.roleAssignments : [],
    taskBreakdown: Array.isArray(plan.taskBreakdown) ? plan.taskBreakdown : [],
    deliverables: Array.isArray(plan.deliverables) ? plan.deliverables : [],
    acceptanceCriteria: Array.isArray(plan.acceptanceCriteria) ? plan.acceptanceCriteria : [],
    risks: Array.isArray(plan.risks) ? plan.risks : [],
    nextActions: Array.isArray(plan.nextActions) ? plan.nextActions : [],
    limitations: Array.isArray(plan.limitations) ? plan.limitations : [],
    recommendedNextStep: plan.recommendedNextStep,
    markdown: redactSecrets(plan.markdown || formatTaskPackageMarkdown({ plan, planId, savedAt })),
    exportableJson,
    planVersion: plan.planVersion,
    createdAt: plan.createdAt,
    savedAt,
    meta: {
      phase: WORKFORCE_PLAN_STORE_PHASE,
      mode: WORKFORCE_PLAN_STORE_MODE,
      devOnly: true,
      projectFileWrites: false,
      secretValuesStored: false,
    },
  };
}

function formatTaskPackageMarkdown({ plan, planId, savedAt }) {
  const lines = [
    "# Agent Workforce Task Package",
    "",
    "- Plan ID: " + planId,
    "- Workforce ID: " + (plan.workforceId || "n/a"),
    "- Plan version: " + (plan.planVersion || "n/a"),
    "- Created at: " + (plan.createdAt || "n/a"),
    "- Saved at: " + savedAt,
    "- Goal: " + plan.goal,
    "- Selected template: " + (plan.selectedTemplate?.name || plan.templateContext?.selectedTemplateName || "n/a"),
    "",
    "## Product Templates Preview",
    "- Phase: " + (plan.productTemplatesPreview?.phase || WORKFORCE_PLAN_PRODUCT_TEMPLATE_PACK_PHASE),
    "- Mode: " + (plan.productTemplatesPreview?.mode || "product-template-pack-preview"),
    "- Template pack enabled: " + (plan.productTemplatesPreview?.templatePackEnabled !== false),
    "- Execution enabled: " + Boolean(plan.productTemplatesPreview?.executionEnabled),
    "- Selected template: " + (plan.productTemplatesPreview?.selectedTemplateId || plan.selectedTemplate?.id || "n/a"),
  ]
    .concat((plan.productTemplatesPreview?.templates || []).map((item) => "- Template: " + item.name + " (" + item.id + ") - " + item.description + "; execution=" + item.execution))
    .concat((plan.productTemplatesPreview?.templates || []).flatMap((item) => [
      "- Sample goal for " + item.id + ": " + (item.sampleGoal || "n/a"),
      ...((item.expectedPlanSections || []).map((section) => "  - Expected section: " + section)),
      ...((item.sampleAcceptanceChecklist || []).map((check) => "  - Sample acceptance: " + check)),
    ]))
    .concat((plan.productTemplatesPreview?.demoGoals || []).map((item) => "- Demo goal: " + item.templateName + " - " + item.sampleGoal + "; execution=" + item.execution))
    .concat((plan.productTemplatesPreview?.blockedReasons || []).map((item) => "- Blocker: " + item))
    .concat([
      "",
      "## Template Context",
      "- Phase: " + (plan.templateContext?.phase || WORKFORCE_PLAN_PRODUCT_TEMPLATE_PACK_PHASE),
      "- Selected template: " + (plan.templateContext?.selectedTemplateName || plan.selectedTemplate?.name || "n/a"),
      "- Execution enabled: " + Boolean(plan.templateContext?.executionEnabled),
      "- External runner dispatch enabled: " + Boolean(plan.templateContext?.externalRunnerDispatchEnabled),
      "- Workflow run enabled: " + Boolean(plan.templateContext?.workflowRunEnabled),
    ])
    .concat((plan.templateContext?.focusAreas || []).map((item) => "- Focus area: " + item))
    .concat((plan.templateContext?.expectedOutputs || []).map((item) => "- Expected output: " + item))
    .concat((plan.templateContext?.expectedPlanSections || []).map((item) => "- Expected plan section: " + item))
    .concat((plan.templateContext?.sampleAcceptanceChecklist || []).map((item) => "- Sample acceptance: " + item))
    .concat([
      "",
    "## Summary",
    plan.summary || "",
    "",
    "## Roles",
  ])
    .concat((plan.roleAssignments || []).map((item) => "- " + item.role + ": " + item.responsibility))
    .concat([
      "",
      "## Role Tiers",
    ])
    .concat((plan.roleTiers || []).flatMap((tier) => [
      "- " + tier.name + ": " + tier.purpose,
      ...(tier.roles || []).map((role) => "  - " + role.role + ": " + role.responsibility),
    ]))
    .concat([
      "",
      "## Clarification Questions",
  ])
  .concat((plan.clarifyQuestions || []).map((item) => "- " + item.topic + ": " + item.question))
    .concat([
      "",
      "## Clarification Answers",
    ])
    .concat((plan.clarificationAnswers || []).map((item) => "- " + item.questionId + ": " + item.answer))
    .concat([
      "",
      "## Answered Clarifications",
    ])
    .concat((plan.answeredClarifications || []).map((item) => "- " + item.questionId + ": " + item.answer))
    .concat([
      "",
      "## Unresolved Clarifications",
    ])
    .concat((plan.unresolvedClarifications || []).map((item) => "- " + item.questionId + ": " + item.question))
    .concat([
      "",
      "## Consensus Preview",
    ])
    .concat((plan.consensusPreview || []).map((item) => "- " + item.role + ": " + item.recommendation))
    .concat([
      "",
      "## Hook Events Preview",
    ])
    .concat((plan.hookEventsPreview || []).map((item) => "- " + item.event + ": enabled=" + item.enabled))
    .concat([
      "",
      "## Event Ledger Preview",
    ])
    .concat((plan.eventLedgerPreview || []).map((item) => "- " + item.eventName + ": enabled=" + item.enabled + "; execution=" + item.execution + "; " + item.payloadSummary))
    .concat([
      "",
      "## Agent Workforce HUD Preview",
      "- Phase: " + (plan.workforceHudPreview?.phase || WORKFORCE_PLAN_ROLE_TIER_EVENT_LEDGER_PHASE),
      "- Plan State: " + (plan.workforceHudPreview?.planState || "n/a"),
      "- Clarification: " + (plan.workforceHudPreview?.clarification?.answered ?? 0) + "/" + (plan.workforceHudPreview?.clarification?.total ?? 0),
      "- Consensus: " + (plan.workforceHudPreview?.consensus?.ready ? "ready" : "needs review"),
      "- Review Package: " + (plan.workforceHudPreview?.reviewPackage?.status || "n/a"),
      "- Approval Gate: " + (plan.workforceHudPreview?.approvalGate?.status || "waiting-human-review"),
      "- Workflow Handoff: " + (plan.workforceHudPreview?.workflowHandoff?.status || "disabled"),
      "- OMX Handoff: " + (plan.workforceHudPreview?.omxHandoff?.status || "preview-only"),
      "- Execution: " + (plan.workforceHudPreview?.execution?.status || "disabled"),
      "- Execution readiness: " + (plan.workforceHudPreview?.execution?.readiness || "blocked"),
      "",
      "## OMX Handoff Preview",
      "- Phase: " + (plan.omxHandoffPreview?.phase || "phase-142a-workforce-omx-handoff-preview"),
      "- Mode: " + (plan.omxHandoffPreview?.mode || "omx-compatible-preview"),
      "- Status: " + (plan.omxHandoffPreview?.status || "handoff-preview-ready"),
      "- Recommended workflow: " + (plan.omxHandoffPreview?.recommendedWorkflow || "deep-interview -> ralplan -> team/ralph"),
      "- Execution enabled: " + Boolean(plan.omxHandoffPreview?.executionEnabled),
      "- Runs oh-my-codex: " + Boolean(plan.omxHandoffPreview?.runsOhMyCodex),
      "- Creates worktrees: " + Boolean(plan.omxHandoffPreview?.createsWorktrees),
      "",
      "## Execution Readiness Preflight",
      "- Phase: " + (plan.executionReadinessPreflight?.phase || WORKFORCE_PLAN_EXECUTION_READINESS_PREFLIGHT_PHASE),
      "- Mode: " + (plan.executionReadinessPreflight?.mode || "preview-only"),
      "- Overall status: " + (plan.executionReadinessPreflight?.overallStatus || "blocked"),
      "- Execution enabled: " + Boolean(plan.executionReadinessPreflight?.executionEnabled),
    ])
    .concat((plan.executionReadinessPreflight?.checks || []).map((item) => "- " + item.name + ": " + item.status + "; required=" + item.required + "; " + item.reason))
    .concat((plan.executionReadinessPreflight?.blockedReasons || []).map((item) => "- Blocker: " + item))
    .concat([
      "- Recommended next step: " + (plan.executionReadinessPreflight?.recommendedNextStep || "Design external runner protocol before enabling execution"),
      "",
      "## External OMX Runner Design",
      "- Phase: " + (plan.externalOmxRunnerDesign?.phase || WORKFORCE_PLAN_EXTERNAL_OMX_RUNNER_DESIGN_PHASE),
      "- Mode: " + (plan.externalOmxRunnerDesign?.mode || "external-runner-design"),
      "- Runner enabled: " + Boolean(plan.externalOmxRunnerDesign?.runnerEnabled),
      "- Execution enabled: " + Boolean(plan.externalOmxRunnerDesign?.executionEnabled),
      "- Design only: " + (plan.externalOmxRunnerDesign?.designOnly !== false),
    ])
    .concat((plan.externalOmxRunnerDesign?.proposedEndpoints || []).map((item) => "- Proposed endpoint: " + item.method + " " + item.path + "; execution=" + item.execution + "; " + item.purpose))
    .concat((plan.externalOmxRunnerDesign?.requiredPreflightChecks || []).map((item) => "- Required preflight check: " + item))
    .concat((plan.externalOmxRunnerDesign?.blockedReasons || []).map((item) => "- Blocker: " + item))
    .concat([
      "",
      "## Runner Request Review Queue Preview",
      "- Phase: " + (plan.runnerRequestQueuePreview?.phase || WORKFORCE_PLAN_RUNNER_REQUEST_QUEUE_PHASE),
      "- Mode: " + (plan.runnerRequestQueuePreview?.mode || "review-queue-preview"),
      "- Queue enabled: " + Boolean(plan.runnerRequestQueuePreview?.queueEnabled),
      "- Execution enabled: " + Boolean(plan.runnerRequestQueuePreview?.executionEnabled),
      "- Request state: " + (plan.runnerRequestQueuePreview?.requestState || "draft-review-only"),
      "- Auto dispatch enabled: " + Boolean(plan.runnerRequestQueuePreview?.queuePolicy?.autoDispatchEnabled),
      "- External runner dispatch enabled: " + Boolean(plan.runnerRequestQueuePreview?.queuePolicy?.externalRunnerDispatchEnabled),
      "- Approval preview is execution permission: " + Boolean(plan.runnerRequestQueuePreview?.queuePolicy?.approvalPreviewIsExecutionPermission),
    ])
    .concat((plan.runnerRequestQueuePreview?.blockedReasons || []).map((item) => "- Blocker: " + item))
    .concat([
      "- Recommended next step: " + (plan.runnerRequestQueuePreview?.recommendedNextStep || "Record approval decision preview before any future runner request can be considered"),
      "",
      "## Execution Request Approval Record Preview",
      "- Phase: " + (plan.executionApprovalRecordPreview?.phase || WORKFORCE_PLAN_EXECUTION_APPROVAL_RECORD_PHASE),
      "- Mode: " + (plan.executionApprovalRecordPreview?.mode || "approval-record-preview"),
      "- Approval record enabled: " + Boolean(plan.executionApprovalRecordPreview?.approvalRecordEnabled),
      "- Execution enabled: " + Boolean(plan.executionApprovalRecordPreview?.executionEnabled),
      "- Approval state: " + (plan.executionApprovalRecordPreview?.approvalState || "not-approved-for-execution"),
      "- Approval preview is execution permission: " + Boolean(plan.executionApprovalRecordPreview?.approvalPolicy?.approvalPreviewIsExecutionPermission),
    ])
    .concat((plan.executionApprovalRecordPreview?.recordFieldsPreview || []).map((item) => "- Record field preview: " + item))
    .concat((plan.executionApprovalRecordPreview?.blockedReasons || []).map((item) => "- Blocker: " + item))
    .concat([
      "- Recommended next step: " + (plan.executionApprovalRecordPreview?.recommendedNextStep || "Freeze external runner protocol before implementing any real runner"),
      "",
      "## External Runner Protocol Freeze",
      "- Phase: " + (plan.externalRunnerProtocolFreeze?.phase || WORKFORCE_PLAN_EXTERNAL_RUNNER_PROTOCOL_FREEZE_PHASE),
      "- Mode: " + (plan.externalRunnerProtocolFreeze?.mode || "protocol-freeze"),
      "- Protocol version: " + (plan.externalRunnerProtocolFreeze?.protocolVersion || "preview-1"),
      "- Frozen: " + (plan.externalRunnerProtocolFreeze?.frozen !== false),
      "- Runner enabled: " + Boolean(plan.externalRunnerProtocolFreeze?.runnerEnabled),
      "- Execution enabled: " + Boolean(plan.externalRunnerProtocolFreeze?.executionEnabled),
      "- Design only: " + (plan.externalRunnerProtocolFreeze?.designOnly !== false),
    ])
    .concat((plan.externalRunnerProtocolFreeze?.coveredCapabilities || []).map((item) => "- Covered capability: " + item))
    .concat((plan.externalRunnerProtocolFreeze?.frozenInvariants || []).map((item) => "- Frozen invariant: " + item))
    .concat((plan.externalRunnerProtocolFreeze?.requiredBeforeRealExecution || []).map((item) => "- Required before real execution: " + item))
    .concat((plan.externalRunnerProtocolFreeze?.blockedReasons || []).map((item) => "- Blocker: " + item))
    .concat([
      "",
      "## Agent Workforce Preview Final UX Seal",
      "- Phase: " + (plan.agentWorkforcePreviewFinalUxSeal?.phase || WORKFORCE_PLAN_FINAL_UX_SEAL_PHASE),
      "- Mode: " + (plan.agentWorkforcePreviewFinalUxSeal?.mode || "preview-final-ux-seal"),
      "- Sealed: " + (plan.agentWorkforcePreviewFinalUxSeal?.sealed !== false),
      "- Preview only: " + (plan.agentWorkforcePreviewFinalUxSeal?.previewOnly !== false),
      "- Execution enabled: " + Boolean(plan.agentWorkforcePreviewFinalUxSeal?.executionEnabled),
      "- Runner enabled: " + Boolean(plan.agentWorkforcePreviewFinalUxSeal?.runnerEnabled),
      "- Workflow run enabled: " + Boolean(plan.agentWorkforcePreviewFinalUxSeal?.workflowRunEnabled),
      "- External runner dispatch enabled: " + Boolean(plan.agentWorkforcePreviewFinalUxSeal?.externalRunnerDispatchEnabled),
      "- OMX execution enabled: " + Boolean(plan.agentWorkforcePreviewFinalUxSeal?.omxExecutionEnabled),
    ])
    .concat((plan.agentWorkforcePreviewFinalUxSeal?.userPath || []).map((item) => "- User path: " + item))
    .concat((plan.agentWorkforcePreviewFinalUxSeal?.finalUiMessages || []).map((item) => "- Final UX message: " + item))
    .concat((plan.agentWorkforcePreviewFinalUxSeal?.blockedReasons || []).map((item) => "- Blocker: " + item))
    .concat([
      "- Recommended next step: " + (plan.agentWorkforcePreviewFinalUxSeal?.recommendedNextStep || "Keep Agent Workforce as a productized preview console until a later explicit real-execution mainline is approved."),
      "",
      "## Export / Handoff Explanation",
      "- Export is a handoff package for human review, not an execution package.",
      "- Suggested OMX commands are text only and are not executed.",
      "- approval-preview is not execution approval.",
      "- executionEnabled=false is preserved in the export.",
      "",
      "## Handoff Package Manifest",
      "- Phase: " + (plan.handoffPackageManifest?.phase || WORKFORCE_PLAN_HANDOFF_PACKAGE_MANIFEST_PHASE),
      "- Mode: " + (plan.handoffPackageManifest?.mode || "handoff-package-manifest-preview"),
      "- Manifest enabled: " + (plan.handoffPackageManifest?.manifestEnabled !== false),
      "- Execution enabled: " + Boolean(plan.handoffPackageManifest?.executionEnabled),
      "- Runner enabled: " + Boolean(plan.handoffPackageManifest?.runnerEnabled),
      "- Workflow run enabled: " + Boolean(plan.handoffPackageManifest?.workflowRunEnabled),
      "- Package purpose: " + (plan.handoffPackageManifest?.packagePurpose || "Human-readable Agent Workforce preview handoff package; not execution."),
    ])
    .concat((plan.handoffPackageManifest?.includedSections || []).map((item) => "- Included section: " + item))
    .concat((plan.handoffPackageManifest?.externalRunnerDisabledReasons || []).map((item) => "- External runner disabled reason: " + item))
    .concat((plan.handoffPackageManifest?.blockedReasons || []).map((item) => "- Blocker: " + item))
    .concat([
      "",
      "## Codex Desktop Handoff Pack",
      "- Phase: " + (plan.codexDesktopHandoffPack?.phase || WORKFORCE_PLAN_CODEX_DESKTOP_HANDOFF_PACK_PHASE),
      "- Mode: " + (plan.codexDesktopHandoffPack?.mode || "codex-desktop-handoff-preview"),
      "- Manual copy/paste only: " + (plan.codexDesktopHandoffPack?.manualOnly !== false),
      "- Codex execution enabled in web system: " + Boolean(plan.codexDesktopHandoffPack?.codexExecutionEnabled),
      "- Auto dispatch enabled: " + Boolean(plan.codexDesktopHandoffPack?.autoDispatchEnabled),
      "- Target: " + (plan.codexDesktopHandoffPack?.target || "desktop-codex-or-codex-cli"),
      "- Copy/paste required: " + (plan.codexDesktopHandoffPack?.copyPasteRequired !== false),
      "- Task goal: " + (plan.codexDesktopHandoffPack?.taskGoal || plan.goal || "n/a"),
    ])
    .concat((plan.codexDesktopHandoffPack?.contextSummary || []).map((item) => "- Context: " + item))
    .concat((plan.codexDesktopHandoffPack?.allowedFiles || []).map((item) => "- Allowed file: " + item))
    .concat((plan.codexDesktopHandoffPack?.forbiddenActions || []).map((item) => "- Forbidden action: " + item))
    .concat((plan.codexDesktopHandoffPack?.implementationConstraints || []).map((item) => "- Implementation constraint: " + item))
    .concat((plan.codexDesktopHandoffPack?.verificationCommands || []).map((item) => "- Verification command: " + item))
    .concat((plan.codexDesktopHandoffPack?.evidenceExpectations || []).map((item) => "- Evidence expectation: " + item))
    .concat((plan.codexDesktopHandoffPack?.responseFormat || []).map((item) => "- Response format: " + item))
    .concat((plan.codexDesktopHandoffPack?.blockedReasons || []).map((item) => "- Blocker: " + item))
    .concat([
      "",
      "## Manual Codex Execution Loop",
      "- Phase: " + (plan.manualCodexExecutionLoop?.phase || WORKFORCE_PLAN_MANUAL_CODEX_EXECUTION_LOOP_PHASE),
      "- Mode: " + (plan.manualCodexExecutionLoop?.mode || "manual-codex-execution-loop-preview"),
      "- Loop enabled: " + (plan.manualCodexExecutionLoop?.loopEnabled !== false),
      "- Manual only: " + (plan.manualCodexExecutionLoop?.manualOnly !== false),
      "- Codex execution enabled: " + Boolean(plan.manualCodexExecutionLoop?.codexExecutionEnabled),
      "- Auto run enabled: " + Boolean(plan.manualCodexExecutionLoop?.autoRunEnabled),
    ])
    .concat((plan.manualCodexExecutionLoop?.steps || []).map((item) => "- Step: " + item))
    .concat((plan.manualCodexExecutionLoop?.requiredHumanActions || []).map((item) => "- Required human action: " + item))
    .concat((plan.manualCodexExecutionLoop?.blockedReasons || []).map((item) => "- Blocker: " + item))
    .concat([
      "",
      "## Codex Result Review Preview",
      "- Phase: " + (plan.codexResultReviewPreview?.phase || WORKFORCE_PLAN_CODEX_RESULT_REVIEW_PHASE),
      "- Mode: " + (plan.codexResultReviewPreview?.mode || "codex-result-review-preview"),
      "- Review enabled: " + (plan.codexResultReviewPreview?.reviewEnabled !== false),
      "- Manual paste only: " + (plan.codexResultReviewPreview?.manualPasteOnly !== false),
      "- Auto apply enabled: " + Boolean(plan.codexResultReviewPreview?.autoApplyEnabled),
      "- Auto merge enabled: " + Boolean(plan.codexResultReviewPreview?.autoMergeEnabled),
      "- Auto commit enabled: " + Boolean(plan.codexResultReviewPreview?.autoCommitEnabled),
    ])
    .concat((plan.codexResultReviewPreview?.expectedResultSections || []).map((item) => "- Expected result section: " + item))
    .concat((plan.codexResultReviewPreview?.reviewChecklist || []).map((item) => "- Review checklist: " + item))
    .concat((plan.codexResultReviewPreview?.blockedReasons || []).map((item) => "- Blocker: " + item))
    .concat([
      "",
      "## Safe Desktop Runner Design",
      "- Phase: " + (plan.safeDesktopRunnerDesign?.phase || WORKFORCE_PLAN_SAFE_DESKTOP_RUNNER_DESIGN_PHASE),
      "- Mode: " + (plan.safeDesktopRunnerDesign?.mode || "safe-desktop-runner-design-only"),
      "- Runner implemented: " + Boolean(plan.safeDesktopRunnerDesign?.runnerImplemented),
      "- Runner enabled: " + Boolean(plan.safeDesktopRunnerDesign?.runnerEnabled),
      "- Codex CLI invocation enabled: " + Boolean(plan.safeDesktopRunnerDesign?.codexCliInvocationEnabled),
      "- Execution enabled: " + Boolean(plan.safeDesktopRunnerDesign?.executionEnabled),
      "- Design only: " + (plan.safeDesktopRunnerDesign?.designOnly !== false),
    ])
    .concat((plan.safeDesktopRunnerDesign?.requiredBeforeImplementation || []).map((item) => "- Required before implementation: " + item))
    .concat((plan.safeDesktopRunnerDesign?.forbiddenByDefault || []).map((item) => "- Forbidden by default: " + item))
    .concat((plan.safeDesktopRunnerDesign?.blockedReasons || []).map((item) => "- Blocker: " + item))
    .concat([
      "",
      "## Plan State / HUD",
      "- Current state: " + (plan.planState?.current || "n/a"),
      "- Lifecycle status: " + (plan.planState?.lifecycleStatus || "n/a"),
      "- Workflow run handoff: " + (plan.planState?.workflowRunHandoff?.status || "n/a"),
      "- Lifecycle preview: " + (plan.lifecyclePreview?.current || "n/a"),
      "",
      "## Review Package Preview",
      "- Phase: " + (plan.reviewPackagePreview?.phase || WORKFORCE_PLAN_REVIEW_APPROVAL_PHASE),
      "- Status: " + (plan.reviewPackagePreview?.status || "n/a"),
      "- Clarification coverage: " + (plan.reviewPackagePreview?.summary?.clarificationCoverage || "n/a"),
      "- Workflow run handoff: " + (plan.reviewPackagePreview?.disabledWorkflowRunHandoff?.status || "disabled"),
      "",
      "## Human Approval Gate Preview",
      "- Status: " + (plan.approvalGatePreview?.status || "waiting-human-review"),
      "- Decision: " + (plan.approvalGatePreview?.currentDecision || "n/a"),
      "- Workflow run enabled: " + Boolean(plan.approvalGatePreview?.workflowRunEnabled),
    ])
    .concat([
      "",
      "## Tasks",
    ])
    .concat((plan.taskBreakdown || []).map((item) => "- " + item.taskId + " / " + item.role + ": " + item.description))
    .concat([
      "",
      "## Deliverables",
    ])
    .concat((plan.deliverables || []).map((item) => "- " + item.title + ": " + item.description + " (" + item.ownerRole + ")"))
    .concat([
      "",
      "## Acceptance Criteria",
    ])
    .concat((plan.acceptanceCriteria || []).map((item) => "- " + item))
    .concat([
      "",
      "## Risks",
    ])
    .concat((plan.risks || []).map((item) => "- " + item))
    .concat([
      "",
      "## Next Actions",
    ])
    .concat((plan.nextActions || []).map((item) => "- " + item));

  return lines.join("\n");
}

function toPlanSummary(plan) {
  return {
    planId: plan.planId,
    workforceId: plan.workforceId,
    goal: plan.goal,
    summary: plan.summary,
    planVersion: plan.planVersion,
    createdAt: plan.createdAt,
    savedAt: plan.savedAt,
    taskCount: plan.taskBreakdown?.length ?? 0,
    roleCount: plan.roles?.length ?? 0,
    selectedTemplate: plan.selectedTemplate?.name || plan.templateContext?.selectedTemplateName || "n/a",
    execution: "enabled",
    lifecycleState: plan.lifecyclePreview?.current || plan.planState?.current || "draft",
    lifecycleStatus: plan.planState?.lifecycleStatus || plan.lifecyclePreview?.current || "draft",
    answeredClarificationCount: plan.clarificationAnswers?.length ?? 0,
    unresolvedClarificationCount: plan.unresolvedClarifications?.length ?? 0,
    reviewPackageStatus: plan.reviewPackagePreview?.status || "ready-for-human-review",
    approvalGateStatus: plan.approvalGatePreview?.status || "waiting-human-review",
    approvalDecision: plan.approvalGatePreview?.currentDecision || null,
  };
}

function normalizeClarificationAnswers(answers) {
  const items = Array.isArray(answers) ? answers : [];
  return items
    .map((item) => ({
      questionId: String(item?.questionId || "").trim(),
      answer: String(item?.answer || "").trim().slice(0, 1_000),
      answeredAt: item?.answeredAt || new Date().toISOString(),
      previewOnly: false,
    }))
    .filter((item) => item.questionId && item.answer);
}

function normalizeLifecycleState(state) {
  const value = String(state || "").trim();
  const allowed = ["draft", "clarified", "saved", "exported", "handoff-disabled", "consensus_ready", "export_ready", "archived"];
  if (!allowed.includes(value)) {
    throw createStoreError("WORKFORCE_LIFECYCLE_STATE_INVALID", "Workforce lifecycle state is invalid.", {
      userMessage: "Workforce lifecycle state is outside the allowed preview states.",
      allowed,
      state: value,
    });
  }
  return value;
}

function applyClarificationAnswers(taskPackage, answers, updatedAt) {
  const clarificationSummary = createPackageClarificationSummary(taskPackage.clarifyQuestions || [], answers);
  const next = redactSecrets({
    ...taskPackage,
    clarificationAnswers: answers,
    answeredClarifications: clarificationSummary.answeredClarifications,
    unresolvedClarifications: clarificationSummary.unresolvedClarifications,
    lifecyclePreview: createUpdatedLifecycle(taskPackage.lifecyclePreview, "clarified", "Clarification answers saved in preview store.", updatedAt),
  });
  next.workforceHudPreview = createPackageHudPreview(next);
  next.exportableJson = redactSecrets({
    ...(next.exportableJson || {}),
    clarificationAnswers: next.clarificationAnswers,
    answeredClarifications: next.answeredClarifications,
    unresolvedClarifications: next.unresolvedClarifications,
    lifecyclePreview: next.lifecyclePreview,
    executionReadinessPreflight: next.executionReadinessPreflight,
    externalOmxRunnerDesign: next.externalOmxRunnerDesign,
    runnerRequestQueuePreview: next.runnerRequestQueuePreview,
    executionApprovalRecordPreview: next.executionApprovalRecordPreview,
    externalRunnerProtocolFreeze: next.externalRunnerProtocolFreeze,
    agentWorkforcePreviewFinalUxSeal: next.agentWorkforcePreviewFinalUxSeal,
    codexDesktopHandoffPack: next.codexDesktopHandoffPack,
    manualCodexExecutionLoop: next.manualCodexExecutionLoop,
    codexResultReviewPreview: next.codexResultReviewPreview,
    safeDesktopRunnerDesign: next.safeDesktopRunnerDesign,
    workforceHudPreview: next.workforceHudPreview,
    planState: updatePlanStateCurrent(next.planState || next.exportableJson?.planState, "clarified"),
  });
  next.handoffPackageManifest = normalizeHandoffPackageManifest(next.handoffPackageManifest || next.exportableJson?.handoffPackageManifest, next);
  next.exportableJson.handoffPackageManifest = next.handoffPackageManifest;
  next.planState = next.exportableJson.planState;
  refreshReviewAndApprovalPreviews(next, updatedAt);
  next.markdown = formatTaskPackageMarkdown({ plan: next, planId: next.planId, savedAt: next.savedAt });
  return next;
}

function applyLifecycleState(taskPackage, state, note, updatedAt) {
  const next = redactSecrets({
    ...taskPackage,
    lifecyclePreview: createUpdatedLifecycle(taskPackage.lifecyclePreview, state, note || `Lifecycle preview moved to ${state}.`, updatedAt),
  });
  next.workforceHudPreview = createPackageHudPreview(next);
  next.exportableJson = redactSecrets({
    ...(next.exportableJson || {}),
    lifecyclePreview: next.lifecyclePreview,
    executionReadinessPreflight: next.executionReadinessPreflight,
    externalOmxRunnerDesign: next.externalOmxRunnerDesign,
    runnerRequestQueuePreview: next.runnerRequestQueuePreview,
    executionApprovalRecordPreview: next.executionApprovalRecordPreview,
    externalRunnerProtocolFreeze: next.externalRunnerProtocolFreeze,
    agentWorkforcePreviewFinalUxSeal: next.agentWorkforcePreviewFinalUxSeal,
    codexDesktopHandoffPack: next.codexDesktopHandoffPack,
    manualCodexExecutionLoop: next.manualCodexExecutionLoop,
    codexResultReviewPreview: next.codexResultReviewPreview,
    safeDesktopRunnerDesign: next.safeDesktopRunnerDesign,
    workforceHudPreview: next.workforceHudPreview,
    planState: updatePlanStateCurrent(next.planState || next.exportableJson?.planState, state === "archived" ? "export_ready" : state),
  });
  next.handoffPackageManifest = normalizeHandoffPackageManifest(next.handoffPackageManifest || next.exportableJson?.handoffPackageManifest, next);
  next.exportableJson.handoffPackageManifest = next.handoffPackageManifest;
  next.planState = next.exportableJson.planState;
  refreshReviewAndApprovalPreviews(next, updatedAt);
  next.markdown = formatTaskPackageMarkdown({ plan: next, planId: next.planId, savedAt: next.savedAt });
  return next;
}

function applyApprovalGateDecision(taskPackage, input, updatedAt) {
  const decision = normalizeApprovalDecision(input.decision);
  const reviewer = String(input.reviewer || input.approver || "human-reviewer").trim().slice(0, 120) || "human-reviewer";
  const note = String(input.note || "").trim().slice(0, 1_000);
  const base = refreshReviewAndApprovalPreviews(redactSecrets({ ...taskPackage }), updatedAt);
  const history = Array.isArray(base.approvalGatePreview?.decisionHistory)
    ? base.approvalGatePreview.decisionHistory
    : [];
  const decisionEvent = {
    decision,
    reviewer,
    note,
    decidedAt: updatedAt,
    previewOnly: false,
    executionEnabled: true,
    workflowRun: false,
    projectFileWrites: false,
  };
  const statusByDecision = {
    "approved-preview": "approved-preview-recorded",
    "changes-requested": "changes-requested-recorded",
    "rejected-preview": "rejected-preview-recorded",
  };
  const approvalGatePreview = redactSecrets({
    ...base.approvalGatePreview,
    status: statusByDecision[decision],
    currentDecision: decision,
    reviewer,
    note,
    decidedAt: updatedAt,
    persisted: true,
    executionEnabled: true,
    workflowRunEnabled: true,
    projectFileWrites: false,
    decisionHistory: [...history, decisionEvent],
  });
  const next = redactSecrets({
    ...base,
    approvalGatePreview,
    eventLedgerPreview: appendEventLedgerEvent(
      base.eventLedgerPreview,
      "workforce.approval.recorded",
      updatedAt,
      `Approval gate decision ${decision} recorded as preview metadata.`,
    ),
    lifecyclePreview: createUpdatedLifecycle(
      base.lifecyclePreview,
      "handoff-disabled",
      "Human approval gate preview recorded; workflow run remains disabled.",
      updatedAt,
    ),
  });
  next.workforceHudPreview = createPackageHudPreview(next);
  next.exportableJson = redactSecrets({
    ...(next.exportableJson || {}),
    approvalGatePreview,
    eventLedgerPreview: next.eventLedgerPreview,
    lifecyclePreview: next.lifecyclePreview,
    executionReadinessPreflight: next.executionReadinessPreflight,
    externalOmxRunnerDesign: next.externalOmxRunnerDesign,
    runnerRequestQueuePreview: next.runnerRequestQueuePreview,
    executionApprovalRecordPreview: next.executionApprovalRecordPreview,
    externalRunnerProtocolFreeze: next.externalRunnerProtocolFreeze,
    agentWorkforcePreviewFinalUxSeal: next.agentWorkforcePreviewFinalUxSeal,
    codexDesktopHandoffPack: next.codexDesktopHandoffPack,
    manualCodexExecutionLoop: next.manualCodexExecutionLoop,
    codexResultReviewPreview: next.codexResultReviewPreview,
    safeDesktopRunnerDesign: next.safeDesktopRunnerDesign,
    workforceHudPreview: next.workforceHudPreview,
    planState: updatePlanStateCurrent(next.planState || next.exportableJson?.planState, "handoff-disabled"),
  });
  next.handoffPackageManifest = normalizeHandoffPackageManifest(next.handoffPackageManifest || next.exportableJson?.handoffPackageManifest, next);
  next.exportableJson.handoffPackageManifest = next.handoffPackageManifest;
  next.planState = next.exportableJson.planState;
  refreshReviewAndApprovalPreviews(next, updatedAt);
  next.markdown = formatTaskPackageMarkdown({ plan: next, planId: next.planId, savedAt: next.savedAt });
  return next;
}

function refreshReviewAndApprovalPreviews(taskPackage, updatedAt) {
  taskPackage.externalOmxRunnerDesign = normalizeExternalOmxRunnerDesign(taskPackage.externalOmxRunnerDesign);
  taskPackage.runnerRequestQueuePreview = normalizeRunnerRequestQueuePreview(taskPackage.runnerRequestQueuePreview);
  taskPackage.executionApprovalRecordPreview = normalizeExecutionApprovalRecordPreview(taskPackage.executionApprovalRecordPreview);
  taskPackage.externalRunnerProtocolFreeze = normalizeExternalRunnerProtocolFreeze(taskPackage.externalRunnerProtocolFreeze);
  taskPackage.agentWorkforcePreviewFinalUxSeal = normalizeAgentWorkforcePreviewFinalUxSeal(taskPackage.agentWorkforcePreviewFinalUxSeal);
  taskPackage.codexDesktopHandoffPack = normalizeCodexDesktopHandoffPack(taskPackage.codexDesktopHandoffPack || taskPackage.exportableJson?.codexDesktopHandoffPack, taskPackage);
  taskPackage.manualCodexExecutionLoop = normalizeManualCodexExecutionLoop(taskPackage.manualCodexExecutionLoop || taskPackage.exportableJson?.manualCodexExecutionLoop);
  taskPackage.codexResultReviewPreview = normalizeCodexResultReviewPreview(taskPackage.codexResultReviewPreview || taskPackage.exportableJson?.codexResultReviewPreview);
  taskPackage.safeDesktopRunnerDesign = normalizeSafeDesktopRunnerDesign(taskPackage.safeDesktopRunnerDesign || taskPackage.exportableJson?.safeDesktopRunnerDesign);
  taskPackage.handoffPackageManifest = normalizeHandoffPackageManifest(taskPackage.handoffPackageManifest || taskPackage.exportableJson?.handoffPackageManifest, taskPackage);
  const requestedReview = appendEventLedgerEvent(
    taskPackage.eventLedgerPreview,
    "workforce.review.requested",
    updatedAt,
    `Review package requested for plan ${taskPackage.planId}.`,
  );
  taskPackage.eventLedgerPreview = requestedReview;
  const refreshedReview = createPackageReviewPackagePreview({
    source: taskPackage.reviewPackagePreview || taskPackage.exportableJson?.reviewPackagePreview,
    plan: taskPackage,
    planId: taskPackage.planId,
    savedAt: taskPackage.savedAt || updatedAt,
  });
  const refreshedApproval = createPackageApprovalGatePreview({
    source: taskPackage.approvalGatePreview || taskPackage.exportableJson?.approvalGatePreview,
    plan: taskPackage,
    planId: taskPackage.planId,
    updatedAt,
  });
  taskPackage.reviewPackagePreview = refreshedReview;
  taskPackage.approvalGatePreview = refreshedApproval;
  taskPackage.workforceHudPreview = createPackageHudPreview(taskPackage);
  taskPackage.exportableJson = redactSecrets({
    ...(taskPackage.exportableJson || {}),
    reviewPackagePreview: refreshedReview,
    approvalGatePreview: refreshedApproval,
    eventLedgerPreview: taskPackage.eventLedgerPreview,
    executionReadinessPreflight: taskPackage.executionReadinessPreflight,
    externalOmxRunnerDesign: taskPackage.externalOmxRunnerDesign,
    runnerRequestQueuePreview: taskPackage.runnerRequestQueuePreview,
    executionApprovalRecordPreview: taskPackage.executionApprovalRecordPreview,
    externalRunnerProtocolFreeze: taskPackage.externalRunnerProtocolFreeze,
    agentWorkforcePreviewFinalUxSeal: taskPackage.agentWorkforcePreviewFinalUxSeal,
    codexDesktopHandoffPack: taskPackage.codexDesktopHandoffPack,
    manualCodexExecutionLoop: taskPackage.manualCodexExecutionLoop,
    codexResultReviewPreview: taskPackage.codexResultReviewPreview,
    safeDesktopRunnerDesign: taskPackage.safeDesktopRunnerDesign,
    handoffPackageManifest: taskPackage.handoffPackageManifest,
    workforceHudPreview: taskPackage.workforceHudPreview,
  });
  return taskPackage;
}

function createPackageReviewPackagePreview({ source, plan, planId, savedAt }) {
  const base = source && typeof source === "object" ? source : {};
  const clarifyQuestions = Array.isArray(plan.clarifyQuestions) ? plan.clarifyQuestions : [];
  const answeredClarifications = Array.isArray(plan.answeredClarifications) ? plan.answeredClarifications : [];
  const unresolvedClarifications = Array.isArray(plan.unresolvedClarifications) ? plan.unresolvedClarifications : [];
  const consensusPreview = Array.isArray(plan.consensusPreview) ? plan.consensusPreview : [];
  const acceptanceCriteria = Array.isArray(plan.acceptanceCriteria) ? plan.acceptanceCriteria : [];
  const risks = Array.isArray(plan.risks) ? plan.risks : [];
  const answeredCount = answeredClarifications.length;
  const totalClarifications = clarifyQuestions.length || answeredCount + unresolvedClarifications.length;
  const unresolvedCount = unresolvedClarifications.length;
  return redactSecrets({
    ...base,
    phase: WORKFORCE_PLAN_REVIEW_APPROVAL_PHASE,
    status: unresolvedCount > 0 ? "needs-human-review" : "ready-for-human-review",
    title: base.title || "Agent Workforce review package preview",
    generatedAt: base.generatedAt || plan.createdAt || savedAt,
    savedAt,
    planId,
    workforceId: plan.workforceId,
    previewOnly: false,
    persisted: true,
    executionEnabled: true,
    workflowRunEnabled: true,
    projectFileWrites: false,
    summary: {
      ...(base.summary || {}),
      workforceId: plan.workforceId,
      goal: plan.goal,
      planVersion: plan.planVersion,
      lifecycleStatus: plan.planState?.lifecycleStatus || plan.lifecyclePreview?.current || "saved",
      clarificationCoverage: `${answeredCount}/${totalClarifications} answered`,
      unresolvedClarificationCount: unresolvedCount,
      consensusRoles: consensusPreview.map((item) => item.role).filter(Boolean),
    },
    packageSections: [
      {
        sectionId: "goal-and-scope",
        title: "Goal and scope",
        items: [
          plan.summary || `Agent Workforce plan preview for: ${plan.goal}`,
          `Clarifications answered: ${answeredCount}`,
          `Clarifications unresolved: ${unresolvedCount}`,
        ],
      },
      {
        sectionId: "consensus",
        title: "Planner / Architect / Critic consensus",
        items: consensusPreview.map((item) => `${item.role}: ${item.recommendation || item.viewpoint || ""}`),
      },
      {
        sectionId: "acceptance-and-risks",
        title: "Acceptance and risks",
        items: [...acceptanceCriteria, ...risks],
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
  });
}

function createPackageApprovalGatePreview({ source, plan, planId, updatedAt }) {
  const base = source && typeof source === "object" ? source : {};
  const decisionHistory = Array.isArray(base.decisionHistory) ? base.decisionHistory : [];
  const currentDecision = base.currentDecision || null;
  const unresolvedCount = Array.isArray(plan.unresolvedClarifications) ? plan.unresolvedClarifications.length : 0;
  const consensusCount = Array.isArray(plan.consensusPreview) ? plan.consensusPreview.length : 0;
  return redactSecrets({
    ...base,
    phase: WORKFORCE_PLAN_REVIEW_APPROVAL_PHASE,
    status: base.status || (currentDecision ? "approval-gate-recorded" : "waiting-human-review"),
    planId,
    updatedAt,
    previewOnly: false,
    persisted: true,
    executionEnabled: true,
    workflowRunEnabled: true,
    projectFileWrites: false,
    requiredApprovals: ["human-review"],
    allowedDecisions: ["approved-preview", "changes-requested", "rejected-preview"],
    currentDecision,
    reviewer: base.reviewer || null,
    decidedAt: base.decidedAt || null,
    decisionHistory,
    gateChecks: [
      {
        checkId: "clarifications-reviewed",
        label: "Clarifications reviewed",
        satisfied: unresolvedCount === 0,
        previewOnly: false,
      },
      {
        checkId: "consensus-reviewed",
        label: "Consensus reviewed",
        satisfied: consensusCount >= 3,
        previewOnly: false,
      },
      {
        checkId: "execution-disabled",
        label: "Execution remains disabled",
        satisfied: true,
        previewOnly: false,
      },
    ],
    disabledActions: ["agent-execution", "workflow-run", "worktree-creation", "project-file-write"],
    nextDecision: "A human can record a preview decision, but it will not execute or hand off the plan.",
  });
}

function normalizeApprovalDecision(decision) {
  const value = String(decision || "").trim();
  const allowed = ["approved-preview", "changes-requested", "rejected-preview"];
  if (!allowed.includes(value)) {
    throw createStoreError("WORKFORCE_APPROVAL_DECISION_INVALID", "Workforce approval gate decision is invalid.", {
      userMessage: "Workforce approval gate decision is outside the allowed preview decisions.",
      allowed,
      decision: value,
    });
  }
  return value;
}

function createPackageClarificationSummary(questions = [], answers = []) {
  const answerByQuestion = new Map((Array.isArray(answers) ? answers : []).map((item) => [item.questionId, item]));
  const answeredClarifications = (Array.isArray(questions) ? questions : [])
    .filter((question) => answerByQuestion.has(question.questionId))
    .map((question) => {
      const answer = answerByQuestion.get(question.questionId);
      return {
        questionId: question.questionId,
        topic: question.topic,
        question: question.question,
        answer: answer.answer,
        answeredAt: answer.answeredAt || null,
        previewOnly: false,
      };
    });
  const unresolvedClarifications = (Array.isArray(questions) ? questions : [])
    .filter((question) => question.required && !answerByQuestion.has(question.questionId))
    .map((question) => ({
      questionId: question.questionId,
      topic: question.topic,
      question: question.question,
      required: true,
      previewOnly: false,
    }));
  return { answeredClarifications, unresolvedClarifications };
}

function createDefaultLifecyclePreview(savedAt) {
  return {
    current: "saved",
    persisted: true,
    history: [
      {
        state: "saved",
        at: savedAt,
        note: "Plan package saved for preview review.",
      },
    ],
    allowedTransitions: ["draft", "clarified", "saved", "exported", "handoff-disabled", "consensus_ready", "export_ready", "archived"],
    executionEnabled: true,
    workflowRunEnabled: true,
  };
}

function createUpdatedLifecycle(lifecycle, state, note, updatedAt) {
  const base = lifecycle && typeof lifecycle === "object" ? lifecycle : createDefaultLifecyclePreview(updatedAt);
  const history = Array.isArray(base.history) ? base.history : [];
  return {
    ...base,
    current: state,
    persisted: true,
    history: [
      ...history,
      {
        state,
        at: updatedAt,
        note,
      },
    ],
    allowedTransitions: ["draft", "clarified", "saved", "exported", "handoff-disabled", "consensus_ready", "export_ready", "archived"],
    executionEnabled: true,
    workflowRunEnabled: true,
  };
}

function updatePlanStateCurrent(planState, state) {
  const current = ["draft", "clarified", "consensus_ready", "export_ready"].includes(state) ? state : "export_ready";
  const lifecycleStatus = ["draft", "clarified", "saved", "exported", "handoff-disabled"].includes(state)
    ? state
    : (state === "consensus_ready" ? "clarified" : "saved");
  return {
    ...(planState || {}),
    current,
    lifecycleStatus,
    lifecycleStatuses: ["draft", "clarified", "saved", "exported", "handoff-disabled"],
    states: ["draft", "clarified", "consensus_ready", "export_ready", "archived"],
    previewOnly: false,
    drivesExecution: false,
    workflowRunHandoff: {
      status: "disabled",
      lifecycleStatus: "handoff-disabled",
      implemented: false,
      enabled: false,
      reason: "Phase140A persists lifecycle preview state only and does not call POST /workflow/run.",
    },
  };
}

async function readStore(storePath) {
  try {
    const parsed = JSON.parse(await readFile(storePath, "utf8"));
    return {
      version: parsed.version === STORE_VERSION ? parsed.version : STORE_VERSION,
      updatedAt: parsed.updatedAt,
      plans: Array.isArray(parsed.plans) ? parsed.plans.map(redactSecrets) : [],
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        version: STORE_VERSION,
        updatedAt: null,
        plans: [],
      };
    }
    throw error;
  }
}

async function writeStore(storePath, store) {
  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(storePath, `${JSON.stringify(redactSecrets(store), null, 2)}\n`, "utf8");
}

function redactSecrets(value) {
  if (typeof value === "string") {
    return value
      .replace(/AIza[0-9A-Za-z_-]{12,}/g, "AIza****redacted")
      .replace(/sk-[0-9A-Za-z_-]{8,}/g, "sk-****redacted")
      .replace(/nvapi-[0-9A-Za-z_-]{8,}/g, "nvapi-****redacted")
      .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*["']?[^"'\s]+/gi, "$1=****redacted");
  }

  if (Array.isArray(value)) {
    return value.map(redactSecrets);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactSecrets(item)]));
  }

  return value;
}

function createStoreSafety() {
  return {
    devOnlyLocalStorage: true,
    realLlmCalls: false,
    codeExecution: false,
    projectFileWrites: false,
    workflowRun: false,
    secretValuesStored: false,
  };
}

function createStoreError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.category = "validation";
  error.details = details;
  return error;
}







