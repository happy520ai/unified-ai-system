import { describe, expect, it, vi } from "vitest";
import {
  HTTP_EMBEDDING_PROVIDER_ID,
  createHttpEmbeddingProvider,
  resolveEmbeddingProviderFromEnv,
} from "./httpEmbeddingProvider.ts";
import { DETERMINISTIC_EMBEDDING_ID } from "./deterministicEmbeddingProvider.ts";

function createFetchStub(vectors: number[][] | { status: number; body: unknown }) {
  return vi.fn(async () => {
    if (!Array.isArray(vectors)) {
      return {
        ok: vectors.status < 400,
        status: vectors.status,
        json: async () => vectors.body,
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: vectors.map((embedding, index) => ({ index, embedding })),
      }),
    };
  }) as unknown as typeof fetch;
}

const passthroughResolveUrl = async (url: string) => ({ url });
const providerOptions = {
  baseUrl: "https://embeddings.example.com/v1",
  model: "text-embedding-test",
  apiKey: "emb-key-1",
};

describe("httpEmbeddingProvider", () => {
  it("batches texts and maps responses by index", async () => {
    const provider = createHttpEmbeddingProvider({
      ...providerOptions,
      dimensions: 3,
      resolveUrlFn: passthroughResolveUrl,
      fetchImpl: createFetchStub([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]),
    });
    const vectors = await provider.embedTexts(["hello", "world"]);
    expect(vectors).toEqual([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]);
    expect(provider.id).toBe(HTTP_EMBEDDING_PROVIDER_ID);
    expect(provider.credentialFree).toBe(false);
    expect(provider.dimensions).toBe(3);
  });

  it("sends the model and inputs without leaking the api key into errors", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "unauthorized" }),
    }));
    const provider = createHttpEmbeddingProvider({ ...providerOptions, resolveUrlFn: passthroughResolveUrl,
      fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(provider.embedTexts(["x"])).rejects.toMatchObject({ code: "EMBEDDING_HTTP_401" });
    const callBody = JSON.parse(String((fetchImpl.mock.calls[0] as unknown[])[1] && ((fetchImpl.mock.calls[0] as unknown[])[1] as RequestInit).body));
    expect(callBody.model).toBe("text-embedding-test");
    expect(callBody.input).toEqual(["x"]);
    try {
      await provider.embedTexts(["x"]);
    } catch (error) {
      expect(String((error as Error).message)).not.toContain("emb-key-1");
    }
  });

  it("rejects incomplete or non-finite batches", async () => {
    const provider = createHttpEmbeddingProvider({
      ...providerOptions,
      resolveUrlFn: passthroughResolveUrl,
      fetchImpl: createFetchStub([[0.1, Number.NaN]]),
    });
    await expect(provider.embedTexts(["a", "b"], )).rejects.toMatchObject({
      code: "EMBEDDING_RESPONSE_INVALID",
    });
  });

  it("throws a dedicated error from the sync embedText slot", () => {
    const provider = createHttpEmbeddingProvider({
      ...providerOptions,
      resolveUrlFn: passthroughResolveUrl,
      fetchImpl: createFetchStub([[0.1]]),
    });
    expect(() => provider.embedText("x")).toThrowError(/async-only/);
  });
});

describe("resolveEmbeddingProviderFromEnv", () => {
  it("returns the deterministic provider by default (credential-free)", () => {
    const provider = resolveEmbeddingProviderFromEnv({});
    expect(provider.id).toBe(DETERMINISTIC_EMBEDDING_ID);
    expect(provider.credentialFree).toBe(true);
  });

  it("falls back to deterministic when http config is incomplete", () => {
    expect(resolveEmbeddingProviderFromEnv({
      KNOWLEDGE_EMBEDDING_PROVIDER: "http",
      KNOWLEDGE_EMBEDDING_MODEL: "m",
    }).id).toBe(DETERMINISTIC_EMBEDDING_ID);
  });

  it("returns the http provider when fully configured", () => {
    const provider = resolveEmbeddingProviderFromEnv({
      KNOWLEDGE_EMBEDDING_PROVIDER: "http",
      KNOWLEDGE_EMBEDDING_MODEL: "text-embedding-3-small",
      KNOWLEDGE_EMBEDDING_API_KEY: "key",
      KNOWLEDGE_EMBEDDING_BASE_URL: "https://api.openai.com/v1",
      KNOWLEDGE_EMBEDDING_DIMENSIONS: "1536",
    });
    expect(provider.id).toBe(HTTP_EMBEDDING_PROVIDER_ID);
    expect(provider.dimensions).toBe(1536);
  });
});
