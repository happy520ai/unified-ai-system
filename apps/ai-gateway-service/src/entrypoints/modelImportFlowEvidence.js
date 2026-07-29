export function sanitizeResult(value) {
  if (Array.isArray(value)) return value.map(sanitizeResult);
  if (!value || typeof value !== "object") return value;
  const copy = {};
  for (const [key, item] of Object.entries(value)) {
    if (/apiKey/i.test(key)) {
      copy[key] = item ? "[redacted-ref]" : item;
    } else {
      copy[key] = sanitizeResult(item);
    }
  }
  return copy;
}

export function summarizePreview(data) {
  return {
    success: data.success,
    status: data.status,
    providerId: data.providerId,
    providerCandidates: data.providerCandidates,
    maskedKey: data.maskedKey,
    modelIds: (data.models ?? []).map((model) => model.modelId),
    source: data.source,
  };
}

export function summarizeConfirm(data) {
  return {
    success: data.success,
    status: data.status,
    providerId: data.providerId,
    runtimeProviderId: data.runtimeProviderId,
    modelId: data.modelId,
    secretStorage: data.secretStorage,
    persisted: data.persisted === true,
    runtimeChatUsable: data.runtimeChatUsable,
    defaultChatMainLaneChanged: data.defaultChatMainLaneChanged,
  };
}

export function summarizeProviders(providers) {
  return (providers ?? []).map((provider) => ({
    id: provider.id,
    runtimeCredentialPresent: provider.metadata?.runtimeCredentialPresent === true,
    runtimeModelCount: provider.metadata?.runtimeModelCount ?? 0,
  }));
}

export function createModelImportEvidenceMarkdown(body) {
  return `# Phase 8A Model Import Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- NVIDIA preview: ${body.results?.nvidia?.status} / ${(body.results?.nvidia?.modelIds ?? []).join(", ")}
- OpenAI preview: ${body.results?.openai?.status} / ${(body.results?.openai?.modelIds ?? []).join(", ")}
- DashScope preview: ${body.results?.dashscope?.status} / ${(body.results?.dashscope?.modelIds ?? []).join(", ")}
- Gemini preview: ${body.results?.gemini?.status} / ${(body.results?.gemini?.modelIds ?? []).join(", ")}
- Multi-provider status: ${body.results?.multi?.status}
- OpenAI-compatible base URL preview: ${body.results?.compatible?.status} / ${(body.results?.compatible?.modelIds ?? []).join(", ")}
- Unknown key with NVIDIA hint preview: ${body.results?.unknownProviderNvidiaHint?.status}
- No-chat-models status: ${body.results?.noChatModels?.status}
- Invalid-key status: ${body.results?.invalid?.status}
- Unknown-key status: ${body.results?.unknown?.status}
- Global provider hint coverage: ${body.safety?.globalProviderHintProbeCoverage}
- Global providers: ${Object.entries(body.results?.globalProviders ?? {}).map(([providerId, result]) => `${providerId}:${result.status}`).join(", ")}
- Provider catalog exposed: ${body.safety?.providerCatalogExposed}
- Provider catalog count: ${body.results?.providerCatalog?.count}
- Confirm status: ${body.results?.confirm?.status}
- Local user model persists across restart: ${body.safety?.localUserModelPersistsAcrossRestart}
- API key value recorded: ${body.safety?.apiKeyValueRecorded}
- Models come from provider models API: ${body.safety?.modelsComeFromProviderModelsApi}
- Default chat main lane changed: ${body.safety?.defaultChatMainLaneChanged}
- Conclusion: ${body.conclusion}
`;
}
