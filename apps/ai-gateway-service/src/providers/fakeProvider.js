import { withTimeout } from "../../../../packages/shared-utils/src/index.js";
import { createProviderDescriptor } from "./providerAdapter.js";
import { createProviderResponse } from "./providerMapping.js";

export function createFakeProvider(modelConfig, options = {}) {
  const fixedLatencyMs = modelConfig.fixedLatencyMs ?? 10;
  const descriptor = createProviderDescriptor(modelConfig, {
    metadata: {
      fake: true,
    },
    modelMetadata: {
      phase: "phase-6-real-provider-validation",
      fixedLatencyMs,
    },
  });

  return {
    descriptor,
    async generate(providerRequest) {
      if (modelConfig.failMode === "retryable") {
        throw createFakeProviderError(providerRequest);
      }

      const startedAt = Date.now();
      const task = executeFakeGeneration(providerRequest, fixedLatencyMs);
      const result = await withTimeout(task, {
        timeoutMs: options.timeoutMs ?? 10_000,
        label: `${providerRequest.target.providerId}/${providerRequest.target.modelId}`,
      });

      return {
        ...result,
        latencyMs: Date.now() - startedAt,
      };
    },
    async *generateStream(providerRequest) {
      if (modelConfig.failMode === "retryable") {
        throw createFakeProviderError(providerRequest);
      }

      const result = await executeFakeGeneration(providerRequest, fixedLatencyMs);
      const parts = splitForStream(result.text);

      for (const part of parts) {
        await sleep(Math.max(1, Math.min(fixedLatencyMs, 8)));
        yield {
          textDelta: part,
          raw: {
            fake: true,
          },
        };
      }
    },
  };
}

async function executeFakeGeneration(providerRequest, fixedLatencyMs) {
  const { request, target } = providerRequest;
  const prompt = getLastUserText(request);
  const text = `[fake:${target.providerId}/${target.modelId}] ${prompt}`;
  await sleep(fixedLatencyMs);

  return createProviderResponse({
    text,
    message: {
      role: "assistant",
      content: text,
    },
    usage: {
      inputTokens: estimateTokens(prompt),
      outputTokens: estimateTokens(text),
      totalTokens: estimateTokens(prompt) + estimateTokens(text),
    },
    latencyMs: fixedLatencyMs,
    executionStatus: "success",
  });
}

function getLastUserText(request) {
  const message = [...request.messages].reverse().find((item) => item.role === "user");
  return message?.content ?? "empty request";
}

function estimateTokens(text) {
  return Math.max(1, Math.ceil(String(text).length / 4));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createFakeProviderError(providerRequest) {
  const error = new Error("Fake provider was configured to fail for fallback verification.");
  error.code = "FAKE_PROVIDER_RETRYABLE_FAILURE";
  error.type = "fake";
  error.category = "provider";
  error.retryable = true;
  error.details = {
    providerId: providerRequest.target.providerId,
    modelId: providerRequest.target.modelId,
  };
  return error;
}

function splitForStream(text) {
  const parts = String(text).match(/.{1,12}/g);
  return parts?.length ? parts : [String(text)];
}
