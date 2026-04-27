import type { GatewayRequest, GatewayUsage, MessageDto, ProviderDescriptor, ProviderTarget } from "@unified-ai-system/shared-contracts";

export type ProviderType = "fake" | "openai" | "nvidia" | "http-llm";

export interface ProviderRequest {
  request: GatewayRequest;
  target: ProviderTarget;
  trace: {
    requestId: string;
    traceId: string;
  };
}

export interface ProviderResponse {
  text: string;
  message: MessageDto;
  usage?: GatewayUsage;
  latencyMs: number;
  executionStatus: "success" | "dry_run" | "unavailable" | "error";
  warnings?: ProviderWarning[];
  raw?: unknown;
}

export interface ProviderWarning {
  code: string;
  message: string;
}

export interface ProviderAdapter {
  readonly descriptor: ProviderDescriptor;
  generate(request: ProviderRequest): Promise<ProviderResponse>;
}
