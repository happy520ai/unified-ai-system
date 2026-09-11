import type {
  KnowledgeHealthResult,
  KnowledgeSourcesResult,
  RouteModesResult,
  RoutingPreviewKind,
  RoutingPreviewRequest,
  RoutingPreviewResult,
  ForgePolishRequest,
  ForgeOrchestrateRequest,
  ForgeOperationResult,
  ForgeOrchestrateResult,
  ForgeStatusResult,
  ForgeRunsResult,
  TaijiCompileResult,
  TaijiStatusResult,
  TaijiOperationResult,
  TaijiEvaluateRequest,
  TaijiActivateRequest,
  TaijiExecuteRequest,
  TaijiSelectedExecuteRequest,
  TaijiFeedbackRequest,
  TaijiRepairRequest,
  TaijiRevokeRequest,
  WorkforcePreviewResult,
  ImConnectorId,
  ImConnectorMessage,
  ImConnectorSendOptions,
  ImConnectorSendResult,
  ImConnectorListResult,
  ClearRuntimeProviderCredentialRequest,
  ClearRuntimeProviderCredentialResult,
  ContractMetadata,
  GatewayChatRequest,
  GatewayChatResult,
  GatewayGenerationOptions,
  GatewayHealth,
  GatewayRequest,
  GatewayResult,
  GatewayStreamEvent,
  KnowledgeInfraReadinessResult,
  KnowledgeLoadRequest,
  KnowledgeLoadResult,
  KnowledgeRetrieveRequest,
  KnowledgeRetrieveResult,
  ManagedLocalClientSummary,
  LocalClientRegistryResult,
  LocalClientStatusResult,
  LocalClientDispatchIntent,
  LocalClientDurableExecutionReceipt,
  LocalClientReceiptReconciliationQuery,
  LocalClientReceiptReconciliationResponse,
  PreviewLocalClientExecutionRequest,
  PreviewLocalClientExecutionResult,
  RegisterLocalClientRequest,
  RegisterLocalClientResult,
  RevokeLocalClientRequest,
  RevokeLocalClientResult,
  RouteLocalClientRequest,
  RouteLocalClientResult,
  RouteLocalClientProviderRequest,
  RouteLocalClientProviderResult,
  VerifyLocalClientRequest,
  VerifyLocalClientResult,
  PreviewGovernedLocalClientExecutionRequest,
  PreviewGovernedLocalClientExecutionResult,
  ApproveGovernedLocalClientExecutionRequest,
  ApproveGovernedLocalClientExecutionResult,
  ExecuteGovernedLocalClientExecutionRequest,
  ExecuteGovernedLocalClientExecutionResult,
  GovernedLocalClientExecutionStatusResult,
  CancelGovernedLocalClientExecutionRequest,
  CancelGovernedLocalClientExecutionResult,
  LocalClientOnboardingProfileId,
  LocalClientOnboardingProfileSummary,
  LocalClientOnboardingInspectionResult,
  LocalClientOnboardingVerificationResult,
  PlanGovernedLocalClientOnboardingRequest,
  PlanGovernedLocalClientOnboardingResult,
  ApproveGovernedLocalClientOnboardingRequest,
  ApproveGovernedLocalClientOnboardingResult,
  MutateGovernedLocalClientOnboardingRequest,
  GovernedLocalClientOnboardingMutationOutcome,
  GovernedLocalClientOnboardingMutationOptions,
  ModelImportConfirmRequest,
  ModelImportConfirmResult,
  ModelImportPreviewRequest,
  ModelImportPreviewResult,
  PromptEnhancementOptions,
  PromptEnhancementRequest,
  PromptEnhancementResult,
  RagChatRequest,
  RagChatResult,
  MessageDto,
  RequestContext,
  ResultEnvelope,
  SetupReadinessResult,
  WorkflowPlanResult,
  WorkflowRequest,
  WorkflowRunResult,
  WorkflowRunInspectionResult,
  WorkflowRunListResult,
  ActivateGovernancePolicyResult,
  AgentGovernanceStatsResult,
  CreateGovernancePolicyRequest,
  CreateGovernancePolicyResult,
  GenerateGovernedAgentRequest,
  GenerateGovernedAgentResult,
  GovernedAgentAuditResult,
  GovernedAgentDescribeResult,
  GovernedAgentListResult,
  GovernedAgentPolicyResult,
  GovernedAgentRunResult,
  GovernedApprovalDecisionResult,
  GovernedApprovalListResult,
  GovernancePolicyListResult,
  RevokeGovernedAgentRequest,
  RevokeGovernedAgentResult,
  RunGovernedAgentRequest,
  WorkforceAgentsResult,
  WorkforceExecutionStatusResult,
  WorkforceWorkflowRecoveryRequest,
  WorkforceWorkflowRecoveryResult,
  WorkforceExternalRunnerRecoveryRequest,
  WorkforceExternalRunnerRecoveryResult,
  WorkforceExecuteRequest,
  WorkforceExecuteResult,
  WorkforceExecutionReviewResult,
  WorkforceHealthResult,
  WorkforcePlanDeleteResult,
  WorkforcePlanExportResult,
  WorkforcePlanGetResult,
  WorkforcePlanLifecycleRequest,
  WorkforcePlanLifecycleResult,
  WorkforcePlanApprovalGateRequest,
  WorkforcePlanApprovalGateResult,
  WorkforcePlanClarificationAnswerRequest,
  WorkforcePlanClarificationAnswerResult,
  WorkforcePlanListResult,
  WorkforcePlanRequest,
  WorkforcePlanResult,
  WorkforcePlanReviewPackageResult,
  WorkforcePlanSaveRequest,
  WorkforcePlanSaveResult,
} from "@unified-ai-system/shared-contracts";

