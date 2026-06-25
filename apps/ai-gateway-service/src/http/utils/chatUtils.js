// =============================================================================
// chatUtils.js — 聊天请求处理工具函数
// 从 httpServer.js 提取的聊天相关工具
// =============================================================================

/**
 * 规范化聊天请求体
 */
export function normalizeChatBody(body, config) {
  const defaultTarget = resolveDefaultChatTarget(config);
  const currentPageSelection = normalizeCurrentPageModelSelection(body?.currentPageModelSelection);
  const fallbackTarget = defaultTarget.providerId
    ? defaultTarget
    : { providerId: "nvidia", modelId: resolveNvidiaModel(config) };

  const providerId = currentPageSelection?.warning
    ? fallbackTarget.providerId
    : currentPageSelection?.providerId ?? body?.providerId ?? defaultTarget.providerId;

  const modelId = currentPageSelection?.warning
    ? fallbackTarget.modelId
    : currentPageSelection?.modelId ?? body?.model ?? defaultTarget.modelId;

  const metadata = { ...(body?.metadata ?? {}) };

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
    return { ...body, taskType: "chat", providerId, model: modelId, metadata };
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
    messages: [{ role: "user", content: prompt }],
    options: body.options,
    metadata,
  };
}

/**
 * 规范化当前页面模型选择
 */
export function normalizeCurrentPageModelSelection(selection) {
  if (!selection || typeof selection !== "object") return null;

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

  return { providerId, modelId, baseUrl };
}

/**
 * 规范化 RAG 聊天请求体
 */
export function normalizeRagChatBody(body, config) {
  const prompt = body?.prompt ?? body?.query;
  const defaultTarget = resolveDefaultChatTarget(config);
  const nvidiaModel = resolveNvidiaModel(config);
  const providerId = body?.providerId ?? defaultTarget.providerId ?? "nvidia";
  const model = body?.model ?? defaultTarget.modelId ?? nvidiaModel;

  return {
    ...body,
    taskType: "rag_chat",
    providerId,
    model,
    prompt,
    messages: body?.messages ?? [{ role: "user", content: prompt }],
  };
}

/**
 * 提取聊天提示
 */
export function extractChatPrompt(body) {
  const direct = body?.prompt ?? body?.query;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  if (!Array.isArray(body?.messages) || body.messages.length === 0) return "";
  const message = [...body.messages].reverse().find((item) => item?.role !== "assistant" && typeof item?.content === "string");
  return message?.content?.trim?.() ?? "";
}

/**
 * 创建 RAG 检索请求
 */
export function createRagRetrieveRequest(body, prompt) {
  const knowledge = body?.knowledge ?? {};
  return {
    query: prompt,
    topK: knowledge.topK ?? 5,
    threshold: knowledge.threshold,
    sourceIds: knowledge.sourceIds,
  };
}

/**
 * 创建 RAG 引用
 */
export function createRagCitations(chunks = []) {
  return chunks.map((chunk, index) => ({
    index: index + 1,
    documentId: chunk.documentId,
    sourceId: chunk.sourceId,
    title: chunk.title ?? chunk.sourceId ?? chunk.documentId,
    snippet: chunk.snippet ?? chunk.body?.slice?.(0, 400) ?? "",
    score: chunk.score,
  }));
}

/**
 * 创建 RAG 提示
 */
export function createRagPrompt(prompt, citations) {
  if (!citations.length) return prompt;
  const context = citations
    .map((item) => `[${item.index}] ${item.title}: ${item.snippet}`)
    .join("\n");
  return `Use the following context to answer.\n${context}\n\nUser question: ${prompt}`;
}

/**
 * 创建 RAG 聊天数据
 */
export function createRagChatData({ prompt, retrieveRequest, retrieveResult, citations, chatResult }) {
  const chatData = chatResult.data ?? {};
  return {
    text: chatData.text ?? "",
    model: chatData.model,
    provider: chatData.provider,
    usage: chatData.usage,
    finishReason: chatData.finishReason,
    retrieval: {
      query: retrieveRequest.query,
      chunkCount: retrieveResult.chunks.length,
      citations,
    },
  };
}

/**
 * 解析默认聊天目标
 */
export function resolveDefaultChatTarget(config) {
  const providerSelection = config.aiGatewayService.providerSelection;
  if (providerSelection.mode !== "fixed") return {};

  const configuredProviderId = providerSelection.defaultProviderId;
  const configuredModelId = providerSelection.defaultModelId;
  const nvidiaModel = resolveNvidiaModel(config);

  return {
    providerId: configuredProviderId ?? "nvidia",
    modelId: configuredModelId ?? nvidiaModel,
  };
}

/**
 * 解析 NVIDIA 模型
 */
export function resolveNvidiaModel(config) {
  return (
    config.aiGatewayService.providerModels.find((p) => p.providerId === "nvidia")?.modelId ??
    config.aiGatewayService.providerSelection.defaultModelId
  );
}
