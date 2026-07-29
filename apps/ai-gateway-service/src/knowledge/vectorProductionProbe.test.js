import { afterEach, describe, expect, it, vi } from "vitest";
import { runVectorProductionProbe } from "./vectorProductionProbe.js";

const probeEnv = {
  KNOWLEDGE_EMBEDDING_PROVIDER: "gemini",
  KNOWLEDGE_EMBEDDING_MODEL: "text-embedding-test",
  KNOWLEDGE_EMBEDDING_API_KEY: "test-key",
  KNOWLEDGE_VECTOR_STORE: "pgvector",
  PGVECTOR_CONNECTION_STRING: "postgres://test",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("vector production probe", () => {
  it("reports a contextual blocker for a non-JSON embedding response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 502,
      text: async () => "<html>upstream unavailable</html>",
    })));

    const result = await runVectorProductionProbe(probeEnv, {
      documents: [],
      expectedTopDocumentId: "expected",
    });

    expect(result.ready).toBe(false);
    expect(result.blocker).toContain("non-JSON body");
    expect(result.blocker).toContain("HTTP 502");
    expect(result.blocker).toContain("upstream unavailable");
  });
});
