export function normalizeChatBody(body, config) {
  const defaultTarget = resolveDefaultChatTarget(config);
  const currentPageSelection = normalizeCurrentPageModelSelection(body?.currentPageModelSelection);
  const fallbackTarget = defaultTarget.providerId
    ? defaultTarget
    : {
        providerId: "nvidia",
        modelId: resolveNvidiaModel(config),
      };
  const providerId = currentPageSelection?.warning
    ? fallbackTarget.providerId
    : currentPageSelection?.providerId ?? body?.providerId ?? defaultTarget.providerId;
  const modelId = currentPageSelection?.warning
    ? fallbackTarget.modelId
    : currentPageSelection?.modelId ?? body?.model ?? defaultTarget.modelId;
  const metadata = {
    ...(body?.metadata ?? {}),
  };

  if (currentPageSelection?.warning) {
    metadata.currentPageModelSelectionWarning = currentPageSelection.warning;
  }

  if (currentPageSelection?.providerId && currentPageSelection?.modelId) {
    metadata.currentPageModelSelectionApplied = {
      providerId: currentPageSelection.providerId,
      modelId: currentPageSelection.modelId,
      baseUrl: currentPageSelection.baseUrl ?? "",
      scope: "per-request",
    };
  }

  if (Array.isArray(body?.messages)) {
    return {
      ...body,
      taskType: "chat",
      providerId,
      model: modelId,
      metadata,
    };
  }

  const prompt = body?.prompt ?? body?.query;

  if (typeof prompt !== "string" || prompt.length === 0) {
    return body;
  }

  return {
    context: body.context,
    taskType: "chat",
    providerId,
    model: modelId,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    options: body.options,
    metadata,
  };
}

export function normalizeCurrentPageModelSelection(selection) {
  if (!selection || typeof selection !== "object") {
    return null;
  }

  const providerId = typeof selection.providerId === "string" ? selection.providerId.trim() : "";
  const modelId = typeof selection.modelId === "string" ? selection.modelId.trim() : "";
  const baseUrl = typeof selection.baseUrl === "string" ? selection.baseUrl.trim() : "";

  if (!providerId || !modelId) {
    return {
      warning: {
        code: "current_page_model_selection_ignored",
        message: "Ignored invalid currentPageModelSelection and used the default /chat route.",
      },
    };
  }

  return {
    providerId,
    modelId,
    baseUrl,
  };
}

export function normalizeRagChatBody(body, config) {
  const prompt = body?.prompt ?? body?.query;

  if (typeof prompt !== "string" || prompt.length === 0) {
    return normalizeChatBody(body, config);
  }

  if (body?.providerId || body?.model) {
    return {
      context: body.context,
      taskType: "chat",
      providerId: body.providerId,
      model: body.model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      options: body.options,
      metadata: body.metadata,
    };
  }

  return normalizeChatBody(body, config);
}

export function extractChatPrompt(body) {
  const direct = body?.prompt ?? body?.query;
  if (typeof direct === "string" && direct.trim().length > 0) {
    return direct.trim();
  }

  if (!Array.isArray(body?.messages)) {
    return "";
  }

  const message = [...body.messages].reverse().find((item) => item?.role !== "assistant" && typeof item?.content === "string");
  return message?.content?.trim() ?? "";
}

export function createRagRetrieveRequest(body, prompt) {
  const knowledge = body?.knowledge ?? {};
  return {
    context: body?.context,
    query: knowledge.query ?? prompt,
    mode: "keyword",
    sourceIds: Array.isArray(knowledge.sourceIds) ? knowledge.sourceIds : body?.sourceIds,
    topK: readBoundedInteger(knowledge.topK ?? body?.topK, 3, 1, 5),
    minScore: knowledge.minScore ?? body?.minScore,
    filters: knowledge.filters ?? body?.filters,
    metadata: {
      ...(knowledge.metadata ?? {}),
      phase: "phase-29a-service-rag-chat",
      caller: "chat-rag",
    },
  };
}