export type {
  WorkflowRunInspection,
  WorkflowRunInspectionResult,
  WorkflowRunListResult,
  WorkflowRunStatus,
  ClearRuntimeProviderCredentialRequest,
  ClearRuntimeProviderCredentialResult,
  GatewayHealth,
  LocalClientExecutionReceiptJournalStatus,
  LocalClientExecutionReceiptRecoveryStatus,
  LocalClientManagedProtocolDispatchStatus,
  LocalClientPopSnapshotRollbackProtectionStatus,
  LocalClientDispatchIntent,
  LocalClientDurableExecutionReceipt,
  LocalClientReceiptReconciliationQuery,
  LocalClientReceiptReconciliationResponse,
  LocalClientReceiptReconciliationState,
  ActivateGovernancePolicyResult,
  AgentGovernanceStatsResult,
  CreateGovernancePolicyRequest,
  CreateGovernancePolicyResult,
  GenerateGovernedAgentRequest,
  GenerateGovernedAgentResult,
  GovernedAgentAuditResult,
  GovernedAgentDescribeResult,
  GovernedAgentListResult,
  GovernedAgentPolicyResult,
  GovernedAgentRunResult,
  GovernedApprovalDecisionResult,
  GovernedApprovalListResult,
  GovernancePolicyListResult,
  RevokeGovernedAgentRequest,
  RevokeGovernedAgentResult,
  RunGovernedAgentRequest,
  WorkforceExternalRunnerReview,
  WorkforceExternalRunnerProfile,
  WorkforceExternalRunnerSelector,
  WorkforceExternalRunnerState,
  WorkforceExternalRunnerNativeUsage,
  WorkforceExternalRunnerTokenCounts,
  WorkforceExternalRunnerInspection,
  WorkforceExternalRunnerRecoveryRequest,
  WorkforceExternalRunnerRecoveryResponse,
  WorkforceExternalRunnerRecoveryResult,
  WorkforceExecuteRequest,
  WorkforceExecuteResult,
  WorkforceExecutionReviewResponse,
  WorkforceExecutionReviewResult,
} from "@unified-ai-system/shared-contracts";

export interface GatewayClientOptions {
  baseUrl: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
  providerDispatchKeyFactory?: () => string;
}

export interface ProviderDispatchRequestOptions {
  /** Requests response replay where the HTTP route supports it. */
  idempotencyKey?: string;
  /** Reserves only the durable provider-dispatch tombstone. */
  providerDispatchKey?: string;
}

