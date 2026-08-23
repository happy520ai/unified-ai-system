// =============================================================================
// llmPromptEnhancer.js — LLM-driven prompt enhancement layer
// Sits on top of the deterministic naturalLanguagePromptEnhancer engine.
// When a provider is available, it uses LLM to semantically rewrite the prompt.
// When no provider is available, it falls back to the deterministic engine.
// =============================================================================

import { enhanceNaturalLanguagePrompt } from "./naturalLanguagePromptEnhancer.js";

const MAX_LLM_INPUT_LENGTH = 20_000;
const SYSTEM_PROMPT = `You are a prompt engineering expert. Rewrite a user's prompt so that a model or an autonomous agent can understand and execute it precisely.

You will receive: the original request, a deterministic structural baseline, and a deterministic analysis (interpreted intent, key entities, inferred deliverable, suggested steps, detected ambiguities).

Rules:
1. Preserve the original intent — never change what the user is asking for, never expand the scope.
2. Keep the original request verbatim inside a marked block, exactly as the baseline does.
3. Use the deterministic analysis as ground truth: keep the interpreted intent, the entity list (never rename or drop named technologies, files, quantities, or dates), the deliverable, and the suggested step order unless the original request clearly contradicts them.
4. Turn each detected ambiguity into an explicit instruction: state the most conservative reasonable interpretation and list the ambiguity as a clarifying question to ask only if it blocks a correct result.
5. Add relevant context, constraints, and success criteria the user may have omitted — but mark added assumptions as assumptions; do not invent facts, tools, versions, or data.
6. Keep the section headings from the baseline (task essentials, execution requirements, output requirements, completion criteria; plus the agent execution protocol when present).
7. Keep the result concise and information-dense — no filler, no meta-commentary.
8. Output ONLY the enhanced prompt text.`;

/**
 * Enhance a prompt using LLM when a provider is available.
 * Falls back to the deterministic engine when no provider is present.
 *
 * @param {Object} input - { input, profile?, language?, target? }
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
        originalPreserved: llmText.includes(baseline.original),
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
    "Rewrite the prompt below. The deterministic engine has already structured it:",
    "",
    "=== ORIGINAL REQUEST ===",
    baseline.original,
    "=== END ORIGINAL REQUEST ===",
    "",
    "=== DETERMINISTIC ANALYSIS ===",
    JSON.stringify(
      {
        interpretedIntent: baseline.analysis?.intent,
        keyEntities: baseline.analysis?.entities,
        inferredDeliverable: baseline.analysis?.deliverable,
        suggestedSteps: baseline.analysis?.steps,
        detectedAmbiguities: baseline.analysis?.ambiguities?.map(
          (ambiguity) => ({ span: ambiguity.span, kind: ambiguity.kind }),
        ),
        clarifyingQuestions: baseline.clarifyingQuestions,
        detectedSignals: baseline.signals,
        hardConstraints: baseline.constraints,
        target: baseline.target,
      },
      null,
      2,
    ),
    "=== END ANALYSIS ===",
    "",
    "=== DETERMINISTIC BASELINE (keep its section structure) ===",
    baseline.enhancedPrompt,
    "=== END BASELINE ===",
    "",
    `Detected profile: ${baseline.profile}`,
    `Detected language: ${baseline.language}`,
    `Execution target: ${baseline.target}`,
    "",
    "Produce the enhanced prompt following the system rules. Output only the enhanced prompt.",
  ];
  return lines.join("\n");
}

export { MAX_LLM_INPUT_LENGTH };
