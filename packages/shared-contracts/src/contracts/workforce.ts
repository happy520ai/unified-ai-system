import type { ContractMetadata, RequestContext, ResultEnvelope } from "./common.js";
import type { WorkflowRunResponse, WorkflowRunStatus } from "./workflow.js";

export type WorkforceExecutionStatus = "pending" | "running" | "paused" | "completed" | "failed" | "cancelled" | "force_stopped";
export interface WorkforceWorkflowRecoveryRequest { executionId: string; taskId: string; workflowId: string }
/** Joins the original parent task to its existing workflow journal and artifact verification. */
export interface WorkforceWorkflowHandoffInspection {
  workflowId: string;
  taskId: string | null;
  roleId: string;
  originalPlanId: string;
  status: WorkflowRunStatus | "not_observed";
  originVerified: boolean;
  parentExecutionId?: string;
  artifactVerified?: boolean | null;
  artifactError?: string | null;
  canResume: boolean;
  outcomeUnknown?: boolean;
  error?: { code: string; approvalId?: string } | null;
  resumeAction?: "run-safe-remaining-stages" | "recheck-governance-only" | null;
  result: WorkflowRunResponse | null;
}
export interface WorkforceExecutionStatusResponse {
  /** Historical lifecycle field name; this value is the requested executionId. */
  planId: string;
  status: WorkforceExecutionStatus;
  workflowHandoff?: WorkforceWorkflowHandoffInspection | null;
}
export type WorkforceWorkflowRecoveryResponse = WorkforceWorkflowHandoffInspection & {
  status: "completed"; taskId: string; parentExecutionId: string; parentExecutionStatus: WorkforceExecutionStatus;
  originVerified: true; artifactVerified: true; result: WorkflowRunResponse;
  parentExecutionResumed: false; employeeRolesRerun: false;
};
export type WorkforceExecutionStatusResult = ResultEnvelope<WorkforceExecutionStatusResponse>;
export type WorkforceWorkflowRecoveryResult = ResultEnvelope<WorkforceWorkflowRecoveryResponse>;

/** Frozen intent for the existing managed local report workflow; not execution authority. */
export interface WorkforceWorkflowHandoffReview {
  readonly version: 1;
  readonly kind: "local-knowledge-report";
  readonly roleId: string;
  readonly goal: string;
  readonly query: string;
  readonly topK: number;
  readonly sourceIds: readonly string[];
  /** Server-owned output configuration identity, encoded as lowercase SHA-256 hex. */
  readonly outputRootHash: string;
  readonly reviewHash: string;
}

/** Server-configured, exact-file code delivery intent. This DTO grants no execution authority. */
export interface WorkforceCodeDeliveryProfileInput {
  readonly version: 1;
  readonly mode: "forge-owned-worktree-artifact";
  readonly profileId: string;
  readonly projectId: string;
  readonly baselineRevision: string;
  readonly roleId: "backend-engineer";
  readonly readPaths: readonly string[];
  readonly writePaths: readonly string[];
  readonly verification: {
    readonly verificationId: string;
    readonly command: string;
    readonly immutableTests: readonly { readonly path: string; readonly sha256: string }[];
    readonly image: string;
    readonly workspaceMode: "ro";
    readonly networkAccess: false;
    readonly timeoutMs: number;
    readonly maxMemoryMB: number;
    readonly maxOutputBytes: number;
    readonly pidsLimit: number;
    readonly cpus: number;
  };
  readonly artifactLimits: {
    readonly maxChangedFiles: number;
    readonly maxFileBytes: number;
    readonly maxDiffBytes: number;
  };
}

export interface WorkforceCodeDeliveryProfile extends WorkforceCodeDeliveryProfileInput {
  readonly profileHash: string;
}

export interface WorkforceCodeDeliveryReview {
  readonly version: 1;
  readonly profile: WorkforceCodeDeliveryProfile;
  /** Configuration identity only; does not attest canonical filesystem ownership. */
  readonly configuredRepositoryHash: string;
  readonly roleProfileHash: string;
}

/** Preview never grants execution; each approval/run requires current private preflight. */
export interface WorkforceCodeDeliveryReadiness {
  readonly version: 1;
  readonly executionAllowed: false;
  readonly implementation: "unavailable" | "available";
  readonly container: "not-checked";
  readonly policy: "not-checked";
  readonly worktree: "not-created";
  readonly verification: "not-run";
}

/** Server-selected binding; none of these fields carry credential values. */
export interface WorkforceRoleExecutionBinding {
  readonly roleId: string;
  readonly employeeId: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly maxRequests: number;
  readonly maxInputTokens: number;
  readonly maxOutputTokens: number;
  readonly timeoutMs: number;
}

export interface WorkforceRoleExecutionProfileInput {
  readonly version: 1;
  readonly mode: "gateway-llm-required";
  readonly profileId: string;
  readonly maxTotalRequests: number;
  readonly maxConcurrentRoles: number;
  readonly bindings: readonly WorkforceRoleExecutionBinding[];
}

