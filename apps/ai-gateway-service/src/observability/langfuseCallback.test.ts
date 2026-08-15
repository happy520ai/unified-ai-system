import { describe, expect, it, vi, beforeEach } from "vitest";
import { createLangfuseCallback, readLangfuseCallbackConfig } from "./langfuseCallback.ts";

vi.mock("../security/outboundUrlPolicy.ts", () => ({
  resolveSafeOutboundUrl: vi.fn(async (url: unknown) => ({ url: String(url), lookup: undefined })),
}));

function createCapturingFetch(responses: Array<{ ok: boolean; status: number }> = []) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let callIndex = 0;
  const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const response = responses[Math.min(callIndex, responses.length - 1)] ?? { ok: true, status: 200 };
    callIndex += 1;
    return response as Response;
  });
  return { fetchImpl, calls };
}

const enabledEnv = {
  LANGFUSE_PUBLIC_KEY: "pk-lf-test",
  LANGFUSE_SECRET_KEY: "sk-lf-test",
  LANGFUSE_HOST: "https://langfuse.example.com",
};

describe("langfuse callback config", () => {
  it("is disabled without both keys", () => {
    expect(readLangfuseCallbackConfig({}).enabled).toBe(false);
    expect(readLangfuseCallbackConfig({ LANGFUSE_PUBLIC_KEY: "pk" }).enabled).toBe(false);
    expect(readLangfuseCallbackConfig(enabledEnv).enabled).toBe(true);
  });

  it("honors content capture opt-out", () => {
    expect(readLangfuseCallbackConfig(enabledEnv).captureContent).toBe(true);
    expect(readLangfuseCallbackConfig({ ...enabledEnv, LANGFUSE_CAPTURE_CONTENT: "false" }).captureContent).toBe(false);
  });
});

describe("langfuse callback ingestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records nothing when disabled", async () => {
    const { fetchImpl, calls } = createCapturingFetch();
    const callback = createLangfuseCallback({ env: {}, fetchImpl });
    expect(callback.isEnabled()).toBe(false);

    callback.recordChatGeneration({ route: "/v1/chat/completions", model: "m", stream: false });
    await callback.close();
    expect(calls.length).toBe(0);
  });

  it("batches generation events to the ingestion endpoint with basic auth", async () => {
    const { fetchImpl, calls } = createCapturingFetch();
    const callback = createLangfuseCallback({ env: enabledEnv, fetchImpl });

    callback.recordChatGeneration({
      requestId: "req-1",
      route: "/v1/chat/completions",
      model: "local-fake-model",
      provider: "local-fake-provider",
      stream: false,
      usage: { inputTokens: 8, outputTokens: 4, totalTokens: 12 },
      inputText: "hello",
      outputText: "world",
      virtualKeyFingerprint: "abc123",
    });
    await callback.close();

    expect(calls.length).toBe(1);
    expect(calls[0].url).toBe("https://langfuse.example.com/api/public/ingestion");
    const auth = String(calls[0].init.headers?.authorization ?? "");
    expect(auth).toBe(`Basic ${Buffer.from("pk-lf-test:sk-lf-test").toString("base64")}`);

    const payload = JSON.parse(String(calls[0].init.body));
    expect(payload.batch).toHaveLength(1);
    const event = payload.batch[0];
    expect(event.body.type).toBe("generation-create");
    expect(event.body.model).toBe("local-fake-model");
    expect(event.body.usage).toMatchObject({ input: 8, output: 4, total: 12, unit: "TOKENS" });
    expect(event.body.input).toBe("hello");
    expect(event.body.output).toBe("world");
    expect(event.body.metadata.virtualKeyFingerprint).toBe("abc123");
    expect(event.body.metadata.source).toBe("unified-ai-gateway");
  });

  it("truncates captured content and can opt out entirely", async () => {
    const { fetchImpl, calls } = createCapturingFetch();
    const callback = createLangfuseCallback({
      env: { ...enabledEnv, LANGFUSE_CAPTURE_CONTENT: "false" },
      fetchImpl,
    });

    callback.recordChatGeneration({
      route: "/v1/chat/completions",
      model: "m",
      stream: true,
      inputText: "x".repeat(10_000),
      outputText: "y".repeat(10_000),
    });
    await callback.close();

    const payload = JSON.parse(String(calls[0].init.body));
    expect(payload.batch[0].body.input).toBeUndefined();
    expect(payload.batch[0].body.output).toBeUndefined();
  });

  it("drops batches on non-retryable HTTP errors without throwing", async () => {
    const { fetchImpl, calls } = createCapturingFetch([{ ok: false, status: 401 }]);
    const callback = createLangfuseCallback({ env: enabledEnv, fetchImpl });

    callback.recordChatGeneration({ route: "/v1/chat/completions", model: "m", stream: false });
    await callback.close();

    // 401 is terminal: exactly one attempt, event dropped, no throw.
    expect(calls.length).toBe(1);
    expect(callback.getQueuedEventCount()).toBe(0);
  });

  it("retries once on network failure then gives up silently", async () => {
    const calls: unknown[] = [];
    const fetchImpl = vi.fn(async () => {
      calls.push(1);
      throw new Error("network down");
    });
    const callback = createLangfuseCallback({ env: enabledEnv, fetchImpl });

    callback.recordChatGeneration({ route: "/v1/chat/completions", model: "m", stream: false });
    await callback.close();

    expect(calls.length).toBe(2);
    expect(callback.getQueuedEventCount()).toBe(0);
  });
});
