// Extracted verbatim from createGatewayClient's returned object so the
// knowledge/chat domain methods live beside the SDK entrypoint. The methods
// receive the shared request context and keep their exact bodies; behaviour
// unchanged.
export function createGatewayChatMethods(ctx) {
  const { baseUrl, headers, timeoutMs, signal, providerDispatchKeyFactory, requestJson, requestSse, operatorPost, prepareProviderRequest, managedLocalClientChatImpl, prepareRequiredIdempotencyHeaders, createProviderKeyConfigurationError } = ctx;
  return {
    enhancePrompt(request) {
      return requestJson({
        baseUrl,
        path: "/prompts/enhance",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    enhancePromptLlm(request) {
      const prepared = prepareProviderRequest(request, headers, providerDispatchKeyFactory);
      return requestJson({
        baseUrl,
        path: "/prompts/enhance-llm",
        method: "POST",
        body: prepared.body,
        headers: prepared.headers,
        timeoutMs,
      });
    },
    chat(request) {
      const prepared = prepareProviderRequest(request, headers, providerDispatchKeyFactory);
      return requestJson({
        baseUrl,
        path: "/chat",
        method: "POST",
        body: prepared.body,
        headers: prepared.headers,
        timeoutMs,
        redirect: request?.contextCodec === undefined ? "follow" : "error",
      });
    },
    managedLocalClientChat(request, proofOptions) {
      return managedLocalClientChatImpl({
        baseUrl,
        request,
        proofOptions,
        headers,
        providerDispatchKeyFactory,
        signal,
        timeoutMs,
      });
    },
    ragChat(request) {
      const prepared = prepareProviderRequest(request, headers, providerDispatchKeyFactory);
      return requestJson({
        baseUrl,
        path: "/chat/rag",
        method: "POST",
        body: prepared.body,
        headers: prepared.headers,
        timeoutMs,
      });
    },
    chatStream(request) {
      const prepared = prepareProviderRequest(request, headers, providerDispatchKeyFactory);
      return requestSse({
        baseUrl,
        path: "/chat/stream",
        method: "POST",
        body: prepared.body,
        headers: prepared.headers,
        timeoutMs,
        redirect: request?.contextCodec === undefined ? "follow" : "error",
      });
    },
    knowledgeRetrieve(request) {
      return requestJson({
        baseUrl,
        path: "/knowledge/retrieve",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
        redirect: "error",
      });
    },
    knowledgeHealth() { return requestJson({ path: "/knowledge/health", redirect: "error" }); },
    knowledgeSources() { return requestJson({ path: "/knowledge/sources", redirect: "error" }); },
    routeModes() { return requestJson({ path: "/route/modes", redirect: "error" }); },
    routingPreview(kind, request) {
      if (kind !== "answer-path" && kind !== "quality-cost") throw createProviderKeyConfigurationError("Unsupported routing preview kind.");
      return requestJson({ path: `/routing/${kind}/preview`, method: "POST", body: request, redirect: "error" });
    },
    knowledgeLoad(request) {
      return operatorPost("/knowledge/load", request);
    },
    knowledgeInfraReadiness() {
      return requestJson({
        baseUrl,
        path: "/knowledge/infra/readiness",
        headers,
        timeoutMs,
      });
    },
  };
}