/** The full reviewed profile is retained alongside its canonical content hash. */
export interface WorkforceRoleExecutionProfile extends WorkforceRoleExecutionProfileInput {
  readonly profileHash: string;
}

/** A gateway-operation receipt, never a count of network retries or a vendor invoice. */
export interface WorkforceRoleContributionReceipt {
  readonly version: 1;
  readonly level: "gateway-provider-operation";
  readonly status: "succeeded" | "failed" | "blocked" | "cancelled" | "outcome_unknown";
  readonly executionMode: "fake" | "real" | "unknown";
  readonly gatewayRequestId: string | null;
  readonly providerId: string | null;
  readonly modelId: string | null;
  readonly providerCallAttempted: boolean | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly totalTokens: number | null;
  readonly estimatedCostUsd: number | null;
  readonly errorCode: string | null;
}

export interface WorkforceRoleContribution {
  readonly version: 1;
  readonly employeeId: string;
  readonly roleId: string;
  readonly governedAgentId: string;
  readonly agentRunId: string;
  readonly executionId: string;
  readonly taskId: string;
  readonly planId: string;
  readonly planDigest: string;
  readonly profileHash: string;
  readonly contributionText: string | null;
  readonly receipt: WorkforceRoleContributionReceipt;
}

/** Server-enrolled assignment; occupation and preview records are not runtime candidates. */
export interface WorkforceSelectionCandidate {
  readonly employeeId: string;
  readonly status: "enabled";
  readonly roleIds: readonly string[];
  readonly taskTypes: readonly string[];
  readonly providerId: string;
  readonly modelId: string;
  readonly priority: number;
  readonly limits: Pick<WorkforceRoleExecutionBinding, "maxRequests" | "maxInputTokens" | "maxOutputTokens" | "timeoutMs">;
}

/** Supplied by the trusted server after accepting evidence, never by a model or task request. */
export interface WorkforceSelectionQualification {
  readonly qualificationId: string;
  readonly employeeId: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly roleIds: readonly string[];
  readonly taskTypes: readonly string[];
  readonly status: "accepted";
  readonly origin: "synthetic" | "reviewed";
  readonly executionMode: "fake" | "real";
  readonly evidenceHash: string;
  readonly validUntil: string;
}

export interface WorkforceSelectionConfiguration {
  readonly version: 1;
  readonly catalogId: string;
  readonly catalogRevision: string;
  readonly maxCandidates: number;
  readonly maxSelectedRoles: number;
  readonly maxConcurrentRoles: number;
  readonly maxTotalRequests: number;
  readonly candidates: readonly unknown[];
  readonly qualifications: readonly unknown[];
}

export interface WorkforceSelectionTask {
  readonly taskType: string;
  readonly roleIds: readonly string[];
  readonly executionMode: "fake" | "real";
}

export interface WorkforceSelectionDecision extends WorkforceSelectionTask {
  readonly version: 1;
  readonly catalogHash: string;
  readonly selectionHash: string;
  readonly maxConcurrentRoles: number;
  readonly maxTotalRequests: number;
  readonly assignments: readonly {
    readonly binding: WorkforceRoleExecutionBinding;
    readonly qualification: WorkforceSelectionQualification;
  }[];
  readonly rejected: readonly { readonly employeeId: string; readonly reason: "not_enabled" | "not_qualified" | "not_selected" }[];
}

/** References actual contribution receipts without converting protocol success into a quality score. */
export interface WorkforceSelectionFeedback {
  readonly version: 1;
  readonly selectionHash: string;
  readonly catalogHash: string;
  readonly profileHash: string;
  readonly executionId: string;
  readonly roleId: string;
  readonly employeeId: string;
  readonly taskId: string;
  /** Request/usage counters stay in the existing linked contribution receipt. */
  readonly receipt: Pick<WorkforceRoleContributionReceipt, "status" | "executionMode" | "gatewayRequestId" |
    "providerId" | "modelId" | "providerCallAttempted" | "errorCode">;
  readonly contributionHash: string | null;
  readonly quality: "unassessed";
  readonly qualityScore: null;
}

export type WorkforceMode = "deterministic-plan-preview";

export interface WorkforceAgent {
  roleId: string;
  name: string;
  title: string;
  responsibility: string;
}

export interface WorkforceHealth {
  phase: "phase-102a-agent-workforce-skeleton";
  status: "ready";
  mode: WorkforceMode;
  ready: boolean;
  roleCount: number;
  safety: WorkforceSafety;
}

export interface WorkforceSafety {
  realLlmCalls: false;
  agentConcurrency: false;
  codeExecution: false;
  projectFileWrites: false;
  workflowRun: false;
  previewOnly: true;
}