export interface PrepareGovernedAgentTaskRequest { goal: string; prompt: string; projectId?: string }
export interface GovernedAgentTaskRevisionRequest { revision: number }
export interface ConfirmGovernedAgentTaskRequest extends GovernedAgentTaskRevisionRequest {
  reviewHash: string; planHash: string; approvalId: string;
}
export interface RunGovernedAgentTaskRequest extends GovernedAgentTaskRevisionRequest, ProviderDispatchRequestOptions {
  /** One explicit chunk, 1–10 iterations; the server defaults to 4. */
  maxIterations?: number;
}
export interface GovernedAgentTaskSnapshot {
  version: 1; taskId: string; agentId: string; agentRunId: string; revision: number;
  phase: "prepared" | "planning" | "awaiting_confirmation" | "running" | "paused" | "verifying" | "completed" | "failed" | "cancelled" | "unknown";
  counters: { iterations: number; modelCalls: number; reservedTokens: number; repairAttempts: number };
  pendingOperation: Record<string, unknown> | null; review: Record<string, unknown>; plan: Record<string, unknown> | null;
  sourceFiles: ReadonlyArray<{ path: string; sha256: string | null; content: string | null }>;
  approvalId: string | null; confirmedApprovalId: string | null; stepIndex: number;
  stepReceipts: ReadonlyArray<Record<string, unknown>>; modelReceipts: ReadonlyArray<Record<string, unknown>>;
  verificationAttempts: ReadonlyArray<Record<string, unknown>>; workspaceReceipt: Record<string, unknown> | null;
  sourceFilesHash: string; finalAnswer: string; errorCode: string | null; controlRequested: "run" | "pause" | "cancel" | "shutdown" | null;
  resumable: boolean; recovery: { automaticReplay: false; workspaceReconciliationRequired: boolean; wholeDirectoryRollbackProtection: false };
  resident?: { enabled: boolean; chunks: number; maxChunks: number; expiresAt: number; chunkIterations: number; stopReason: string | null } | null;
  recoveryAttempts?: ReadonlyArray<{ attempt: number; status: "pending" | "recovered" | "failed" | "unknown"; sourceFilesHash: string;
    code: "WORKSPACE_NOT_ATTACHED"; errorCode: string | null }>;
  loopDecisions?: ReadonlyArray<{ attemptId: string; action: string; reason: string; repairAttempts: number }>;
}

export interface ManagedLocalClientPopProofOptions {
  /** Caller-owned secret bytes; the SDK copies rather than mutates this value. */
  secret: Uint8Array;
  tenantId: string;
  subjectId: string;
  clientId: string;
  revision: number;
  /** Uppercase canonical HTTP method (for example, POST). */
  method: string;
  /** Exact origin-form path plus query string, beginning with one slash. */
  path: string;
  /** Exact request bytes that the gateway ingress will receive. */
  bodyBytes: Uint8Array;
}

export interface ManagedLocalClientPopProofHeader {
  readonly header: string;
  readonly keyId: string;
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
}

export interface LocalClientReceiptProtocolKeyDerivationOptions {
  /** 32-64 byte client/gateway shared secret; copied and never modified. */
  sharedSecret: Uint8Array;
  tenantId: string;
  clientId: string;
}

export interface LocalClientReceiptProtocolClockOptions {
  nowMs?: number;
  allowedClockSkewMs?: number;
}

export interface VerifyLocalClientDispatchIntentOptions
  extends LocalClientReceiptProtocolClockOptions {
  protocolKey: Uint8Array;
  intent: LocalClientDispatchIntent;
  maxTtlMs?: number;
}

export interface VerifyLocalClientReceiptReconciliationQueryOptions
  extends LocalClientReceiptProtocolClockOptions {
  protocolKey: Uint8Array;
  query: LocalClientReceiptReconciliationQuery;
  maxTtlMs?: number;
}

export interface VerifyLocalClientDurableExecutionReceiptOptions
  extends LocalClientReceiptProtocolClockOptions {
  protocolKey: Uint8Array;
  receipt: LocalClientDurableExecutionReceipt;
}

export interface CreateLocalClientDurableExecutionReceiptOptions
  extends LocalClientReceiptProtocolClockOptions {
  protocolKey: Uint8Array;
  intent: LocalClientDispatchIntent;
  completedAtMs: number;
  maxTtlMs?: number;
}

export interface CreateLocalClientCompletedReceiptReconciliationResponseOptions
  extends LocalClientReceiptProtocolClockOptions {
  protocolKey: Uint8Array;
  query: LocalClientReceiptReconciliationQuery;
  receipt: LocalClientDurableExecutionReceipt;
  observedAtMs: number;
  maxTtlMs?: number;
}

export interface CreateLocalClientFailedBeforeEffectReconciliationResponseOptions
  extends LocalClientReceiptProtocolClockOptions {
  protocolKey: Uint8Array;
  query: LocalClientReceiptReconciliationQuery;
  observedAtMs: number;
  maxTtlMs?: number;
}

