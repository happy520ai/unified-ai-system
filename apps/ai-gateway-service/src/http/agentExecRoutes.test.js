import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  AGENT_EXEC_LIMITS,
  dispatchAgentExecRoutes,
  normalizeAgentExecRequest,
} from "./agentExecRoutes.js";
import { createFakeProvider } from "../providers/fakeProvider.js";
import { ProviderRegistry } from "../providers/providerRegistry.js";

function createApplication({ fixedLatencyMs = 1 } = {}) {
  const registry = new ProviderRegistry();
  registry.register(createFakeProvider({
    providerId: "local-fake-provider",
    modelId: "local-fake-model",
    providerType: "fake",
    capabilities: ["chat"],
    enabled: true,
    fixedLatencyMs,
  }));
  return { gatewayService: { providerRegistry: registry } };
}

function createContext({ body, application = createApplication(), path = "/agent-exec/run" }) {
  const request = Readable.from([Buffer.from(JSON.stringify(body))]);
  request.method = "POST";
  const response = createResponseRecorder();
  return {
    request,
    response,
    startedAt: Date.now(),
    url: new URL(`http://127.0.0.1${path}`),
    application,
    writeServiceLog: vi.fn(),
  };
}

function createResponseRecorder() {
  const response = new EventEmitter();
  response.statusCode = null;
  response.headers = {};
  response.body = null;
  response.write = vi.fn();
  response.end = (body) => {
    if (body !== undefined) response.body = JSON.parse(String(body));
  };
  response.writeHead = (statusCode, headers = {}) => {
    response.statusCode = statusCode;
    response.headers = headers;
  };
  return response;
}

describe("bounded agent execution route", () => {
  it("runs a bounded non-interactive goal against the fake provider with structured output", async () => {
    const context = createContext({
      body: { goal: "Summarize the repository layout.", maxIterations: 4, timeoutMs: 30_000 },
    });
    await dispatchAgentExecRoutes(context);

    expect(context.response.statusCode).toBe(200);
    const result = context.response.body.data;
    expect(result.status).toBe("completed");
    expect(result.goal).toBe("Summarize the repository layout.");
    expect(result.iterations.max).toBe(4);
    expect(result.iterations.used).toBeLessThanOrEqual(4);
    expect(result.timing.timedOut).toBe(false);
    expect(result.tools.mode).toBe("readonly");
    expect(result.tools.allowlist).toEqual(["file_read"]);
    expect(result.compaction.engine).toBe("unified-context-compactor");
    expect(result.provider.id).toBe("local-fake-provider");
    expect(typeof result.finalAnswer).toBe("string");
  });

  it("honours toolMode none and custom tool allowlists", async () => {
    const none = createContext({
      body: { goal: "Answer directly.", toolMode: "none", maxIterations: 2, timeoutMs: 30_000 },
    });
    await dispatchAgentExecRoutes(none);
    expect(none.response.body.data.tools.mode).toBe("none");
    expect(none.response.body.data.tools.allowlist).toEqual([]);

    const custom = createContext({
      body: {
        goal: "Answer directly.",
        toolAllowlist: ["file_read", "glob"],
        maxIterations: 2,
        timeoutMs: 30_000,
      },
    });
    await dispatchAgentExecRoutes(custom);
    expect(custom.response.body.data.tools.mode).toBe("custom");
    expect(custom.response.body.data.tools.allowlist).toEqual(["file_read", "glob"]);
  }, 30_000);

  it("reports timeout when the provider exceeds the wall-clock bound", async () => {
    const context = createContext({
      // Single provider call (1500ms) exceeds the minimum timeout bound (1000ms),
      // so the abort fires mid-run regardless of iteration count.
      application: createApplication({ fixedLatencyMs: 1_500 }),
      body: { goal: "Slow goal.", maxIterations: 3, timeoutMs: AGENT_EXEC_LIMITS.minTimeoutMs },
    });
    await dispatchAgentExecRoutes(context);

    expect(context.response.statusCode).toBe(200);
    const result = context.response.body.data;
    expect(result.status).toBe("timeout");
    expect(result.timing.timedOut).toBe(true);
    expect(result.timing.timeoutMs).toBe(AGENT_EXEC_LIMITS.minTimeoutMs);
  }, 30_000);

  it("rejects invalid requests with structured validation errors", async () => {
    for (const body of [
      {},
      { goal: "   " },
      { goal: "x".repeat(AGENT_EXEC_LIMITS.maxGoalLength + 1) },
      { goal: "ok", maxIterations: 0 },
      { goal: "ok", maxIterations: AGENT_EXEC_LIMITS.maxIterationsCap + 1 },
      { goal: "ok", timeoutMs: 10 },
      { goal: "ok", timeoutMs: 1_000_000 },
      { goal: "ok", maxTokensPerTurn: 1 },
      { goal: "ok", toolMode: "unrestricted" },
      { goal: "ok", toolAllowlist: [42] },
      { goal: "ok", providerId: "does-not-exist" },
    ]) {
      const context = createContext({ body });
      await dispatchAgentExecRoutes(context);
      expect(context.response.statusCode).toBe(400);
      expect(context.response.body.error.code).toMatch(/^AGENT_EXEC_/);
    }
  });

  it("blocks a real provider before the adapter is invoked when runtime gates are closed", async () => {
    const registry = new ProviderRegistry({ enabledProviders: ["openai"] });
    const provider = createFakeProvider({
      providerId: "openai",
      modelId: "gpt-test",
      providerType: "openai",
      capabilities: ["chat"],
      enabled: true,
    });
    const generate = vi.spyOn(provider, "generate");
    registry.register(provider);
    const context = createContext({
      application: {
        gatewayService: {
          providerRegistry: registry,
          runtimeConfig: {
            providerMode: "fake",
            realProviderEnabled: false,
            enabledProviders: ["openai"],
          },
        },
      },
      body: { goal: "Answer directly.", providerId: "openai", modelId: "gpt-test" },
    });

    await dispatchAgentExecRoutes(context);

    expect(context.response.statusCode).toBe(400);
    expect(context.response.body.error.code).toBe("AGENT_EXEC_PROVIDER_EXECUTION_BLOCKED");
    expect(generate).not.toHaveBeenCalled();
  });

  it("normalizes defaults deterministically", () => {
    const normalized = normalizeAgentExecRequest({ goal: "Do it." });
    expect(normalized).toEqual({
      goal: "Do it.",
      maxIterations: AGENT_EXEC_LIMITS.defaultMaxIterations,
      timeoutMs: AGENT_EXEC_LIMITS.defaultTimeoutMs,
      maxTokensPerTurn: AGENT_EXEC_LIMITS.defaultMaxTokensPerTurn,
      toolMode: "readonly",
      toolAllowlist: ["file_read"],
      providerId: "local-fake-provider",
      modelId: undefined,
    });
  });
});