export function createRagCitations(chunks = []) {
  return chunks.slice(0, 5).map((chunk, index) => {
    const document = chunk.document ?? {};
    return {
      index: index + 1,
      label: `[${index + 1}]`,
      sourceId: document.sourceId ?? null,
      documentId: document.documentId ?? null,
      title: document.title ?? document.documentId ?? "Untitled",
      uri: document.uri,
      snippet: chunk.snippet ?? chunk.text ?? "",
      matchedTerms: Array.isArray(chunk.matchedTerms) ? chunk.matchedTerms : [],
      highlights: Array.isArray(chunk.highlights) ? chunk.highlights : [],
      score: chunk.score ?? null,
      scoreBreakdown: chunk.scoreBreakdown ?? null,
      metadata: document.metadata ?? {},
    };
  });
}

export function createRagPrompt(prompt, citations) {
  if (!citations.length) {
    return [
      "你是 PME 移动地球的服务端 RAG 聊天入口。",
      "本次没有检索到本地知识库片段。请直接回答用户问题；如果资料不足，请明确说明不足，不要编造。",
      "",
      "用户问题：",
      prompt,
    ].join("\n");
  }

  const context = citations
    .map((citation) =>
      [
        `${citation.label} ${citation.title}`,
        `sourceId: ${citation.sourceId ?? "unknown-source"}`,
        `documentId: ${citation.documentId ?? "unknown-document"}`,
        `matchedTerms: ${citation.matchedTerms.join(", ") || "n/a"}`,
        `snippet: ${citation.snippet}`,
      ].join("\n"),
    )
    .join("\n\n");

  return [
    "你是 PME 移动地球的服务端 RAG 聊天入口。",
    "请优先依据下面的本地知识库检索结果回答用户问题，并在答案中自然引用资料编号，例如 [1]。",
    "如果资料不足，请明确说明不足，不要编造。",
    "",
    "本地知识库检索结果：",
    context,
    "",
    "用户问题：",
    prompt,
  ].join("\n");
}

export function createRagChatData({ prompt, retrieveRequest, retrieveResult, citations, chatResult }) {
  const chatData = chatResult.data ?? {};
  return {
    answer: chatData.outputText ?? chatData.text ?? "",
    text: chatData.text ?? chatData.outputText ?? "",
    outputText: chatData.outputText ?? chatData.text ?? "",
    chat: chatData,
    rag: {
      enabled: true,
      mode: "service-side",
      phase: "phase-29a-service-rag-chat",
      prompt,
      knowledgeInjected: citations.length > 0,
      citationCount: citations.length,
    },
    knowledge: {
      query: retrieveRequest.query,
      mode: retrieveResult.mode,
      retrieved: citations.length > 0,
      chunkCount: retrieveResult.chunks?.length ?? 0,
      topHit: retrieveResult.topHit ?? null,
      topChunk: retrieveResult.topChunk ?? null,
      topDocument: retrieveResult.topDocument ?? null,
      citations,
      metadata: retrieveResult.metadata ?? {},
    },
    metadata: {
      selectedProvider: chatData.selectedProvider ?? null,
      selectedModel: chatData.selectedModel ?? null,
      executionMode: chatData.executionMode ?? null,
      executionStatus: chatData.executionStatus ?? null,
    },
  };
}

export function readBoundedInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

export function resolveDefaultChatTarget(config) {
  const providerSelection = config.aiGatewayService.providerSelection;

  if (providerSelection.mode !== "fixed") {
    return {};
  }

  const configuredProviderId = providerSelection.defaultProviderId;
  const configuredModelId = providerSelection.defaultModelId;
  const nvidiaModel = resolveNvidiaModel(config);

  return {
    providerId: configuredProviderId ?? "nvidia",
    modelId: configuredModelId ?? nvidiaModel,
  };
}

export function resolveNvidiaModel(config) {
  return (
    config.aiGatewayService.providerModels.find((provider) => provider.providerId === "nvidia")?.modelId ??
    config.aiGatewayService.providerSelection.defaultModelId
  );
}
