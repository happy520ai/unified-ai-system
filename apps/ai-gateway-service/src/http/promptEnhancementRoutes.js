import { createErrorEnvelope, createOkEnvelope } from "@unified-ai-system/shared-utils";
import { enhanceNaturalLanguagePrompt } from "../prompts/naturalLanguagePromptEnhancer.js";
import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";
import { readJson, writeJson } from "./utils/responseUtils.js";

export async function dispatchPromptEnhancementRoutes(context) {
  const {
    request,
    response,
    startedAt,
    url,
    writeServiceLog,
  } = context;

  if (request.method !== "POST" || url.pathname !== "/prompts/enhance") {
    return ROUTE_NOT_HANDLED;
  }

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
}
