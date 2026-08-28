import { describe, expect, it, vi } from "vitest";

import {
  createGovernedMultimodalAdapter,
  governedMultimodalAdapterInternals,
} from "./governedMultimodalAdapter.ts";

describe("governed multimodal adapter", () => {
  it("routes image generation through the core provider-operation lane", async () => {
    const rawAdapter = {
      generateImage: vi.fn(async () => ({ data: { provider: "openai" } })),
      generateEmbedding: vi.fn(),
      synthesizeSpeech: vi.fn(),
      transcribeAudio: vi.fn(),
    };
    const gatewayService = {
      executeProviderOperation: vi.fn(async (input) => input.invoke()),
    };
    const adapter = createGovernedMultimodalAdapter({
      adapter: rawAdapter,
      gatewayService,
      routePath: "/v1/images/generations",
    });

    await expect(adapter.generateImage({
      provider: "openai",
      model: "gpt-image-1",
      prompt: "private prompt",
      size: "1024x1024",
    })).resolves.toMatchObject({ data: { provider: "openai" } });

    expect(gatewayService.executeProviderOperation).toHaveBeenCalledWith(expect.objectContaining({
      operationType: "image_generation",
      providerId: "openai",
      modelId: "gpt-image-1",
      path: "/v1/images/generations",
      requestFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
      invoke: expect.any(Function),
    }));
    expect(JSON.stringify(gatewayService.executeProviderOperation.mock.calls[0][0]))
      .not.toContain("private prompt");
    expect(rawAdapter.generateImage).toHaveBeenCalledOnce();
  });

  it("fingerprints audio by digest and length without passing bytes to the gate", async () => {
    const rawAdapter = {
      generateImage: vi.fn(),
      generateEmbedding: vi.fn(),
      synthesizeSpeech: vi.fn(),
      transcribeAudio: vi.fn(async () => ({ data: { text: "done" } })),
    };
    const gatewayService = {
      executeProviderOperation: vi.fn(async (input) => input.invoke()),
    };
    const adapter = createGovernedMultimodalAdapter({
      adapter: rawAdapter,
      gatewayService,
      routePath: "/v1/audio/transcriptions",
    });
    const audioBuffer = Buffer.from("private-audio-bytes");

    await adapter.transcribeAudio({
      provider: "openai",
      model: "whisper-1",
      audioBuffer,
      filename: "audio.wav",
    });

    const operation = gatewayService.executeProviderOperation.mock.calls[0][0];
    expect(operation.requestFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(operation)).not.toContain(audioBuffer.toString("base64"));
    expect(operation).not.toHaveProperty("audioBuffer");
    expect(rawAdapter.transcribeAudio).toHaveBeenCalledWith(expect.objectContaining({ audioBuffer }));
  });

  it("maps embedding and text-to-speech to distinct governed operation types", async () => {
    const rawAdapter = {
      generateImage: vi.fn(),
      generateEmbedding: vi.fn(async () => ({ data: { embeddings: [[0.1]] } })),
      synthesizeSpeech: vi.fn(async () => ({ data: { audioBuffer: Buffer.from("audio") } })),
      transcribeAudio: vi.fn(),
    };
    const gatewayService = {
      executeProviderOperation: vi.fn(async (input) => input.invoke()),
    };
    const embedding = createGovernedMultimodalAdapter({
      adapter: rawAdapter,
      gatewayService,
      routePath: "/v1/embeddings",
    });
    const speech = createGovernedMultimodalAdapter({
      adapter: rawAdapter,
      gatewayService,
      routePath: "/v1/audio/speech",
    });

    await embedding.generateEmbedding({ provider: "openai", model: "embed-1", input: ["hello"] });
    await speech.synthesizeSpeech({ provider: "openai", model: "tts-1", input: "hello" });

    expect(gatewayService.executeProviderOperation.mock.calls.map(([input]) => ({
      operationType: input.operationType,
      path: input.path,
    }))).toEqual([
      { operationType: "embedding", path: "/v1/embeddings" },
      { operationType: "text_to_speech", path: "/v1/audio/speech" },
    ]);
    expect(rawAdapter.generateEmbedding).toHaveBeenCalledOnce();
    expect(rawAdapter.synthesizeSpeech).toHaveBeenCalledOnce();
  });

  it("canonical hashing is stable across object key order", () => {
    expect(governedMultimodalAdapterInternals.hashCanonical({ a: 1, b: 2 }))
      .toBe(governedMultimodalAdapterInternals.hashCanonical({ b: 2, a: 1 }));
  });
});
