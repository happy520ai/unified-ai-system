export const CONTRACT_VERSION = "0.2.0";

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

export interface MessageDto {
  role: MessageRole;
  content: string;
  name?: string;
  toolCallId?: string;
  metadata?: ContractMetadata;
}

export type AiTaskType =
  | "chat"
  | "reasoning"
  | "summary"
  | "retrieval"
  | "tool_use";