export interface WorkforceAgentsResponse {
  phase: "phase-102a-agent-workforce-skeleton";
  mode: WorkforceMode;
  agents: WorkforceAgent[];
  safety: WorkforceSafety;
}

export interface WorkforcePlanRequest {
  context?: RequestContext;
  goal: string;
  selectedTemplate?: WorkforceProductTemplateId;
  templateId?: WorkforceProductTemplateId;
  clarificationAnswers?: WorkforceClarificationAnswer[];
  metadata?: ContractMetadata;
}

export type WorkforceProductTemplateId =
  | "feature-development"
  | "bug-fix"
  | "documentation"
  | "code-review"
  | "release-checklist"
  | "research-design-study";

export interface WorkforceSelectedTemplate {
  id: WorkforceProductTemplateId;
  name: string;
  description: string;
  defaultGoalPrompt: string;
  focusAreas: string[];
  sampleGoal?: string;
  expectedPlanSections?: string[];
  sampleAcceptanceChecklist?: string[];
  execution: "disabled";
  previewOnly: true;
}

export interface WorkforceTemplateContext {
  phase: "phase-153a-agent-workforce-product-template-pack";
  mode: "template-context-preview";
  selectedTemplateId: WorkforceProductTemplateId;
  selectedTemplateName: string;
  defaultGoalPrompt?: string;
  sampleGoal?: string;
  recommendedRoleTiers: Array<"Strategy" | "Architecture" | "Implementation Planning" | "Quality">;
  expectedOutputs: string[];
  focusAreas: string[];
  expectedPlanSections: string[];
  sampleAcceptanceChecklist: string[];
  affects?: string[];
  executionEnabled: false;
  externalRunnerDispatchEnabled: false;
  workflowRunEnabled: false;
  previewOnly: true;
  reason: string;
}

export interface WorkforceProductTemplatePreview {
  id: WorkforceProductTemplateId;
  name: string;
  description: string;
  defaultGoalPrompt: string;
  recommendedRoleTiers: Array<"Strategy" | "Architecture" | "Implementation Planning" | "Quality">;
  expectedOutputs: string[];
  focusAreas?: string[];
  sampleGoal: string;
  samplePrompts?: string[];
  expectedPlanSections: string[];
  sampleAcceptanceChecklist: string[];
  execution: "disabled";
}

export interface WorkforceProductTemplatesPreview {
  phase: "phase-153a-agent-workforce-product-template-pack";
  mode: "product-template-pack-preview";
  templatePackEnabled: true;
  executionEnabled: false;
  selectedTemplateId: WorkforceProductTemplateId;
  templates: WorkforceProductTemplatePreview[];
  demoGoals: Array<{
    templateId: WorkforceProductTemplateId;
    templateName: string;
    sampleGoal: string;
    samplePrompts?: string[];
    execution: "disabled";
  }>;
  blockedReasons: string[];
}

export interface WorkforceHandoffPackageManifest {
  phase: "phase-167a-export-handoff-package-manifest";
  mode: "handoff-package-manifest-preview";
  manifestEnabled: true;
  executionEnabled: false;
  runnerEnabled: false;
  workflowRunEnabled: false;
  packagePurpose: string;
  planMetadata: ContractMetadata;
  selectedTemplate: {
    id: WorkforceProductTemplateId | string;
    name: string;
  };
  includedSections: string[];
  reviewPackage: ContractMetadata;
  approvalPreview: {
    status: string;
    approvalPreviewIsExecutionPermission: false;
    executionEnabled: false;
  };
  omxHandoffPreview: {
    status: string;
    runsOhMyCodex: false;
    executionEnabled: false;
  };
  executionReadiness: {
    overallStatus: string;
    executionEnabled: false;
  };
  externalRunnerDisabledReasons: string[];
  blockedReasons: string[];
}

export interface WorkforceTask {
  taskId: string;
  roleId: string;
  role: string;
  title: string;
  description: string;
  status: "planned";
  previewOnly: true;
}

export interface WorkforceRoleAssignment {
  roleId: string;
  role: string;
  responsibility: string;
  taskIds: string[];
}

export interface WorkforceRoleTier {
  tierId: "strategy" | "architecture" | "implementation-planning" | "quality";
  name: "Strategy" | "Architecture" | "Implementation Planning" | "Quality";
  purpose: string;
  previewOnly: true;
  workerExecution: false;
  roles: Array<{
    roleId: string;
    role: string;
    responsibility: string;
    taskIds: string[];
  }>;
}

export interface WorkforceDeliverable {
  deliverableId: string;
  title: string;
  description: string;
  ownerRole: string;
}

export interface WorkforceClarifyQuestion {
  questionId: string;
  topic: "goal" | "scope" | "technology_stack" | "acceptance" | "constraints";
  question: string;
  why: string;
  sampleAnswer: string;
  required: true;
}

export interface WorkforceClarificationAnswer {
  questionId: string;
  answer: string;
  answeredAt?: string | null;
  previewOnly: true;
}

