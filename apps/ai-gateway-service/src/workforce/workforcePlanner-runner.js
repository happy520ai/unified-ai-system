export function createExecutionReadinessPreflight() {
  return {
    phase: "phase-144a-execution-readiness-preflight",
    mode: "preview-only",
    executionEnabled: false,
    overallStatus: "gated",
    checks: [
      {
        name: "humanApproval",
        status: "implemented-gated",
        required: true,
        reason: "implemented: executionApprovalGate is consumed by the controlled executor; execution stays behind WORKFORCE_EXECUTION_ENABLED",
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
        status: "implemented-gated",
        required: true,
        reason: "implemented: worktreeIsolation creates real git worktrees in the controlled executor; enabled only with real execution",
      },
      {
        name: "taskClaimToken",
        status: "pass",
        required: true,
        reason: "implemented: taskClaimTokenService issues single-use TTL-bound claim tokens",
      },
      {
        name: "logRedaction",
        status: "pass",
        required: true,
        reason: "preview output must remain redacted",
      },
      {
        name: "cancellableExecution",
        status: "pass",
        required: true,
        reason: "implemented: executionLifecycleService provides AbortController-backed cancel",
      },
      {
        name: "evidenceRequired",
        status: "pass",
        required: true,
        reason: "preview evidence is generated, but execution evidence is not applicable",
      },
    ],
    blockedReasons: [
      "real execution is implemented but default-off: enable WORKFORCE_EXECUTION_ENABLED=true and provide a consumable execution approval",
    ],
    implementedCapabilities: {
      taskClaimToken: "workforce/taskClaimTokenService.js (single-use, TTL-bound)",
      cancellableExecution: "workforce/executionLifecycleService.js (AbortController-backed)",
      workflowRunHandoff: "workforce/workflowRunHandoff.js (claim-token gated, explicit-invocation only)",
      humanApprovalGate: "workforce/executionApprovalGate.js (file-persisted, TTL, consumed by workforceControlledExecutor)",
      worktreeIsolation: "workforce/worktreeIsolation.js (real git worktrees, used by workforceControlledExecutor)",
      controlledExecutionLine: "workforce/workforceControlledExecutor.js (approval → worktree → lifecycle → role executors → evidence)",
    },
    recommendedNextStep: "Set WORKFORCE_EXECUTION_ENABLED=true on an explicitly approved plan to run the gated execution line",
  };
}

export function createExternalOmxRunnerDesign() {
  return {
    phase: "phase-145a-external-omx-runner-design",
    mode: "external-runner-design",
    runnerEnabled: false,
    executionEnabled: false,
    designOnly: true,
    proposedEndpoints: [
      {
        method: "POST",
        path: "/workforce/omx/handoff",
        purpose: "Generate an OMX-compatible task package only",
        execution: "disabled",
      },
      {
        method: "POST",
        path: "/workforce/omx/run-request",
        purpose: "Create a future external runner request, but do not execute it",
        execution: "disabled",
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
      "Real Agent execution stays behind WORKFORCE_EXECUTION_ENABLED=true",
      "Workflow run handoff is disabled",
      "Worktree creation is disabled",
      "Approval-preview is not execution approval",
    ],
  };
}

export function createRunnerRequestQueuePreview() {
  return {
    phase: "phase-146a-runner-request-review-queue",
    mode: "review-queue-preview",
    queueEnabled: false,
    executionEnabled: false,
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
      externalRunnerDispatchEnabled: false,
      approvalPreviewIsExecutionPermission: false,
    },
    blockedReasons: [
      "runner queue is preview-only",
      "real execution is disabled",
      "external runner dispatch is disabled",
      "human approval preview is not execution permission",
    ],
    recommendedNextStep: "Record approval decision preview before any future runner request can be considered",
  };
}

export function createExecutionApprovalRecordPreview() {
  return {
    phase: "phase-147a-execution-approval-record",
    mode: "approval-record-preview",
    approvalRecordEnabled: false,
    executionEnabled: false,
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
      "execution requires a consumed executionApprovalGate record (not the preview approval)",
      "real external runner is disabled",
    ],
    recommendedNextStep: "Freeze external runner protocol before implementing any real runner",
  };
}

export function createExternalRunnerProtocolFreeze() {
  return {
    phase: "phase-148a-external-runner-protocol-freeze",
    mode: "protocol-freeze",
    protocolVersion: "preview-1",
    frozen: true,
    runnerEnabled: false,
    executionEnabled: false,
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
      "execution requires a consumed executionApprovalGate record (not the preview approval)",
      "default OpenRouter /chat lane is active",
    ],
    requiredBeforeRealExecution: [
      "explicit user approval for real execution line",
      "external runner protocol implementation review",
      "clean git workspace check",
      "worktree isolation implementation",
      "task claim token implementation",
      "log redaction implementation",
            "per-task evidence capture",
      "security review",
    ],
    blockedReasons: [
      "real Agent execution is disabled",
      "external runner dispatch is disabled",
      "workflow run handoff is explicit-invocation only (claim-token gated)",
      "execution requires a consumed executionApprovalGate record (not the preview approval)",
    ],
  };
}

export function createAgentWorkforcePreviewFinalUxSeal() {
  return {
    phase: "phase-149a-agent-workforce-preview-final-ux-seal",
    mode: "preview-final-ux-seal",
    sealed: true,
    previewOnly: true,
    executionEnabled: false,
    runnerEnabled: false,
    workflowRunEnabled: false,
    externalRunnerDispatchEnabled: false,
    omxExecutionEnabled: false,
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
      "external runner dispatch is disabled",
      "workflow run handoff is explicit-invocation only (claim-token gated)",
      "execution requires a consumed executionApprovalGate record (not the preview approval)",
    ],
    recommendedNextStep: "Agent Workforce is preview-only.",
  };
}
