import { createErrorEnvelope, createOkEnvelope } from "@unified-ai-system/shared-utils";
import { getProviderExecutionDecision } from "../providers/providerExecutionGate.ts";
import { enhanceNaturalLanguagePrompt } from "../prompts/naturalLanguagePromptEnhancer.js";
import { enhancePromptWithLLM } from "../prompts/llmPromptEnhancer.js";
import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";
import { readJson, writeJson } from "./utils/responseUtils.js";
import { createGatewayBackedProviderAdapter } from "../providers/gatewayBackedProviderAdapter.ts";

export async function dispatchPromptEnhancementRoutes(context) {
  const {
    request,
    response,
    startedAt,
    url,
    writeServiceLog,
    application,
    gatewayService: requestGatewayService,
  } = context;

  // ── POST /prompts/enhance (deterministic, no provider) ──
  if (request.method === "POST" && url.pathname === "/prompts/enhance") {
    let body;
    try {
      body = await readJson(request);
    } catch {
      writeJson(response, 400, createErrorEnvelope(
        "PROMPT_ENHANCEMENT_INVALID_JSON",
        "Prompt enhancement request body must be valid JSON.",
        { startedAt, category: "validation" },
      ));
      return;
    }

    try {
      const result = enhanceNaturalLanguagePrompt(body);
      writeServiceLog?.("prompt_enhancement_completed", {
        method: request.method,
        path: url.pathname,
        inputLength: result.original.length,
        outputLength: result.enhancedPrompt.length,
        profile: result.profile,
        language: result.language,
        providerCalled: false,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 200, createOkEnvelope(result, {
        startedAt,
        traceId: body?.context?.traceId,
      }));
    } catch (error) {
      writeServiceLog?.("prompt_enhancement_failed", {
        method: request.method,
        path: url.pathname,
        code: error?.code,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 400, createErrorEnvelope(
        error?.code ?? "PROMPT_ENHANCEMENT_FAILED",
        error instanceof Error ? error.message : "Prompt enhancement failed.",
        {
          startedAt,
          category: error?.category ?? "validation",
          retryable: false,
          details: error?.details,
        },
      ));
    }
    return;
  }

  // ── POST /prompts/enhance-llm (LLM-enhanced, requires provider) ──
  if (request.method === "POST" && url.pathname === "/prompts/enhance-llm") {
    let body;
    try {
      body = await readJson(request);
    } catch {
      writeJson(response, 400, createErrorEnvelope(
        "PROMPT_ENHANCEMENT_LLM_INVALID_JSON",
        "LLM prompt enhancement request body must be valid JSON.",
        { startedAt, category: "validation" },
      ));
      return;
    }

    try {
      // Resolve provider adapter from the application's gateway service
      const gatewayService = application?.gatewayService;
      const providerRegistry = gatewayService?.providerRegistry;
      let providerAdapter = null;
      let providerId = null;
      let modelId = null;

      if (providerRegistry && body.providerId) {
        try {
          const provider = providerRegistry.get(body.providerId);
          const decision = getProviderExecutionDecision({
            providerId: body.providerId,
            providerType: provider.descriptor?.metadata?.providerType,
            runtimeConfig: gatewayService?.runtimeConfig,
          });
          if (decision.allowed) {
            providerId = body.providerId;
            modelId = body.modelId ?? provider.descriptor?.models?.[0]?.id;
            providerAdapter = createGatewayBackedProviderAdapter({
              gatewayService: requestGatewayService ?? gatewayService,
              providerId,
              modelId,
              descriptor: provider.descriptor,
              source: "prompt-enhancement-llm",
            });
          }
        } catch {
          // Provider not found — fall back to deterministic only
        }
      }

      const result = await enhancePromptWithLLM(body, {
        providerAdapter,
        providerId,
        modelId,
      });

      writeServiceLog?.("prompt_enhancement_llm_completed", {
        method: request.method,
        path: url.pathname,
        inputLength: result.original?.length ?? 0,
        outputLength: result.enhancedPrompt?.length ?? 0,
        profile: result.profile,
        language: result.language,
        llmEnhanced: result.llmEnhanced,
        providerCalled: result.metadata?.providerCalled ?? false,
        durationMs: Date.now() - startedAt,
      });

      writeJson(response, 200, createOkEnvelope(result, {
        startedAt,
        traceId: body?.context?.traceId,
      }));
    } catch (error) {
      writeServiceLog?.("prompt_enhancement_llm_failed", {
        method: request.method,
        path: url.pathname,
        code: error?.code,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 400, createErrorEnvelope(
        error?.code ?? "PROMPT_ENHANCEMENT_LLM_FAILED",
        error instanceof Error ? error.message : "LLM prompt enhancement failed.",
        {
          startedAt,
          category: error?.category ?? "validation",
          retryable: false,
          details: error?.details,
        },
      ));
    }
    return;
  }

  return ROUTE_NOT_HANDLED;
}
