export { CONTRACT_VERSION } from "../runtime.js";

export type MetadataValue =
  | string
  | number
  | boolean
  | null
  | MetadataValue[]
  | { [key: string]: MetadataValue };

export type ContractMetadata = Record<string, MetadataValue>;

export type ResultStatus = "ok" | "error";

export type ErrorCategory =
  | "validation"
  | "authentication"
  | "authorization"
  | "rate_limit"
  | "provider"
  | "routing"
  | "governance"
  | "knowledge"
  | "network"
  | "timeout"
  | "internal";

export interface RequestContext {
  requestId?: string;
  traceId?: string;
  tenantId?: string;
  actorId?: string;
  locale?: string;
  metadata?: ContractMetadata;
}

export interface ResponseMetadata {
  requestId?: string;
  traceId?: string;
  createdAt?: string;
  durationMs?: number;
  metadata?: ContractMetadata;
}

export interface ErrorShape {
  code: string;
  message: string;
  category?: ErrorCategory;
  retryable?: boolean;
  details?: ContractMetadata;
}

export interface ResultEnvelope<TData = unknown> {
  status: ResultStatus;
  data?: TData;
  error?: ErrorShape;
  meta?: ResponseMetadata;
}

export type MessageRole = "system" | "user" | "assistant" | "tool";

export type MessageImageDetail = "auto" | "low" | "high";

export interface MessageTextContentPart {
  type: "text";
  text: string;
}

export interface MessageImageUrlContentPart {
  type: "image_url";
  image_url: {
    url: string;
    detail?: MessageImageDetail;
  };
}

export type MessageContentPart = MessageTextContentPart | MessageImageUrlContentPart;

export interface FunctionToolCallDto {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface MessageDto {
  role: MessageRole;
  content: string | MessageContentPart[];
  name?: string;
  toolCallId?: string;
  toolCalls?: FunctionToolCallDto[];
  metadata?: ContractMetadata;
}

export type AiTaskType =
  | "chat"
  | "reasoning"
  | "summary"
  | "retrieval"
  | "tool_use";
