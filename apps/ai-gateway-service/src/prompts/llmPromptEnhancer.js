// =============================================================================
// llmPromptEnhancer.js — LLM-driven prompt enhancement layer
// Sits on top of the deterministic naturalLanguagePromptEnhancer engine.
// When a provider is available, it uses LLM to semantically rewrite the prompt.
// When no provider is available, it falls back to the deterministic engine.
// =============================================================================

import { enhanceNaturalLanguagePrompt } from "./naturalLanguagePromptEnhancer.js";

const MAX_LLM_INPUT_LENGTH = 20_000;
const SYSTEM_PROMPT = `You are a prompt engineering expert. Your task is to enhance a user's prompt to make it clearer, more specific, and more effective for an AI assistant.

Rules:
1. Preserve the original intent — never change what the user is asking for.
2. Add relevant context, constraints, and success criteria that the user may have omitted.
3. Structure the prompt with clear sections (task, context, requirements, output format).
4. Keep the enhanced prompt concise — do not pad with unnecessary filler.
5. If the original prompt is already well-structured, make minimal improvements.
6. Output ONLY the enhanced prompt text, no meta-commentary.

Return the enhanced prompt as plain text.`;

/**
 * Enhance a prompt using LLM when a provider is available.
 * Falls back to the deterministic engine when no provider is present.
 *
 * @param {Object} input - { input, profile?, language? }
 * @param {Object} options - { providerAdapter?, providerId?, modelId? }
 * @returns {Promise<Object>} Enhancement result with llmEnhanced flag
 */
export async function enhancePromptWithLLM(input = {}, options = {}) {
  // Step 1: Always run the deterministic engine first as baseline
  const baseline = enhanceNaturalLanguagePrompt(input);

  // Step 2: If no provider adapter, return baseline with llmEnhanced: false
  const { providerAdapter } = options;
  if (!providerAdapter || typeof providerAdapter.generate !== "function") {
    return {
      ...baseline,
      llmEnhanced: false,
      llmFallbackReason: "no_provider",
      metadata: {
        ...baseline.metadata,
        providerCalled: false,
        llmLayer: "unavailable",
      },
    };
  }

  // Step 3: Build LLM request
  const userMessage = buildLLMUserMessage(baseline);
  const target = {
    providerId: options.providerId ?? "default",
    modelId: options.modelId ?? "default",
  };

  try {
    const providerResponse = await providerAdapter.generate({
      request: {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        options: {
          temperature: 0.3,
          maxOutputTokens: 2048,
        },
      },
      target,
    });

    const llmText = providerResponse?.text?.trim();
    if (!llmText || llmText.length < 10) {
      return {
        ...baseline,
        llmEnhanced: false,
        llmFallbackReason: "empty_llm_output",
        metadata: {
          ...baseline.metadata,
          providerCalled: true,
          llmLayer: "fallback",
        },
      };
    }

    // Step 4: Return baseline + LLM-enhanced prompt
    return {
      ...baseline,
      enhancedPrompt: llmText,
      deterministicBaseline: baseline.enhancedPrompt,
      llmEnhanced: true,
      metadata: {
        ...baseline.metadata,
        providerCalled: true,
        llmLayer: "active",
        llmUsage: providerResponse?.usage ?? null,
        llmLatencyMs: providerResponse?.latencyMs ?? null,
      },
    };
  } catch (error) {
    return {
      ...baseline,
      llmEnhanced: false,
      llmFallbackReason: `llm_error: ${error instanceof Error ? error.message : "unknown"}`,
      metadata: {
        ...baseline.metadata,
        providerCalled: true,
        llmLayer: "error",
        llmError: error?.code ?? "unknown",
      },
    };
  }
}

function buildLLMUserMessage(baseline) {
  const lines = [
    "Enhance the following prompt. The deterministic engine has already structured it as follows:",
    "",
    "=== DETERMINISTIC BASELINE ===",
    baseline.enhancedPrompt,
    "=== END BASELINE ===",
    "",
    "Original user input:",
    baseline.original,
    "",
    `Detected profile: ${baseline.profile}`,
    `Detected language: ${baseline.language}`,
    "",
    "Please provide an enhanced version that is clearer, more specific, and more actionable.",
  ];
  return lines.join("\n");
}

export { MAX_LLM_INPUT_LENGTH };
