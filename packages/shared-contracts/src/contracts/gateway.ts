import type {
  AiTaskType,
  ContractMetadata,
  MessageDto,
  RequestContext,
} from "./common.js";
import type { GovernanceSummary } from "./governance.js";
import type { KnowledgeRetrieveResponse } from "./knowledge.js";
import type { ProviderDescriptor } from "./provider.js";
import type { RoutingDecision } from "./routing.js";

export type GatewayResponseFormat = "text" | "json";
export type GatewayFinishReason = "stop" | "length" | "tool_call" | "filtered" | "error";

export interface GatewayGenerationOptions {
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  responseFormat?: GatewayResponseFormat;
  stream?: boolean;
}

export interface GatewayRequest {
  context?: RequestContext;
  taskType: AiTaskType;
  messages: MessageDto[];
  model?: string;
  providerId?: string;
  options?: GatewayGenerationOptions;
  knowledge?: {
    enabled: boolean;
    query?: string;
    sourceIds?: string[];
  };
  metadata?: ContractMetadata;
}

export interface GatewayChatRequest extends GatewayRequest {
  taskType: "chat";
}

export interface GatewayHealth {
  app: "ai-gateway-service";
  status: "ready";
  phase: string;
  routes: string[];
  providerMode: "fake" | "real" | "auto" | string;
  realProviderEnabled: boolean;
  providers: ProviderDescriptor[];
}

export interface GatewayUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  currency?: string;
}

export type GatewayExecutionMode = "fake" | "real" | "none";
export type GatewayExecutionStatus = "streaming" | "success" | "dry_run" | "unavailable" | "error";

export interface GatewayWarning {
  code: string;
  message: string;
}

export interface GatewayErrorSummary {
  code: string;
  message: string;
  retryable?: boolean;
  details?: ContractMetadata;
}

export interface GatewayRouteData extends GatewayResponse {
  selectedProvider: string | null;
  selectedModel: string | null;
  executionMode: GatewayExecutionMode;
  executionStatus: GatewayExecutionStatus;
  outputText: string;
  warnings: GatewayWarning[];
}

export interface GatewayRouteError {
  code: string;
  type: string;
  message: string;
  retryable: boolean;
  provider: string | null;
  model: string | null;
  details: ContractMetadata;
}

export interface GatewayRouteMeta {
  requestId: string;
  traceId?: string;
  timestamp: string;
  durationMs: number;
}

export interface GatewayRouteResult {
  success: boolean;
  code: string;
  message: string;
  data: GatewayRouteData;
  error: GatewayRouteError | null;
  meta: GatewayRouteMeta;
}

export type GatewayStreamEventType = "start" | "chunk" | "done";

export interface GatewayStreamEvent {
  type: GatewayStreamEventType;
  requestId: string;
  traceId?: string;
  selectedProvider: string;
  selectedModel: string;
  executionMode: GatewayExecutionMode;
  executionStatus: GatewayExecutionStatus;
  textDelta?: string;
  outputText: string;
  rawProviderMeta?: ContractMetadata;
  meta?: ContractMetadata;
}

export interface GatewayResponse {
  id: string;
  requestId?: string;
  timestamp?: string;
  message?: MessageDto;
  text?: string;
  outputText?: string;
  model?: string;
  providerId?: string;
  selectedProvider?: string | null;
  selectedModel?: string | null;
  executionMode?: GatewayExecutionMode;
  executionStatus?: GatewayExecutionStatus;
  durationMs?: number;
  warnings?: GatewayWarning[];
  errorSummary?: GatewayErrorSummary | null;
  finishReason?: GatewayFinishReason;
  usage?: GatewayUsage;
  routing?: RoutingDecision;
  governance?: GovernanceSummary;
  knowledge?: KnowledgeRetrieveResponse;
  metadata?: ContractMetadata;
}

export type GatewayResult = GatewayRouteResult;
export type GatewayChatResult = GatewayRouteResult;