export interface WorkforceAnsweredClarification {
  questionId: string;
  topic: WorkforceClarifyQuestion["topic"];
  question: string;
  answer: string;
  answeredAt?: string | null;
  previewOnly: true;
}

export interface WorkforceUnresolvedClarification {
  questionId: string;
  topic: WorkforceClarifyQuestion["topic"];
  question: string;
  required: true;
  previewOnly: true;
}

export interface WorkforceConsensusPreview {
  role: "Planner" | "Architect" | "Critic";
  viewpoint: string;
  concerns: string[];
  recommendation: string;
}

export interface WorkforceHookEventPreview {
  event: "beforePlan" | "afterPlan" | "beforeExport" | "beforeWorkflowRun";
  enabled: false;
  purpose: string;
  payloadSchema: string[];
}

export interface WorkforceEventLedgerPreview {
  eventName:
    | "workforce.plan.beforeCreate"
    | "workforce.plan.afterCreate"
    | "workforce.plan.beforeSave"
    | "workforce.plan.afterSave"
    | "workforce.plan.beforeExport"
    | "workforce.review.requested"
    | "workforce.approval.recorded"
    | "workforce.workflowRun.blocked"
    | "workforce.omxHandoff.generated";
  timestamp: string;
  payloadSummary: string;
  enabled: false;
  execution: "disabled";
  reason: "preview-only event ledger; no hook execution";
}

export interface WorkforcePlanState {
  current: "draft" | "clarified" | "consensus_ready" | "export_ready";
  lifecycleStatus: "draft" | "clarified" | "saved" | "exported" | "handoff-disabled";
  lifecycleStatuses: Array<"draft" | "clarified" | "saved" | "exported" | "handoff-disabled">;
  states: Array<"draft" | "clarified" | "consensus_ready" | "export_ready" | "archived">;
  previewOnly: true;
  drivesExecution: false;
  hud: {
    label: string;
    summary: string;
    blockers: string[];
    nextDecision: string;
  };
  workflowRunHandoff: {
    status: "module-only";
    lifecycleStatus: "handoff-disabled";
    implemented: true;
    runtimeConnected: false;
    enabled: false;
    enabledByDefault: false;
    reason: string;
  };
}

export interface WorkforceHudPreview {
  phase: "phase-143a-role-tier-event-ledger";
  status: "preview-only";
  planState: string;
  clarification: {
    answered: number;
    total: number;
  };
  consensus: {
    ready: boolean;
    roles: string[];
  };
  reviewPackage: {
    status: string;
  };
  approvalGate: {
    status: string;
    grantsExecution: false;
  };
  workflowHandoff: {
    status: "disabled";
    enabled: false;
  };
  omxHandoff: {
    status: "preview-only";
    executionEnabled: false;
  };
  execution: {
    status: "disabled";
    readiness?: "blocked" | "preview-blocked";
    realAgents: false;
    hooks: false;
    workflowRun: false;
    worktrees: false;
    projectFileWrites: false;
  };
}

export interface WorkforceExecutionReadinessPreflight {
  phase: "phase-144a-execution-readiness-preflight";
  mode: "preview-only";
  executionEnabled: false;
  overallStatus: "blocked" | "preview-blocked";
  checks: Array<{
    name:
      | "humanApproval"
      | "cleanGitWorkspace"
      | "secretsSafety"
      | "worktreeIsolation"
      | "taskClaimToken"
      | "logRedaction"
      | "cancellableExecution"
      | "evidenceRequired";
    status: "blocked" | "not_checked" | "pass";
    required: true;
    reason: string;
  }>;
  blockedReasons: string[];
  recommendedNextStep: string;
}

export interface WorkforceExternalOmxRunnerDesign {
  phase: "phase-145a-external-omx-runner-design";
  mode: "external-runner-design";
  runnerEnabled: false;
  executionEnabled: false;
  designOnly: true;
  proposedEndpoints: Array<{
    method: "POST";
    path: "/workforce/omx/handoff" | "/workforce/omx/run-request";
    purpose: string;
    execution: "disabled";
  }>;
  requiredPreflightChecks: WorkforceExecutionReadinessPreflight["checks"][number]["name"][];
  runnerContract: {
    requiresHumanApproval: true;
    requiresCleanGitWorkspace: true;
    requiresWorktreeIsolation: true;
    requiresTaskClaimToken: true;
    requiresLogRedaction: true;
    requiresCancellableState: true;
    requiresEvidence: true;
  };
  blockedReasons: string[];
}

export interface WorkforceRunnerRequestQueuePreview {
  phase: "phase-146a-runner-request-review-queue";
  mode: "review-queue-preview";
  queueEnabled: false;
  executionEnabled: false;
  requestState: "draft-review-only";
  allowedStates: Array<"draft-review-only" | "waiting-human-review" | "approved-preview" | "rejected-preview" | "blocked-preview">;
  queuePolicy: {
    requiresHumanReview: true;
    autoDispatchEnabled: false;
    externalRunnerDispatchEnabled: false;
    approvalPreviewIsExecutionPermission: false;
  };
  blockedReasons: string[];
  recommendedNextStep: string;
}