export type CreateLocalClientPendingReconciliationResponseOptions =
  CreateLocalClientFailedBeforeEffectReconciliationResponseOptions;

export type CreateLocalClientNotFoundReconciliationResponseOptions =
  CreateLocalClientFailedBeforeEffectReconciliationResponseOptions;

export type ManagedLocalClientChatProofOptions = Pick<
  ManagedLocalClientPopProofOptions,
  "secret" | "tenantId" | "subjectId" | "clientId" | "revision"
>;

export type ManagedLocalClientChatRequest = Readonly<Record<string, unknown>>
  & ProviderDispatchRequestOptions
  & {
    /** Proof material belongs only in the separate proofOptions argument. */
    secret?: never;
    proof?: never;
    popProof?: never;
    popOptions?: never;
    proofOptions?: never;
  };

export interface GatewayLlmPromptEnhancementRequest
  extends PromptEnhancementRequest, ProviderDispatchRequestOptions {
  providerId?: string;
  modelId?: string;
}

export type GatewayClientErrorKind = "cancelled" | "timeout" | "network" | "http" | "protocol" | "stream";

export declare const GATEWAY_CLIENT_ERROR_CODES: Readonly<{
  ABORTED: "GATEWAY_CLIENT_ABORTED";
  TIMEOUT: "GATEWAY_CLIENT_TIMEOUT";
  NETWORK: "GATEWAY_NETWORK_ERROR";
  HTTP: "GATEWAY_HTTP_ERROR";
  PROTOCOL: "GATEWAY_PROTOCOL_ERROR";
  STREAM: "GATEWAY_STREAM_ERROR";
}>;

export declare const LOCAL_CLIENT_RECEIPT_RECONCILIATION_SDK_BOUNDARIES: Readonly<{
  stateless: true;
  protocolIntegrity: "hmac-sha256";
  durableStorageProvided: false;
  atomicEffectReceiptProvided: false;
  reconciliationAuthorizesExecution: false;
  clientOwnsDurableAtomicState: true;
}>;

export declare class GatewayClientError extends Error {
  readonly code: string;
  readonly kind: GatewayClientErrorKind;
  readonly retryable: boolean;
  readonly statusCode?: number;
  readonly responseBody?: unknown;
  readonly cause?: unknown;
  constructor(message: string, options?: {
    code?: string;
    kind?: GatewayClientErrorKind;
    retryable?: boolean;
    statusCode?: number;
    responseBody?: unknown;
    cause?: unknown;
  });
}

export declare class GatewayClientAbortError extends GatewayClientError {
  readonly code: "GATEWAY_CLIENT_ABORTED";
  readonly kind: "cancelled";
  readonly retryable: false;
  readonly reason?: unknown;
}

export declare class GatewayClientTimeoutError extends GatewayClientError {
  readonly code: "GATEWAY_CLIENT_TIMEOUT";
  readonly kind: "timeout";
  readonly retryable: false;
  readonly timeoutMs?: number;
}

export interface LocalClientRegistryInspectionResult {
  source: "registry-list";
  independentAuthority: false;
  clientId: string;
  found: boolean;
  pagesScanned: number;
  client: ManagedLocalClientSummary | null;
}

export interface DiscoverLocalClientsRequest {
  source?: string;
  maxProcesses?: number;
  includeUnknown?: boolean;
  includeSystemProcesses?: boolean;
  dryRun?: boolean;
  includeDisabled?: boolean;
  includeMissingAsDisabled?: boolean;
  autoDiscoverAll?: boolean;
}

export interface DisableLocalClientRequest {
  clientId: string;
  reason?: "manual_disable" | "maintenance" | "security_review";
  dryRun?: boolean;
  includeHealthReset?: boolean;
}

export interface SmartManageLocalClientsRequest {
  dryRun?: boolean;
  discover?: DiscoverLocalClientsRequest;
  discovery?: DiscoverLocalClientsRequest;
  maintenance?: Readonly<Record<string, unknown>>;
  includeDiscoveryOnly?: boolean;
  includeRegistrySnapshot?: boolean;
  maxRecommendations?: number;
}

