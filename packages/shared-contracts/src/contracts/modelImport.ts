export type ModelImportProviderId =
  | "nvidia"
  | "openai"
  | "openai-compatible"
  | "dashscope"
  | "gemini";

export type ModelImportStatus =
  | "models_discovered"
  | "needs_user_selection"
  | "needs_base_url"
  | "provider_detected_but_no_chat_models"
  | "provider_detected_but_models_empty"
  | "probe_failed"
  | "invalid_api_key"
  | "needs_provider_selection"
  | "model_imported";

export interface ModelImportPreviewRequest {
  apiKey: string;
  providerHint?: "auto" | ModelImportProviderId | string;
  baseUrl?: string | null;
}

export interface ModelImportModel {
  providerId: string;
  modelId: string;
  displayName: string;
  capabilities: string[];
  source: "provider_models_api";
  status: "discovered";
  metadata?: Record<string, unknown>;
}

export interface ModelImportPreviewResult {
  success: boolean;
  status: ModelImportStatus;
  providerId?: string;
  providerCandidates?: string[];
  models?: ModelImportModel[];
  apiKeyRef?: string;
  maskedKey?: string;
  reason?: string;
  source?: "provider_models_api";
  secretStorage?: "memory-only";
  defaultChatMainLaneChanged?: false;
}

export interface ModelImportConfirmRequest {
  providerId: string;
  modelId: string;
  apiKeyRef: string;
  displayName?: string;
}

export interface ModelImportConfirmResult {
  success: boolean;
  status: ModelImportStatus;
  providerId: string;
  modelId: string;
  displayName: string;
  secretStorage: "memory-only";
  devOnly: true;
  runtimeChatUsable: boolean;
  defaultChatMainLaneChanged: false;
}
