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

export function normalizeExecutionReadinessPreflight(source) {
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

export function normalizeExternalOmxRunnerDesign(source) {
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

export function normalizeRunnerRequestQueuePreview(source) {
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

export function normalizeExecutionApprovalRecordPreview(source) {
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

export function normalizeExternalRunnerProtocolFreeze(source) {
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

export function normalizeAgentWorkforcePreviewFinalUxSeal(source) {
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

export function normalizeTemplateContext(source, selectedTemplate) {
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

export function normalizeProductTemplatesPreview(source, selectedTemplate) {
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