export interface GatewayClient {
  readonly baseUrl: string;
  health(): Promise<ResultEnvelope<GatewayHealth>>;
  setupReadiness(): Promise<ResultEnvelope<SetupReadinessResult>>;
  clearRuntimeProviderCredential(request: ClearRuntimeProviderCredentialRequest): Promise<ResultEnvelope<ClearRuntimeProviderCredentialResult>>;
  localClientsStatus(): Promise<ResultEnvelope<LocalClientStatusResult>>;
  localClients(options?: {
    includeDisabled?: boolean;
    limit?: number;
    offset?: number;
    capabilities?: string[];
  }): Promise<ResultEnvelope<LocalClientRegistryResult>>;
  discoverLocalClients(request?: DiscoverLocalClientsRequest): Promise<ResultEnvelope<Record<string, unknown>>>;
  inspectLocalClient(clientId: string): Promise<ResultEnvelope<LocalClientRegistryInspectionResult>>;
  registerLocalClient(request: RegisterLocalClientRequest): Promise<ResultEnvelope<RegisterLocalClientResult>>;
  disableLocalClient(request: DisableLocalClientRequest): Promise<ResultEnvelope<Record<string, unknown>>>;
  revokeLocalClient(request: RevokeLocalClientRequest): Promise<ResultEnvelope<RevokeLocalClientResult>>;
  smartManageLocalClients(request?: SmartManageLocalClientsRequest): Promise<ResultEnvelope<Record<string, unknown>>>;
  routeLocalClient(request: RouteLocalClientRequest): Promise<ResultEnvelope<RouteLocalClientResult>>;
  routeLocalClientProvider(request: RouteLocalClientProviderRequest): Promise<ResultEnvelope<RouteLocalClientProviderResult>>;
  verifyLocalClient(request: VerifyLocalClientRequest): Promise<ResultEnvelope<VerifyLocalClientResult>>;
  previewGovernedLocalClientExecution(request: PreviewGovernedLocalClientExecutionRequest): Promise<ResultEnvelope<PreviewGovernedLocalClientExecutionResult>>;
  approveGovernedLocalClientExecution(request: ApproveGovernedLocalClientExecutionRequest): Promise<ResultEnvelope<ApproveGovernedLocalClientExecutionResult>>;
  executeGovernedLocalClientExecution(
    request: ExecuteGovernedLocalClientExecutionRequest,
    options: { idempotencyKey: string },
  ): Promise<ResultEnvelope<ExecuteGovernedLocalClientExecutionResult>>;
  governedLocalClientExecutionStatus(executionId: string): Promise<ResultEnvelope<GovernedLocalClientExecutionStatusResult>>;
  cancelGovernedLocalClientExecution(
    executionId: string,
    request?: CancelGovernedLocalClientExecutionRequest,
  ): Promise<ResultEnvelope<CancelGovernedLocalClientExecutionResult>>;
  localClientOnboardingProfiles(): Promise<ResultEnvelope<LocalClientOnboardingProfileSummary[]>>;
  localClientOnboardingProfile(
    profileId: LocalClientOnboardingProfileId,
  ): Promise<ResultEnvelope<LocalClientOnboardingInspectionResult>>;
  verifyLocalClientOnboardingProfile(
    profileId: LocalClientOnboardingProfileId,
  ): Promise<ResultEnvelope<LocalClientOnboardingVerificationResult>>;
  planGovernedLocalClientOnboarding(
    request: PlanGovernedLocalClientOnboardingRequest,
  ): Promise<ResultEnvelope<PlanGovernedLocalClientOnboardingResult>>;
  approveGovernedLocalClientOnboarding(
    request: ApproveGovernedLocalClientOnboardingRequest,
    options: GovernedLocalClientOnboardingMutationOptions,
  ): Promise<ResultEnvelope<ApproveGovernedLocalClientOnboardingResult>>;
  applyGovernedLocalClientOnboarding(
    request: MutateGovernedLocalClientOnboardingRequest,
    options: GovernedLocalClientOnboardingMutationOptions,
  ): Promise<ResultEnvelope<GovernedLocalClientOnboardingMutationOutcome>>;
  rollbackGovernedLocalClientOnboarding(
    request: MutateGovernedLocalClientOnboardingRequest,
    options: GovernedLocalClientOnboardingMutationOptions,
  ): Promise<ResultEnvelope<GovernedLocalClientOnboardingMutationOutcome>>;
  recoverGovernedLocalClientOnboarding(
    request: MutateGovernedLocalClientOnboardingRequest,
    options: GovernedLocalClientOnboardingMutationOptions,
  ): Promise<ResultEnvelope<GovernedLocalClientOnboardingMutationOutcome>>;
  previewLocalClientExecution(request: PreviewLocalClientExecutionRequest): Promise<ResultEnvelope<PreviewLocalClientExecutionResult>>;
  agentGovernanceStats(): Promise<AgentGovernanceStatsResult>;
  generateGovernedAgent(request: GenerateGovernedAgentRequest): Promise<GenerateGovernedAgentResult>;
  governedAgents(): Promise<GovernedAgentListResult>;
  governedAgent(agentId: string): Promise<GovernedAgentDescribeResult>;
  governedAgentPolicy(agentId: string): Promise<GovernedAgentPolicyResult>;
  governedAgentAudit(agentId: string): Promise<GovernedAgentAuditResult>;
  runGovernedAgent(agentId: string, request: RunGovernedAgentRequest): Promise<GovernedAgentRunResult>;
  prepareGovernedAgentTask(agentId: string, request: PrepareGovernedAgentTaskRequest): Promise<ResultEnvelope<GovernedAgentTaskSnapshot>>;
  governedAgentTask(agentId: string, taskId: string): Promise<ResultEnvelope<GovernedAgentTaskSnapshot>>;
  planGovernedAgentTask(agentId: string, taskId: string, request: GovernedAgentTaskRevisionRequest & ProviderDispatchRequestOptions): Promise<ResultEnvelope<GovernedAgentTaskSnapshot>>;
  confirmGovernedAgentTask(agentId: string, taskId: string, request: ConfirmGovernedAgentTaskRequest): Promise<ResultEnvelope<GovernedAgentTaskSnapshot>>;
  runGovernedAgentTask(agentId: string, taskId: string, request: RunGovernedAgentTaskRequest): Promise<ResultEnvelope<GovernedAgentTaskSnapshot>>;
  scheduleGovernedAgentTask(agentId: string, taskId: string, request: GovernedAgentTaskRevisionRequest): Promise<ResultEnvelope<GovernedAgentTaskSnapshot>>;
  pauseGovernedAgentTask(agentId: string, taskId: string, request: GovernedAgentTaskRevisionRequest): Promise<ResultEnvelope<GovernedAgentTaskSnapshot>>;
  cancelGovernedAgentTask(agentId: string, taskId: string, request: GovernedAgentTaskRevisionRequest): Promise<ResultEnvelope<GovernedAgentTaskSnapshot>>;
  revokeGovernedAgent(agentId: string, request?: RevokeGovernedAgentRequest): Promise<RevokeGovernedAgentResult>;
  governedApprovals(agentId?: string): Promise<GovernedApprovalListResult>;
  decideGovernedApproval(approvalId: string, decision: "approve" | "reject"): Promise<GovernedApprovalDecisionResult>;
  governancePolicies(): Promise<GovernancePolicyListResult>;
  createGovernancePolicy(request: CreateGovernancePolicyRequest): Promise<CreateGovernancePolicyResult>;
  activateGovernancePolicy(policyKey: string, version: number): Promise<ActivateGovernancePolicyResult>;
  enhancePrompt(request: PromptEnhancementRequest): Promise<ResultEnvelope<PromptEnhancementResult>>;
  enhancePromptLlm(request: GatewayLlmPromptEnhancementRequest): Promise<ResultEnvelope<Record<string, unknown>>>;
  chat(request: GatewayChatRequest & ProviderDispatchRequestOptions): Promise<GatewayChatResult>;
  /**
   * Sends one PoP-authenticated OpenAI-compatible chat request. The body is
   * serialized once and those exact bytes are both signed and transmitted.
   * This method requires an absolute origin-only baseUrl and rejects redirects.
   */
  managedLocalClientChat(
    request: ManagedLocalClientChatRequest,
    proofOptions: ManagedLocalClientChatProofOptions,
  ): Promise<Record<string, unknown>>;
  ragChat(request: RagChatRequest & ProviderDispatchRequestOptions): Promise<RagChatResult>;
  chatStream(request: GatewayChatRequest & ProviderDispatchRequestOptions): AsyncIterable<GatewayStreamEvent>;
  knowledgeRetrieve(request: KnowledgeRetrieveRequest): Promise<KnowledgeRetrieveResult>;
  knowledgeHealth(): Promise<KnowledgeHealthResult>;
  knowledgeSources(): Promise<KnowledgeSourcesResult>;
  routeModes(): Promise<RouteModesResult>;
  routingPreview(kind: RoutingPreviewKind, request: RoutingPreviewRequest): Promise<RoutingPreviewResult>;
  forgeStatus(): Promise<ForgeStatusResult>;
  forgeRuns(): Promise<ForgeRunsResult>;
  forgePolish(request: ForgePolishRequest): Promise<ForgeOperationResult>;
  forgeQuality(request: { code: string; task?: ContractMetadata }): Promise<ForgeOperationResult>;
  forgeRemember(request: { content: string; metadata?: ContractMetadata }): Promise<ForgeOperationResult>;
  forgeRecall(request: { query: string; limit?: number }): Promise<ForgeOperationResult>;
  forgeOrchestrate(request: ForgeOrchestrateRequest): Promise<ForgeOrchestrateResult>;
  taijiCompile(request: { request: string; capabilityId?: string; displayName?: string }): Promise<TaijiCompileResult>;
  taijiCapabilities(agentId: string, options?: { limit?: number; offset?: number }): Promise<TaijiStatusResult>;
  taijiCapabilityRun(agentId: string, runId: string): Promise<TaijiOperationResult>;
  evaluateTaijiCapability(request: TaijiEvaluateRequest): Promise<TaijiOperationResult>;
  activateTaijiCapability(request: TaijiActivateRequest): Promise<TaijiOperationResult>;
  executeTaijiCapability(request: TaijiExecuteRequest | TaijiSelectedExecuteRequest): Promise<TaijiOperationResult>;
  revokeTaijiCapability(request: TaijiRevokeRequest): Promise<TaijiOperationResult>;
  repairTaijiCapability(request: TaijiRepairRequest): Promise<TaijiOperationResult>;
  reweightTaijiCapability(request: TaijiFeedbackRequest): Promise<TaijiOperationResult>;
  pruneTaijiCapability(request: TaijiFeedbackRequest): Promise<TaijiOperationResult>;
  workforcePreview(request: { task: string }): Promise<WorkforcePreviewResult>;
  knowledgeLoad(request: KnowledgeLoadRequest): Promise<KnowledgeLoadResult>;
  knowledgeInfraReadiness(): Promise<KnowledgeInfraReadinessResult>;
  connectors(): Promise<ResultEnvelope<ImConnectorListResult>>;
  /** Performs a single send with an explicit key and rejects redirects; errors never invite automatic retries. */
  sendConnectorMessage(connectorId: ImConnectorId, request: ImConnectorMessage, options: ImConnectorSendOptions): Promise<ResultEnvelope<ImConnectorSendResult>>;
  modelImportPreview(request: ModelImportPreviewRequest): Promise<ResultEnvelope<ModelImportPreviewResult>>;
  modelImportConfirm(request: ModelImportConfirmRequest): Promise<ResultEnvelope<ModelImportConfirmResult>>;
  workflowHealth(): Promise<ResultEnvelope<Record<string, unknown>>>;
  workflowActions(): Promise<ResultEnvelope<Record<string, unknown>>>;
  workflowPlan(request: WorkflowRequest): Promise<WorkflowPlanResult>;
  workflowRun(request: WorkflowRequest): Promise<WorkflowRunResult>;
  workflowRuns(options?: { limit?: number }): Promise<WorkflowRunListResult>;
  workflowRunStatus(workflowId: string): Promise<WorkflowRunInspectionResult>;
  recoverWorkflowRun(workflowId: string): Promise<WorkflowRunInspectionResult>;
  workforceHealth(): Promise<WorkforceHealthResult>;
  workforceExecutionStatus(executionId: string): Promise<WorkforceExecutionStatusResult>;
  recoverWorkforceWorkflow(request: WorkforceWorkflowRecoveryRequest): Promise<WorkforceWorkflowRecoveryResult>;
  /** Reviews the complete configured intent without dispatching a native turn. */
  workforceExecutionReview(request: WorkforceExecuteRequest): Promise<WorkforceExecutionReviewResult>;
  /** Executes only after the gateway's current plan and Agent approvals; never retries automatically. */
  workforceExecute(request: WorkforceExecuteRequest): Promise<WorkforceExecuteResult>;
  recoverWorkforceExternalRunner(request: WorkforceExternalRunnerRecoveryRequest): Promise<WorkforceExternalRunnerRecoveryResult>;
  workforceAgents(): Promise<WorkforceAgentsResult>;
  workforcePlan(request: WorkforcePlanRequest): Promise<WorkforcePlanResult>;
  workforcePlanSave(request: WorkforcePlanSaveRequest): Promise<WorkforcePlanSaveResult>;
  workforcePlans(): Promise<WorkforcePlanListResult>;
  workforcePlanGet(planId: string): Promise<WorkforcePlanGetResult>;
  workforcePlanDelete(planId: string): Promise<WorkforcePlanDeleteResult>;
  workforcePlanExport(planId: string): Promise<WorkforcePlanExportResult>;
  workforcePlanClarifications(planId: string, request: WorkforcePlanClarificationAnswerRequest): Promise<WorkforcePlanClarificationAnswerResult>;
  workforcePlanLifecycle(planId: string, request: WorkforcePlanLifecycleRequest): Promise<WorkforcePlanLifecycleResult>;
  workforcePlanReviewPackage(planId: string): Promise<WorkforcePlanReviewPackageResult>;
  workforcePlanApprovalGate(planId: string, request: WorkforcePlanApprovalGateRequest): Promise<WorkforcePlanApprovalGateResult>;
  generate(request: GatewayRequest & ProviderDispatchRequestOptions): Promise<GatewayResult>;
}