export interface WorkforceExecutionApprovalRecordPreview {
  phase: "phase-147a-execution-approval-record";
  mode: "approval-record-preview";
  approvalRecordEnabled: false;
  executionEnabled: false;
  approvalState: "not-approved-for-execution";
  allowedApprovalStates: Array<"not-approved-for-execution" | "approved-preview" | "rejected-preview" | "revoked-preview" | "expired-preview">;
  approvalPolicy: {
    requiresExplicitHumanApproval: true;
    approvalPreviewIsExecutionPermission: false;
    requiresTaskClaimToken: true;
    requiresFreshPreflight: true;
    requiresEvidencePlan: true;
  };
  recordFieldsPreview: string[];
  blockedReasons: string[];
  recommendedNextStep: string;
}

export interface WorkforceExternalRunnerProtocolFreeze {
  phase: "phase-148a-external-runner-protocol-freeze";
  mode: "protocol-freeze";
  protocolVersion: "preview-1";
  frozen: true;
  runnerEnabled: false;
  executionEnabled: false;
  designOnly: true;
  coveredCapabilities: string[];
  frozenInvariants: string[];
  requiredBeforeRealExecution: string[];
  blockedReasons: string[];
}

export interface WorkforcePreviewFinalUxSeal {
  phase: "phase-149a-agent-workforce-preview-final-ux-seal";
  mode: "preview-final-ux-seal";
  sealed: true;
  previewOnly: true;
  executionEnabled: false;
  runnerEnabled: false;
  workflowRunEnabled: false;
  externalRunnerDispatchEnabled: false;
  omxExecutionEnabled: false;
  coveredCapabilities: string[];
  userPath: string[];
  finalUiMessages: string[];
  blockedReasons: string[];
  recommendedNextStep: string;
}

export interface WorkforceCodexDesktopHandoffPack {
  phase: "phase-201a-codex-desktop-handoff-pack";
  mode: "codex-desktop-handoff-preview";
  handoffEnabled: true;
  manualOnly: true;
  codexExecutionEnabled: false;
  autoDispatchEnabled: false;
  target: "desktop-codex-or-codex-cli";
  copyPasteRequired: true;
  taskGoal: string;
  contextSummary: string[];
  allowedFiles: string[];
  forbiddenActions: string[];
  recommendedFiles: string[];
  implementationConstraints: string[];
  verificationCommands: string[];
  evidenceExpectations: string[];
  responseFormat: string[];
  sections: Array<
    | "taskGoal"
    | "contextSummary"
    | "allowedFiles"
    | "forbiddenActions"
    | "implementationConstraints"
    | "verificationCommands"
    | "evidenceExpectations"
    | "responseFormat"
  >;
  blockedReasons: string[];
}

export interface WorkforceManualCodexExecutionLoop {
  phase: "phase-202a-manual-codex-execution-loop";
  mode: "manual-codex-execution-loop-preview";
  loopEnabled: true;
  manualOnly: true;
  codexExecutionEnabled: false;
  autoRunEnabled: false;
  steps: string[];
  requiredHumanActions: string[];
  blockedReasons: string[];
}

export interface WorkforceCodexResultReviewPreview {
  phase: "phase-203a-codex-result-import-review";
  mode: "codex-result-review-preview";
  reviewEnabled: true;
  manualPasteOnly: true;
  autoApplyEnabled: false;
  autoMergeEnabled: false;
  autoCommitEnabled: false;
  expectedResultSections: string[];
  reviewChecklist: string[];
  blockedReasons: string[];
}

export interface WorkforceSafeDesktopRunnerDesign {
  phase: "phase-204a-safe-desktop-runner-design";
  mode: "safe-desktop-runner-design-only";
  runnerImplemented: false;
  runnerEnabled: false;
  codexCliInvocationEnabled: false;
  executionEnabled: false;
  designOnly: true;
  requiredBeforeImplementation: string[];
  forbiddenByDefault: string[];
  blockedReasons: string[];
}

export interface WorkforceLifecyclePreview {
  current: "draft" | "clarified" | "saved" | "exported" | "handoff-disabled" | "consensus_ready" | "export_ready" | "archived";
  persisted: boolean;
  history: Array<{
    state: "draft" | "clarified" | "saved" | "exported" | "handoff-disabled" | "consensus_ready" | "export_ready" | "archived";
    at: string | null;
    note: string;
  }>;
  allowedTransitions: Array<"draft" | "clarified" | "saved" | "exported" | "handoff-disabled" | "consensus_ready" | "export_ready" | "archived">;
  executionEnabled: false;
  workflowRunEnabled: false;
}

