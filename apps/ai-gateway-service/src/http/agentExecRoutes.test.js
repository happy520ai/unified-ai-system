// @test-isolation process
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  AGENT_EXEC_LIMITS,
  buildAgentGovernanceIdentity,
  dispatchAgentExecRoutes,
  normalizeAgentExecRequest,
} from "./agentExecRoutes.js";
import { createFakeProvider } from "../providers/fakeProvider.js";
import { ProviderRegistry } from "../providers/providerRegistry.js";
import { GatewayService } from "../core/gatewayService.js";
import { createAgentGovernanceService } from "../agent-governance/agentGovernanceService.ts";
import { createAgentGovernanceToolProxy } from "../agent-governance/toolProxy.ts";

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
  return {
    gatewayService: new GatewayService({
      providerRegistry: registry,
      runtimeConfig: {
        providerMode: "fake",
        realProviderEnabled: false,
        fallbackEnabled: false,
      },
    }),
  };
}

function createContext({
  body,
  application = createApplication(),
  path = "/agent-exec/run",
  enterpriseIdentity = null,
  requestExecution = null,
}) {
  const request = Readable.from([Buffer.from(JSON.stringify(body))]);
  request.method = "POST";
  request.enterpriseIdentity = enterpriseIdentity;
  const response = createResponseRecorder();
  return {
    request,
    response,
    startedAt: Date.now(),
    url: new URL(`http://127.0.0.1${path}`),
    application,
    writeServiceLog: vi.fn(),
    requestId: "req_agent_exec_test",
    requestExecution,
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
      // The wall-clock budget includes bounded project-context I/O. Use the
      // product default so host contention does not turn this semantic
      // completion check into the dedicated timeout case below.
      body: {
        goal: "Summarize the repository layout.",
        maxIterations: 4,
        timeoutMs: AGENT_EXEC_LIMITS.defaultTimeoutMs,
      },
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
  }, 90_000);

  it("honours toolMode none and custom tool allowlists", async () => {
    const none = createContext({
      body: {
        goal: "Answer directly.",
        toolMode: "none",
        maxIterations: 2,
        timeoutMs: AGENT_EXEC_LIMITS.defaultTimeoutMs,
      },
    });
    await dispatchAgentExecRoutes(none);
    expect(none.response.body.data.tools.mode).toBe("none");
    expect(none.response.body.data.tools.allowlist).toEqual([]);

    const custom = createContext({
      body: {
        goal: "Answer directly.",
        toolAllowlist: ["file_read", "glob"],
        maxIterations: 2,
        timeoutMs: AGENT_EXEC_LIMITS.defaultTimeoutMs,
      },
    });
    await dispatchAgentExecRoutes(custom);
    expect(custom.response.body.data.tools.mode).toBe("custom");
    expect(custom.response.body.data.tools.allowlist).toEqual(["file_read", "glob"]);
  }, 130_000);

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

  it("propagates the HTTP execution abort into the provider and terminates the run", async () => {
    const application = createApplication();
    const provider = application.gatewayService.providerRegistry.get("local-fake-provider");
    const requestController = new AbortController();
    let observedSignal;
    provider.generate = vi.fn(async (request) => {
      observedSignal = request.execution?.signal;
      await new Promise((resolve, reject) => {
        if (observedSignal?.aborted) {
          reject(observedSignal.reason);
          return;
        }
        observedSignal?.addEventListener("abort", () => reject(observedSignal.reason), { once: true });
      });
    });
    const context = createContext({
      application,
      requestExecution: {
        signal: requestController.signal,
        timeoutMs: 60_000,
        deadlineAt: Date.now() + 60_000,
      },
      body: { goal: "Cancel with the HTTP request.", toolMode: "none", maxIterations: 1, timeoutMs: 60_000 },
    });

    const running = dispatchAgentExecRoutes(context);
    await vi.waitFor(
      () => expect(provider.generate).toHaveBeenCalledOnce(),
      { timeout: 15_000, interval: 50 },
    );
    requestController.abort(Object.assign(new Error("client disconnected"), { code: "CLIENT_DISCONNECTED" }));
    await running;

    expect(observedSignal?.aborted).toBe(true);
    expect(context.response.statusCode).toBe(200);
    expect(context.response.body.data.status).toBe("cancelled");
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
      agentId: null,
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

  it("binds agentId to server-authenticated identity and rejects a bare body id", () => {
    expect(buildAgentGovernanceIdentity({}, "agt_valid", "req_1")).toBeNull();
    expect(buildAgentGovernanceIdentity({
      enterpriseIdentity: {
        tenantId: "tenant_a",
        userId: "user_a",
        role: "operator",
        permissions: ["workflow:run"],
      },
    }, "agt_valid", "req_1")).toEqual({
      agentId: "agt_valid",
      tenantId: "tenant_a",
      userId: "user_a",
      role: "operator",
      permissions: ["workflow:run"],
      requestId: "req_1",
    });
  });

  it("fails closed when governance is enabled but agentId or identity is missing", async () => {
    const base = createApplication();
    const authorizeAgentExecution = vi.fn();
    const application = {
      ...base,
      agentGovernance: {
        service: { authorizeAgentExecution, reserveUsage: vi.fn(async () => ({ allowed: true })) },
        toolProxy: { enforce: vi.fn() },
      },
    };
    for (const input of [
      { body: { goal: "No agent id.", toolMode: "none" }, enterpriseIdentity: {
        tenantId: "tenant_a", userId: "user_a", permissions: ["workflow:run"],
      } },
      { body: { goal: "No identity.", agentId: "agt_valid", toolMode: "none" }, enterpriseIdentity: null },
    ]) {
      const context = createContext({ ...input, application });
      await dispatchAgentExecRoutes(context);
      expect(context.response.statusCode).toBe(403);
      expect(context.response.body.error.code).toBe("AGENT_GOVERNANCE_IDENTITY_REQUIRED");
    }
    expect(authorizeAgentExecution).not.toHaveBeenCalled();
  });

  it("authorizes a governed run before provider execution and applies policy bounds", async () => {
    const base = createApplication();
    const policy = {
      policyHash: "sha256:test",
      limits: { maxSteps: 1, maxRuntimeSeconds: 5 },
      grantedTools: [],
      toolDecisions: {},
    };
    const runController = new AbortController();
    const authorizeAgentExecution = vi.fn().mockResolvedValue({
      policy,
      executionLease: { signal: runController.signal, release: vi.fn() },
    });
    const application = {
      ...base,
      agentGovernance: {
        service: { authorizeAgentExecution, reserveUsage: vi.fn(async () => ({ allowed: true })) },
        toolProxy: { enforce: vi.fn() },
      },
    };
    const context = createContext({
      application,
      enterpriseIdentity: {
        tenantId: "tenant_a",
        userId: "user_a",
        role: "operator",
        permissions: ["workflow:run"],
      },
      body: {
        goal: "Answer without tools.",
        agentId: "agt_valid",
        toolMode: "none",
        maxIterations: 4,
        timeoutMs: 10_000,
      },
    });
    await dispatchAgentExecRoutes(context);
    expect(context.response.statusCode).toBe(200);
    expect(authorizeAgentExecution).toHaveBeenCalledWith("agt_valid", expect.objectContaining({
      agentId: "agt_valid",
      tenantId: "tenant_a",
      userId: "user_a",
    }));
    expect(context.response.body.data.iterations.max).toBe(1);
    expect(context.response.body.data.timing.timeoutMs).toBe(5_000);
    expect(context.response.body.data.governance).toEqual({
      enforced: true,
      agentId: "agt_valid",
      policyHash: "sha256:test",
    });
  }, 30_000);

  it("enforces cumulative maxSteps before a later provider iteration", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "agent-governance-exec-route-"));
    try {
      const governanceService = createAgentGovernanceService({
        dataDir,
        env: {
          AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "agent-exec-route-test-secret-0123456789",
          PME_ENTERPRISE_PLATFORM_TENANT_ID: "tenant_a",
        },
      });
      const identity = {
        tenantId: "tenant_a",
        userId: "user_a",
        role: "admin",
        permissions: ["*"],
      };
      const agent = await governanceService.generateAgent({
        name: "single-step",
        task: "answer once",
        requestedTools: [],
        ttlSeconds: 3600,
        parentAgentId: null,
        instanceRules: { limits: { maxSteps: 1 } },
      }, identity);
      const application = {
        ...createApplication(),
        agentGovernance: {
          service: governanceService,
          toolProxy: createAgentGovernanceToolProxy({ service: governanceService }),
        },
      };
      const requestBody = {
        goal: "Answer directly.",
        agentId: agent.agentId,
        toolMode: "none",
        maxIterations: 1,
      };
      const first = createContext({ body: requestBody, application, enterpriseIdentity: identity });
      await dispatchAgentExecRoutes(first);
      expect(first.response.body.data.status).toBe("completed");

      const second = createContext({ body: requestBody, application, enterpriseIdentity: identity });
      await dispatchAgentExecRoutes(second);
      expect(second.response.body.data.status).toBe("governance_denied");
      expect((await governanceService.getUsage(agent.agentId)).steps).toBe(1);
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  }, 30_000);

  it("aborts an in-flight provider run and waits for its execution lease during revocation", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "agent-governance-revoke-run-"));
    try {
      const governanceService = createAgentGovernanceService({
        dataDir,
        env: {
          AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "agent-revoke-run-test-secret-0123456789",
          PME_ENTERPRISE_PLATFORM_TENANT_ID: "tenant_a",
        },
      });
      const identity = {
        tenantId: "tenant_a",
        userId: "user_a",
        role: "admin",
        permissions: ["*"],
      };
      const agent = await governanceService.generateAgent({
        name: "revoked-provider-run",
        task: "wait for provider",
        requestedTools: [],
        ttlSeconds: 3600,
        parentAgentId: null,
      }, identity);
      const application = {
        ...createApplication(),
        agentGovernance: {
          service: governanceService,
          toolProxy: createAgentGovernanceToolProxy({ service: governanceService }),
          dataDir,
        },
      };
      const provider = application.gatewayService.providerRegistry.get("local-fake-provider");
      let signalProviderStarted;
      const providerStarted = new Promise((resolve) => { signalProviderStarted = resolve; });
      provider.generate = vi.fn(async (request) => {
        signalProviderStarted();
        await new Promise((resolve, reject) => {
          if (request.execution?.signal?.aborted) {
            reject(Object.assign(new Error("provider aborted"), { name: "AbortError", code: "ABORT_ERR" }));
            return;
          }
          request.execution?.signal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("provider aborted"), { name: "AbortError", code: "ABORT_ERR" }));
          }, { once: true });
        });
      });
      const context = createContext({
        application,
        enterpriseIdentity: identity,
        body: {
          goal: "Wait until revoked.",
          agentId: agent.agentId,
          toolMode: "none",
          maxIterations: 1,
          timeoutMs: 10_000,
        },
      });

      const run = dispatchAgentExecRoutes(context);
      await providerStarted;
      const revoke = governanceService.revokeAgent(agent.agentId, { cascade: true, reason: "operator stop" }, identity);
      await Promise.all([run, revoke]);

      expect(context.response.statusCode).toBe(200);
      expect(context.response.body.data.status).toBe("cancelled");
      expect(await governanceService.getAgent(agent.agentId, "tenant_a")).toMatchObject({ status: "REVOKED" });
      expect(provider.generate).toHaveBeenCalledOnce();
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  }, 30_000);

  it("rejects high-risk requests before provider execution when opt-in or durable effect infrastructure is missing", async () => {
    const identity = {
      tenantId: "tenant_a",
      userId: "user_a",
      role: "admin",
      permissions: ["*"],
    };
    for (const scenario of [
      {
        highRiskTools: [],
        externalEffectGate: null,
        expectedStatus: 403,
        expectedCode: "AGENT_EXEC_HIGH_RISK_TOOL_DISABLED",
      },
      {
        highRiskTools: ["git_push"],
        externalEffectGate: {
          status: { enabled: false, durable: false },
          checkHealth: vi.fn(async () => ({ available: false })),
        },
        expectedStatus: 503,
        expectedCode: "AGENT_EXEC_EXTERNAL_EFFECT_GATE_REQUIRED",
      },
    ]) {
      const base = createApplication();
      const provider = base.gatewayService.providerRegistry.get("local-fake-provider");
      const generate = vi.spyOn(provider, "generate");
      const release = vi.fn();
      const application = {
        ...base,
        externalEffectGate: scenario.externalEffectGate,
        agentGovernance: {
          highRiskTools: scenario.highRiskTools,
          dataDir: join(tmpdir(), "agent-governance-preflight"),
          toolProxy: { enforce: vi.fn() },
          service: {
            reserveUsage: vi.fn(async () => ({ allowed: true })),
            authorizeAgentExecution: vi.fn(async () => ({
              policy: {
                policyHash: `sha256:${"a".repeat(64)}`,
                limits: { maxSteps: 1, maxRuntimeSeconds: 30 },
                grantedTools: ["git_push"],
                toolDecisions: { git_push: "require_approval" },
              },
              executionLease: {
                signal: new AbortController().signal,
                fingerprint: "b".repeat(64),
                assertActive: vi.fn(async () => true),
                release,
              },
            })),
          },
        },
      };
      const context = createContext({
        application,
        enterpriseIdentity: identity,
        body: {
          goal: "Attempt a governed push.",
          agentId: "agt_valid",
          toolAllowlist: ["git_push"],
          maxIterations: 1,
        },
      });
      await dispatchAgentExecRoutes(context);
      expect(context.response.statusCode).toBe(scenario.expectedStatus);
      expect(context.response.body.error.code).toBe(scenario.expectedCode);
      expect(generate).not.toHaveBeenCalled();
      expect(release).toHaveBeenCalledOnce();
    }
  });
});