export interface GatewayChatRequestOptions extends ProviderDispatchRequestOptions {
  prompt?: string;
  messages?: MessageDto[];
  context?: RequestContext;
  options?: GatewayGenerationOptions;
  promptEnhancement?: PromptEnhancementOptions;
  metadata?: ContractMetadata;
}

export function createGatewayClientOptions(options: GatewayClientOptions): GatewayClientOptions {
  return {
    baseUrl: options.baseUrl,
    headers: options.headers ?? {},
    timeoutMs: options.timeoutMs,
    signal: options.signal,
    providerDispatchKeyFactory: options.providerDispatchKeyFactory,
  };
}

export declare function createGatewayChatRequest(
  options: GatewayChatRequestOptions,
): GatewayChatRequest & ProviderDispatchRequestOptions;

export declare function createManagedLocalClientPopProofHeader(
  options: ManagedLocalClientPopProofOptions,
): Promise<ManagedLocalClientPopProofHeader>;

/** Returns sensitive caller-owned key bytes; never log or serialize them. */
export declare function deriveLocalClientReceiptReconciliationProtocolKey(
  options: LocalClientReceiptProtocolKeyDerivationOptions,
): Promise<Uint8Array>;

/** Stateless exact-shape/HMAC verification; it does not persist replay state. */
export declare function verifyLocalClientDispatchIntent(
  options: VerifyLocalClientDispatchIntentOptions,
): Promise<LocalClientDispatchIntent>;