export interface WorkforceReviewPackagePreview {
  phase: "phase-141a-workforce-review-approval-gate";
  status: "needs-human-review" | "ready-for-human-review";
  title: string;
  generatedAt: string;
  savedAt?: string;
  planId?: string;
  workforceId?: string;
  previewOnly: true;
  persisted: boolean;
  executionEnabled: false;
  workflowRunEnabled: false;
  projectFileWrites: false;
  summary: ContractMetadata;
  packageSections: Array<{
    sectionId: string;
    title: string;
    items: string[];
  }>;
  requiredHumanChecks: string[];
  disabledWorkflowRunHandoff: {
    status: "disabled";
    implemented: false;
    enabled: false;
    futureRoute: "POST /workflow/run";
    reason: string;
  };
}

export interface WorkforceApprovalGatePreview {
  phase: "phase-141a-workforce-review-approval-gate";
  status: string;
  planId?: string;
  updatedAt?: string;
  previewOnly: true;
  persisted: boolean;
  executionEnabled: false;
  workflowRunEnabled: false;
  projectFileWrites: false;
  requiredApprovals: string[];
  allowedDecisions: Array<"approved-preview" | "changes-requested" | "rejected-preview">;
  currentDecision: "approved-preview" | "changes-requested" | "rejected-preview" | null;
  reviewer: string | null;
  note?: string;
  decidedAt: string | null;
  decisionHistory: Array<{
    decision: "approved-preview" | "changes-requested" | "rejected-preview";
    reviewer: string;
    note: string;
    decidedAt: string;
    previewOnly: true;
    executionEnabled: false;
    workflowRun: false;
    projectFileWrites: false;
  }>;
  gateChecks: Array<{
    checkId: string;
    label: string;
    satisfied: boolean;
    previewOnly: true;
  }>;
  disabledActions: string[];
  nextDecision: string;
}

export interface WorkforceOmxHandoffPreview {
  phase: "phase-142a-workforce-omx-handoff-preview";
  mode: "omx-compatible-preview";
  status: "handoff-preview-ready";
  workforceId?: string | null;
  previewOnly: true;
  executionEnabled: false;
  realAgentExecution: false;
  workflowRunEnabled: false;
  projectFileWrites: false;
  createsWorktrees: false;
  installsOhMyCodex: false;
  runsOhMyCodex: false;
  recommendedWorkflow: string;
  roleMapping: Array<{
    localRole: string;
    omxLane: string;
    previewOnly: true;
  }>;
  suggestedOmxCommands: string[];
  requiredPreflight: string[];
  blockedReasons: string[];
  futureRunnerBoundary: {
    adapterType: "external-cli-runner";
    implemented: false;
    enabled: false;
    allowedAfter: string;
  };
}

export interface WorkforcePlanResponse {
  success: true;
  phase: "phase-102a-agent-workforce-skeleton";
  planVersion: string;
  createdAt: string;
  mode: WorkforceMode;
  workforceId: string;
  goal: string;
  summary: string;
  userFriendlyStatus: "ready_to_review";
  selectedRoles: string[];
  selectedTemplate: WorkforceSelectedTemplate;
  templateContext: WorkforceTemplateContext;
  productTemplatesPreview: WorkforceProductTemplatesPreview;
  roleTiers: WorkforceRoleTier[];
  clarifyQuestions: WorkforceClarifyQuestion[];
  clarificationAnswers: WorkforceClarificationAnswer[];
  answeredClarifications: WorkforceAnsweredClarification[];
  unresolvedClarifications: WorkforceUnresolvedClarification[];
  consensusPreview: WorkforceConsensusPreview[];
  hookEventsPreview: WorkforceHookEventPreview[];
  eventLedgerPreview: WorkforceEventLedgerPreview[];
  planState: WorkforcePlanState;
  lifecyclePreview: WorkforceLifecyclePreview;
  reviewPackagePreview: WorkforceReviewPackagePreview;
  approvalGatePreview: WorkforceApprovalGatePreview;
  omxHandoffPreview: WorkforceOmxHandoffPreview;
  executionReadinessPreflight: WorkforceExecutionReadinessPreflight;
  externalOmxRunnerDesign: WorkforceExternalOmxRunnerDesign;
  runnerRequestQueuePreview: WorkforceRunnerRequestQueuePreview;
  executionApprovalRecordPreview: WorkforceExecutionApprovalRecordPreview;
  externalRunnerProtocolFreeze: WorkforceExternalRunnerProtocolFreeze;
  agentWorkforcePreviewFinalUxSeal: WorkforcePreviewFinalUxSeal;
  handoffPackageManifest: WorkforceHandoffPackageManifest;
  codexDesktopHandoffPack: WorkforceCodexDesktopHandoffPack;
  manualCodexExecutionLoop: WorkforceManualCodexExecutionLoop;
  codexResultReviewPreview: WorkforceCodexResultReviewPreview;
  safeDesktopRunnerDesign: WorkforceSafeDesktopRunnerDesign;
  workforceHudPreview: WorkforceHudPreview;
  taskBreakdown: WorkforceTask[];
  roleAssignments: WorkforceRoleAssignment[];
  deliverables: WorkforceDeliverable[];
  acceptanceCriteria: string[];
  risks: string[];
  limitations: string[];
  nextActions: string[];
  recommendedNextStep: string;
  markdown: string;
  exportableJson: ContractMetadata;
  safety: WorkforceSafety;
  meta?: ContractMetadata;
}

