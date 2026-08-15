import type {
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
  WorkforceAgentsResult,
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

export interface GatewayClientOptions {
  baseUrl: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
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

export interface GatewayClient {
  readonly baseUrl: string;
  health(): Promise<ResultEnvelope<GatewayHealth>>;
  setupReadiness(): Promise<ResultEnvelope<SetupReadinessResult>>;
  enhancePrompt(request: PromptEnhancementRequest): Promise<ResultEnvelope<PromptEnhancementResult>>;
  chat(request: GatewayChatRequest): Promise<GatewayChatResult>;
  ragChat(request: RagChatRequest): Promise<RagChatResult>;
  chatStream(request: GatewayChatRequest): AsyncIterable<GatewayStreamEvent>;
  knowledgeRetrieve(request: KnowledgeRetrieveRequest): Promise<KnowledgeRetrieveResult>;
  knowledgeLoad(request: KnowledgeLoadRequest): Promise<KnowledgeLoadResult>;
  knowledgeInfraReadiness(): Promise<KnowledgeInfraReadinessResult>;
  modelImportPreview(request: ModelImportPreviewRequest): Promise<ResultEnvelope<ModelImportPreviewResult>>;
  modelImportConfirm(request: ModelImportConfirmRequest): Promise<ResultEnvelope<ModelImportConfirmResult>>;
  workflowHealth(): Promise<ResultEnvelope<Record<string, unknown>>>;
  workflowActions(): Promise<ResultEnvelope<Record<string, unknown>>>;
  workflowPlan(request: WorkflowRequest): Promise<WorkflowPlanResult>;
  workflowRun(request: WorkflowRequest): Promise<WorkflowRunResult>;
  workforceHealth(): Promise<WorkforceHealthResult>;
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
  generate(request: GatewayRequest): Promise<GatewayResult>;
}

export interface GatewayChatRequestOptions {
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
  };
}

export declare function createGatewayChatRequest(options: GatewayChatRequestOptions): GatewayChatRequest;

export declare function createGatewayClient(options: GatewayClientOptions): GatewayClient;
