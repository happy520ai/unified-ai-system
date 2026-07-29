import { HttpLLMProviderAdapter } from "./httpLlmProviderAdapter.js";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

export class OpenAIAdapter extends HttpLLMProviderAdapter {
  constructor(modelConfig = {}, options = {}) {
    super({
      ...modelConfig,
      providerId: modelConfig.providerId ?? "openai",
      providerDisplayName: modelConfig.providerDisplayName ?? "OpenAI",
      providerType: "openai",
      endpoint: modelConfig.endpoint ?? options.baseUrl ?? DEFAULT_OPENAI_BASE_URL,
      apiKey: modelConfig.apiKey ?? options.apiKey,
    }, options);
  }
}

export function createOpenAIAdapter(modelConfig, options = {}) {
  return new OpenAIAdapter(modelConfig, options);
}
