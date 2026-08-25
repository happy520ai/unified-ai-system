import { createHash } from "node:crypto";

import { resolveProvider } from "./multimodalUtils.js";

type ProviderOperationGateway = {
  executeProviderOperation(input: {
    operationType: string;
    providerId: string;
    providerType: string;
    modelId: string;
    path: string;
    requestFingerprint: string;
    invoke: () => Promise<unknown>;
  }): Promise<unknown>;
};

type MultimodalAdapter = {
  generateImage(input: Record<string, any>): Promise<any>;
  generateEmbedding(input: Record<string, any>): Promise<any>;
  synthesizeSpeech(input: Record<string, any>): Promise<any>;
  transcribeAudio(input: Record<string, any>): Promise<any>;
};

export function createGovernedMultimodalAdapter({
  adapter,
  gatewayService,
  routePath,
}: {
  adapter: MultimodalAdapter;
  gatewayService: ProviderOperationGateway;
  routePath: string;
}) {
  if (!adapter || !gatewayService || typeof gatewayService.executeProviderOperation !== "function") {
    throw Object.assign(new Error("Multimodal execution requires the governed GatewayService provider-operation lane."), {
      code: "MULTIMODAL_GOVERNED_GATEWAY_REQUIRED",
      category: "persistence",
      retryable: false,
    });
  }

  return Object.freeze({
    generateImage(input: Record<string, any>) {
      return execute({
        operationType: "image_generation",
        input,
        defaultModel: "provider-default-image-model",
        invoke: () => adapter.generateImage(input),
      });
    },
    generateEmbedding(input: Record<string, any>) {
      return execute({
        operationType: "embedding",
        input,
        defaultModel: "provider-default-embedding-model",
        invoke: () => adapter.generateEmbedding(input),
      });
    },
    synthesizeSpeech(input: Record<string, any>) {
      return execute({
        operationType: "text_to_speech",
        input,
        defaultModel: "provider-default-tts-model",
        invoke: () => adapter.synthesizeSpeech(input),
      });
    },
    transcribeAudio(input: Record<string, any>) {
      const audio = Buffer.isBuffer(input?.audioBuffer) ? input.audioBuffer : Buffer.alloc(0);
      const fingerprintInput = {
        ...input,
        audioBuffer: undefined,
        audioBytes: audio.byteLength,
        audioSha256: createHash("sha256").update(audio).digest("hex"),
      };
      return execute({
        operationType: "speech_to_text",
        input,
        fingerprintInput,
        defaultModel: "provider-default-stt-model",
        invoke: () => adapter.transcribeAudio(input),
      });
    },
  });

  function execute({
    operationType,
    input,
    fingerprintInput = input,
    defaultModel,
    invoke,
  }: {
    operationType: string;
    input: Record<string, any>;
    fingerprintInput?: Record<string, any>;
    defaultModel: string;
    invoke: () => Promise<unknown>;
  }) {
    const providerId = resolveProvider(input?.provider, input?.model);
    const modelId = String(input?.model ?? defaultModel).trim();
    const { requestId: _transportRequestId, ...stableFingerprintInput } = fingerprintInput;
    return gatewayService.executeProviderOperation({
      operationType,
      providerId,
      providerType: providerId,
      modelId,
      path: routePath,
      requestFingerprint: hashCanonical({
        operationType,
        providerId,
        modelId,
        input: stableFingerprintInput,
      }),
      invoke,
    });
  }
}

function hashCanonical(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export const governedMultimodalAdapterInternals = Object.freeze({
  hashCanonical,
});
