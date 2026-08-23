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
export interface GatewayFunctionTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
    strict?: boolean;
  };
}
export type GatewayToolChoice =
  | "none"
  | "auto"
  | "required"
  | { type: "function"; function: { name: string } };
export type PromptEnhancementProfile = "general" | "coding" | "analysis" | "writing" | "research" | "planning";
export type PromptEnhancementProfileOption = "auto" | PromptEnhancementProfile;
export type PromptEnhancementLanguage = "zh-CN" | "en";
export type PromptEnhancementLanguageOption = "auto" | PromptEnhancementLanguage;
export type PromptEnhancementTarget = "model" | "agent";
export type PromptEnhancementIntent =
  | "translate"
  | "summarize"
  | "plan"
  | "investigate"
  | "evaluate"
  | "explain"
  | "modify"
  | "operate"
  | "create"
  | "assist";

export interface PromptEnhancementOptions {
  enabled: boolean;
  profile?: PromptEnhancementProfileOption;
  language?: PromptEnhancementLanguageOption;
  target?: PromptEnhancementTarget;
}

export interface PromptEnhancementRequest {
  input: string;
  profile?: PromptEnhancementProfileOption;
  language?: PromptEnhancementLanguageOption;
  target?: PromptEnhancementTarget;
  context?: RequestContext;
}

export interface PromptEnhancementSummary {
  applied: true;
  profile: PromptEnhancementProfile;
  language: PromptEnhancementLanguage;
  target?: PromptEnhancementTarget;
  intent?: PromptEnhancementIntent | null;
  engine: "local-deterministic";
  version: string;
  providerCalled: false;
  originalPreserved: boolean;
}

export interface PromptEnhancementSection {
  id: "context" | "execution" | "output" | "acceptance" | "agent";
  title: string;
  items: string[];
}

export interface PromptEnhancementEntities {
  technologies: string[];
  artifacts: string[];
  quantities: string[];
  timeExpressions: string[];
  references: string[];
}

export interface PromptEnhancementAmbiguity {
  span: string;
  kind: "reference" | "quality" | "quantity";
  question: string;
}

export interface PromptEnhancementAnalysis {
  intent: {
    kind: PromptEnhancementIntent;
    label: string;
  };
  entities: PromptEnhancementEntities;
  deliverable: string;
  steps: string[];
  ambiguities: PromptEnhancementAmbiguity[];
}

export interface PromptEnhancementResult {
  original: string;
  enhancedPrompt: string;
  requestedProfile: PromptEnhancementProfileOption;
  profile: PromptEnhancementProfile;
  language: PromptEnhancementLanguage;
  target: PromptEnhancementTarget;
  changed: boolean;
  sections: PromptEnhancementSection[];
  analysis: PromptEnhancementAnalysis;
  constraints: string[];
  assumptions: string[];
  clarifyingQuestions: string[];
  signals: Record<string, boolean>;
  quality: {
    signalCoverage: number;
    clarificationsNeeded: number;
    constraintsDetected: boolean;
    assumptionCount: number;
    ambiguityCount: number;
    entityCount: number;
    qualityLevel: "high" | "medium" | "needs-clarification";
    recommendations: string[];
  };
  metadata: {
    engine: "local-deterministic";
    version: string;
    providerCalled: false;
    credentialRequired: false;
    originalPreserved: boolean;
    deterministic: true;
    target: PromptEnhancementTarget;
  };
}

export interface PromptEnhancementContractFixture {
  request: PromptEnhancementRequest;
  response: PromptEnhancementResult;
}

export interface GatewayGenerationOptions {
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  responseFormat?: GatewayResponseFormat;
  reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh";
  stream?: boolean;
}

export interface GatewayRequest {
  context?: RequestContext;
  taskType: AiTaskType;
  messages: MessageDto[];
  model?: string;
  providerId?: string;
  options?: GatewayGenerationOptions;
  tools?: GatewayFunctionTool[];
  toolChoice?: GatewayToolChoice;
  parallelToolCalls?: boolean;
  requiredCapabilities?: ProviderCapability[];
  promptEnhancement?: PromptEnhancementOptions;
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
  promptEnhancement?: PromptEnhancementSummary;
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

export type OpenAiCompatibleMessageRole = "developer" | "system" | "user" | "assistant";

export interface OpenAiCompatibleTextPart {
  type: "text";
  text: string;
}

export interface OpenAiCompatibleImageUrlPart {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
}

export interface OpenAiCompatibleMessage {
  role: OpenAiCompatibleMessageRole;
  content: string | Array<OpenAiCompatibleTextPart | OpenAiCompatibleImageUrlPart>;
  name?: string;
}

export interface OpenAiCompatibleExtension {
  provider_id?: string;
  prompt_enhancement?: boolean | PromptEnhancementOptions;
}

export interface OpenAiCompatibleChatCompletionRequest {
  model: string;
  messages: OpenAiCompatibleMessage[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  stop?: string | string[];
  n?: 1;
  response_format?: { type: "text" };
  unified_ai?: OpenAiCompatibleExtension;
}

export interface OpenAiCompatibleUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface OpenAiCompatibleMetadata {
  request_id: string | null;
  selected_provider: string | null;
  selected_model: string | null;
  execution_mode: GatewayExecutionMode | null;
  execution_status: GatewayExecutionStatus | null;
  prompt_enhancement?: PromptEnhancementSummary;
}

export interface OpenAiCompatibleChatCompletion {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: "assistant"; content: string };
    logprobs: null;
    finish_reason: "stop" | "length" | "content_filter" | "tool_calls";
  }>;
  usage: OpenAiCompatibleUsage;
  system_fingerprint: null;
  unified_ai: OpenAiCompatibleMetadata;
}

export interface OpenAiCompatibleChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: { role?: "assistant"; content?: string };
    logprobs: null;
    finish_reason: "stop" | null;
  }>;
  system_fingerprint: null;
  unified_ai: OpenAiCompatibleMetadata;
}

export interface OpenAiCompatibleModel {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
  unified_ai: {
    provider_id: string;
    provider_type: string;
    execution_mode: "fake" | "real";
  };
}

export interface OpenAiCompatibleModelList {
  object: "list";
  data: OpenAiCompatibleModel[];
}

export interface OpenAiCompatibleErrorResponse {
  error: {
    message: string;
    type: "authentication_error" | "invalid_request_error" | "rate_limit_error" | "api_error";
    param: string | null;
    code: string;
  };
}
import type { ProviderCapability } from "./provider.js";