export interface WorkforcePlanStoreSafety {
  devOnlyLocalStorage: true;
  realLlmCalls: false;
  codeExecution: false;
  projectFileWrites: false;
  workflowRun: false;
  secretValuesStored: false;
}

export interface WorkforceTaskPackage {
  planId: string;
  workforceId: string;
  goal: string;
  summary: string;
  selectedTemplate?: WorkforceSelectedTemplate | null;
  templateContext?: WorkforceTemplateContext | null;
  productTemplatesPreview?: WorkforceProductTemplatesPreview | null;
  clarifyQuestions?: WorkforceClarifyQuestion[];
  clarificationAnswers?: WorkforceClarificationAnswer[];
  answeredClarifications?: WorkforceAnsweredClarification[];
  unresolvedClarifications?: WorkforceUnresolvedClarification[];
  consensusPreview?: WorkforceConsensusPreview[];
  hookEventsPreview?: WorkforceHookEventPreview[];
  planState?: WorkforcePlanState | null;
  lifecyclePreview?: WorkforceLifecyclePreview | null;
  reviewPackagePreview?: WorkforceReviewPackagePreview | null;
  approvalGatePreview?: WorkforceApprovalGatePreview | null;
  omxHandoffPreview?: WorkforceOmxHandoffPreview | null;
  executionReadinessPreflight?: WorkforceExecutionReadinessPreflight | null;
  externalOmxRunnerDesign?: WorkforceExternalOmxRunnerDesign | null;
  runnerRequestQueuePreview?: WorkforceRunnerRequestQueuePreview | null;
  executionApprovalRecordPreview?: WorkforceExecutionApprovalRecordPreview | null;
  externalRunnerProtocolFreeze?: WorkforceExternalRunnerProtocolFreeze | null;
  agentWorkforcePreviewFinalUxSeal?: WorkforcePreviewFinalUxSeal | null;
  handoffPackageManifest?: WorkforceHandoffPackageManifest | null;
  codexDesktopHandoffPack?: WorkforceCodexDesktopHandoffPack | null;
  manualCodexExecutionLoop?: WorkforceManualCodexExecutionLoop | null;
  codexResultReviewPreview?: WorkforceCodexResultReviewPreview | null;
  safeDesktopRunnerDesign?: WorkforceSafeDesktopRunnerDesign | null;
  roleTiers?: WorkforceRoleTier[];
  eventLedgerPreview?: WorkforceEventLedgerPreview[];
  workforceHudPreview?: WorkforceHudPreview | null;
  roles: WorkforceRoleAssignment[];
  taskBreakdown: WorkforceTask[];
  deliverables: WorkforceDeliverable[];
  acceptanceCriteria: string[];
  risks: string[];
  nextActions: string[];
  limitations?: string[];
  recommendedNextStep?: string;
  markdown: string;
  exportableJson: ContractMetadata;
  planVersion: string;
  createdAt: string;
  savedAt: string;
  meta?: ContractMetadata;
}

export interface WorkforcePlanSaveRequest {
  context?: RequestContext;
  plan?: WorkforcePlanResponse;
  goal?: string;
  metadata?: ContractMetadata;
}

export interface WorkforcePlanSaveResponse {
  success: true;
  phase: "phase-102d-agent-workforce-plan-store";
  status: "saved";
  mode: "dev-only-local-plan-store";
  planId: string;
  savedAt: string;
  taskPackage: WorkforceTaskPackage;
  safety: WorkforcePlanStoreSafety;
}

export interface WorkforceSavedPlanSummary {
  planId: string;
  workforceId: string;
  goal: string;
  summary: string;
  planVersion: string;
  createdAt: string;
  savedAt: string;
  taskCount: number;
  roleCount: number;
  lifecycleState?: string;
  lifecycleStatus?: string;
  answeredClarificationCount?: number;
  unresolvedClarificationCount?: number;
  reviewPackageStatus?: string;
  approvalGateStatus?: string;
  approvalDecision?: string | null;
}

export interface WorkforcePlanListResponse {
  success: true;
  phase: "phase-102d-agent-workforce-plan-store";
  status: "listed";
  mode: "dev-only-local-plan-store";
  count: number;
  plans: WorkforceSavedPlanSummary[];
  safety: WorkforcePlanStoreSafety;
}