/** Stateless verification of a read-only query; it never authorizes execution. */
export declare function verifyLocalClientReceiptReconciliationQuery(
  options: VerifyLocalClientReceiptReconciliationQueryOptions,
): Promise<LocalClientReceiptReconciliationQuery>;

export declare function verifyLocalClientDurableExecutionReceipt(
  options: VerifyLocalClientDurableExecutionReceiptOptions,
): Promise<LocalClientDurableExecutionReceipt>;

/** Caller remains responsible for atomic durable effect/receipt storage. */
export declare function createLocalClientDurableExecutionReceipt(
  options: CreateLocalClientDurableExecutionReceiptOptions,
): Promise<LocalClientDurableExecutionReceipt>;

export declare function createLocalClientCompletedReceiptReconciliationResponse(
  options: CreateLocalClientCompletedReceiptReconciliationResponseOptions,
): Promise<LocalClientReceiptReconciliationResponse>;

/** Use only after durable client state proves no effect claim occurred. */
export declare function createLocalClientFailedBeforeEffectReconciliationResponse(
  options: CreateLocalClientFailedBeforeEffectReconciliationResponseOptions,
): Promise<LocalClientReceiptReconciliationResponse>;

/** Pending is receipt-less, read-only, and never authorizes retry or execution. */
export declare function createLocalClientPendingReconciliationResponse(
  options: CreateLocalClientPendingReconciliationResponseOptions,
): Promise<LocalClientReceiptReconciliationResponse>;

/** Absence is not proof of non-execution and never authorizes retry. */
export declare function createLocalClientNotFoundReconciliationResponse(
  options: CreateLocalClientNotFoundReconciliationResponseOptions,
): Promise<LocalClientReceiptReconciliationResponse>;

export declare function createGatewayClient(options: GatewayClientOptions): GatewayClient;