export interface WorkforcePlanGetResponse {
  success: true;
  phase: "phase-102d-agent-workforce-plan-store";
  status: "found";
  mode: "dev-only-local-plan-store";
  planId: string;
  taskPackage: WorkforceTaskPackage;
  plan: ContractMetadata;
  safety: WorkforcePlanStoreSafety;
}

export interface WorkforcePlanDeleteResponse {
  success: true;
  phase: "phase-102d-agent-workforce-plan-store";
  status: "deleted";
  mode: "dev-only-local-plan-store";
  planId: string;
  deleted: true;
  remainingCount: number;
  safety: WorkforcePlanStoreSafety;
}

export interface WorkforcePlanExportResponse {
  success: true;
  phase: "phase-102d-agent-workforce-plan-store";
  status: "export_ready";
  mode: "dev-only-local-plan-store";
  planId: string;
  formats: string[];
  taskPackage: WorkforceTaskPackage;
  json: WorkforceTaskPackage;
  markdown: string;
  safety: WorkforcePlanStoreSafety;
}

export interface WorkforcePlanClarificationAnswerRequest {
  context?: RequestContext;
  answers: WorkforceClarificationAnswer[];
  metadata?: ContractMetadata;
}

export interface WorkforcePlanClarificationAnswerResponse {
  success: true;
  phase: "phase-140a-workforce-clarification-lifecycle";
  status: "clarification_answers_saved";
  mode: "dev-only-local-plan-store";
  planId: string;
  answeredCount: number;
  taskPackage: WorkforceTaskPackage;
  lifecycle: WorkforceLifecyclePreview;
  safety: WorkforcePlanStoreSafety;
}

export interface WorkforcePlanLifecycleRequest {
  context?: RequestContext;
  state: "draft" | "clarified" | "saved" | "exported" | "handoff-disabled" | "consensus_ready" | "export_ready" | "archived";
  note?: string;
  metadata?: ContractMetadata;
}

export interface WorkforcePlanLifecycleResponse {
  success: true;
  phase: "phase-140a-workforce-clarification-lifecycle";
  status: "lifecycle_saved";
  mode: "dev-only-local-plan-store";
  planId: string;
  lifecycle: WorkforceLifecyclePreview;
  taskPackage: WorkforceTaskPackage;
  safety: WorkforcePlanStoreSafety;
}

export interface WorkforcePlanReviewPackageResponse {
  success: true;
  phase: "phase-141a-workforce-review-approval-gate";
  status: "review_package_ready";
  mode: "dev-only-local-plan-store";
  planId: string;
  reviewPackagePreview: WorkforceReviewPackagePreview;
  approvalGatePreview: WorkforceApprovalGatePreview;
  taskPackage: WorkforceTaskPackage;
  safety: WorkforcePlanStoreSafety;
}

export interface WorkforcePlanApprovalGateRequest {
  context?: RequestContext;
  decision: "approved-preview" | "changes-requested" | "rejected-preview";
  reviewer?: string;
  approver?: string;
  note?: string;
  metadata?: ContractMetadata;
}

export interface WorkforcePlanApprovalGateResponse {
  success: true;
  phase: "phase-141a-workforce-review-approval-gate";
  status: "approval_gate_recorded";
  mode: "dev-only-local-plan-store";
  planId: string;
  decision: "approved-preview" | "changes-requested" | "rejected-preview" | null;
  reviewPackagePreview: WorkforceReviewPackagePreview;
  approvalGatePreview: WorkforceApprovalGatePreview;
  taskPackage: WorkforceTaskPackage;
  safety: WorkforcePlanStoreSafety;
}

export type WorkforceHealthResult = ResultEnvelope<WorkforceHealth>;
export type WorkforceAgentsResult = ResultEnvelope<WorkforceAgentsResponse>;
export type WorkforcePlanResult = ResultEnvelope<WorkforcePlanResponse>;
export type WorkforcePlanSaveResult = ResultEnvelope<WorkforcePlanSaveResponse>;
export type WorkforcePlanListResult = ResultEnvelope<WorkforcePlanListResponse>;
export type WorkforcePlanGetResult = ResultEnvelope<WorkforcePlanGetResponse>;
export type WorkforcePlanDeleteResult = ResultEnvelope<WorkforcePlanDeleteResponse>;
export type WorkforcePlanExportResult = ResultEnvelope<WorkforcePlanExportResponse>;
export type WorkforcePlanClarificationAnswerResult = ResultEnvelope<WorkforcePlanClarificationAnswerResponse>;
export type WorkforcePlanLifecycleResult = ResultEnvelope<WorkforcePlanLifecycleResponse>;
export type WorkforcePlanReviewPackageResult = ResultEnvelope<WorkforcePlanReviewPackageResponse>;
export type WorkforcePlanApprovalGateResult = ResultEnvelope<WorkforcePlanApprovalGateResponse>;
