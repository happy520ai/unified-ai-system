import { describe, expect, it, vi } from "vitest";
import { A2A_PROTOCOL_VERSION } from "@a2a-js/sdk";
import { DefaultExecutionEventBusManager } from "@a2a-js/sdk/server";
import { GatewayService } from "../core/gatewayService.js";
import { ProviderRegistry } from "../providers/providerRegistry.js";
import { createFakeProvider } from "../providers/fakeProvider.js";
import { createWeightedTrafficPolicy } from "../routing/weightedTrafficPolicy.js";
import { bindA2AGatewayCall } from "./a2aGatewayExecution.ts";
import { Readable } from "node:stream";
import { dispatchA2ARoutes } from "./a2aRoutes.js";
import {
  A2A_JSONRPC_PATH,
  a2aGatewayInternals,
  createA2AGateway,
} from "./a2aGateway.js";

function createGateway(env = {}) {
  return createA2AGateway({
    gatewayService: { execute: vi.fn() },
    env,
  });
}

describe("managed A2A method admission before SDK task side effects", () => {
  it.each([
    { method: "GetTask", params: { id: "task" } }, { method: "ListTasks", params: {} },
    { method: "CancelTask", params: { id: "task" } }, { method: "message/stream", params: {} },
    { method: "SendMessage", params: { configuration: { returnImmediately: true } } },
    { method: "SendMessage", params: { configuration: { returnImmediately: "false" } } },
    { method: "SendMessage", params: { metadata: { unifiedAi: { executionMode: "workforce" } } } },
    [[]],
  ])("denies unsupported managed operation %j before handler or task storage", async input => {
    const gateway = createGateway(); const handle = vi.spyOn(gateway.transportHandler, "handle"); const save = vi.spyOn(gateway.taskStore, "save");
    const request = Readable.from([Buffer.from(JSON.stringify(Array.isArray(input) ? input : { jsonrpc: "2.0", id: 1, ...input }))]);
    request.method = "POST"; request.headers = {};
    request.enterpriseIdentity = { tenantId: "managed", userId: "subject", role: "local_client", managedClientId: "desktop.managed" };
    let status; let payload;
    await dispatchA2ARoutes({ a2aGateway: gateway, request, url: new URL("http://127.0.0.1/a2a/jsonrpc"), startedAt: Date.now(),
      application: { localClientProtocolPrincipalResolver: { resolve: () => ({ tenantId: "managed", subjectId: "subject", clientId: "desktop.managed" }) } },
      response: { writeHead(value) { status = value; }, end(value) { payload = JSON.parse(value); } } });
    expect(status).toBe(403); expect(payload.error.data.code).toBe("LOCAL_CLIENT_A2A_METHOD_UNSUPPORTED");
    expect(handle).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled(); await gateway.close();
  });
});

describe("A2A gateway profile", () => {
  it("advertises a loopback JSON-RPC v1.0 endpoint and text-only capabilities", () => {
    const gateway = createGateway({
      AI_GATEWAY_SERVICE_HOST: "0.0.0.0",
      AI_GATEWAY_SERVICE_PORT: "4010",
    });

    expect(gateway.publicBaseUrl).toBe("http://127.0.0.1:4010");
    expect(gateway.agentCardJson.supportedInterfaces).toEqual([
      expect.objectContaining({
        url: `http://127.0.0.1:4010${A2A_JSONRPC_PATH}`,
        protocolBinding: "JSONRPC",
        protocolVersion: A2A_PROTOCOL_VERSION,
      }),
    ]);
    expect(gateway.agentCardJson.defaultInputModes).toEqual(["text/plain"]);
    expect(gateway.agentCardJson.defaultOutputModes).toEqual(["text/plain"]);
    expect(gateway.agentCardJson.version).toBe("0.5.0");
    expect(gateway.agentCardJson.capabilities).toEqual(expect.objectContaining({
      streaming: false,
      pushNotifications: false,
      extendedAgentCard: false,
    }));
    expect(gateway.agentCardJson.securitySchemes).toBeUndefined();
  });

  it("advertises Bearer authentication when enterprise auth is enabled", () => {
    const gateway = createGateway({
      A2A_PUBLIC_BASE_URL: "https://gateway.example.test/base/",
      PME_ENTERPRISE_AUTH_ENABLED: "true",
    });

    expect(gateway.agentCardJson.supportedInterfaces[0].url).toBe(
      `https://gateway.example.test/base${A2A_JSONRPC_PATH}`,
    );
    expect(gateway.agentCardJson.securitySchemes.bearerAuth).toEqual({
      httpAuthSecurityScheme: expect.objectContaining({
        scheme: "Bearer",
        bearerFormat: "token",
      }),
    });
    expect(gateway.agentCardJson.securityRequirements).toEqual([
      { schemes: { bearerAuth: {} } },
    ]);
  });

  it("rejects unsafe public URLs and non-text message parts", () => {
    expect(() => createGateway({
      A2A_PUBLIC_BASE_URL: "https://user:secret@gateway.example.test",
    })).toThrow("without credentials");

    expect(() => a2aGatewayInternals.readTextMessage({
      parts: [{
        content: { $case: "raw", value: new Uint8Array([1]) },
        mediaType: "application/octet-stream",
      }],
    })).toThrow("text/plain");
  });

  it("marks terminal-task lease rejection as non-retryable", () => {
    expect(a2aGatewayInternals.a2aExecutionLeaseError(
      "A2A_EXECUTION_TASK_TERMINAL",
      "already terminal",
    )).toMatchObject({
      code: "A2A_EXECUTION_TASK_TERMINAL",
      retryable: false,
    });
  });
});

describe("A2A gateway executor — fake-provider safety boundary", () => {
  function requestContext({ executionMode, permissions } = {}) {
    return {
      contextId: "ctx-1",
      taskId: "task-1",
      request: {
        metadata: executionMode ? { unifiedAi: { executionMode } } : {},
      },
      context: {
        tenant: "tenant-a",
        user: {
          isAuthenticated: true,
          userName: "test-user",
          permissions: permissions ?? [],
        },
      },
      userMessage: {
        parts: [{ content: { $case: "text", value: "hello" }, mediaType: "text/plain" }],
      },
    };
  }

  function routedCore(kind, realEnabled = true, primaryType = "fake") {
    const primary = createFakeProvider({ providerId: "local-fake-provider", modelId: "local-fake-model", providerType: primaryType,
      priority: 1, enabled: true, capabilities: ["chat"] });
    // This is an in-memory fake implementation, only its type metadata differs.
    const secondary = createFakeProvider({ providerId: "nonfake-metadata-mock", modelId: "local-fake-model", providerType: "openai",
      priority: 2, enabled: true, capabilities: ["chat"] });
    const reply = { text: "local fixture", message: { role: "assistant", content: "local fixture" },
      usage: { inputTokens: 5, outputTokens: 7, totalTokens: 12 }, raw: {}, warnings: [] };
    const primaryCall = vi.spyOn(primary, "generate").mockResolvedValue(reply);
    const secondaryCall = vi.spyOn(secondary, "generate").mockResolvedValue(reply);
    const registry = new ProviderRegistry(); registry.register(primary); registry.register(secondary);
    const policy = createWeightedTrafficPolicy({ random: () => 0, env: { AI_GATEWAY_WEIGHTED_ROUTES_JSON: JSON.stringify([{
      name: "a2a-fake-boundary", match: { source: "a2a-v1" },
      weights: kind === "weighted" ? { "nonfake-metadata-mock": 100 } : {},
      ...(kind === "shadow" ? { shadow: { providerId: "nonfake-metadata-mock", percent: 100 } } : {}),
    }]) } });
    const shadow = vi.spyOn(policy, "shouldShadow");
    const gateway = new GatewayService({ providerRegistry: registry, weightedTrafficPolicy: policy,
      runtimeConfig: { providerMode: realEnabled ? "real" : "fake", realProviderEnabled: realEnabled,
        shadowRealProviderEnabled: realEnabled, enabledProviders: ["local-fake-provider", "nonfake-metadata-mock"], fallbackEnabled: true },
      enterpriseAudit: { recordAudit: async () => {} }, requestLogger: { assertDurable: () => true, log: async () => {} } });
    return { gateway, primaryCall, secondaryCall, shadow };
  }

  it.each([true, false])("prevents weighted routing from escaping fake-only execution (global real=%s)", async realEnabled => {
    const f = routedCore("weighted", realEnabled);
    const executor = new a2aGatewayInternals.GatewayAgentExecutor(f.gateway);
    await executor.execute(requestContext(), { publish: vi.fn() });
    expect(f.primaryCall).toHaveBeenCalledOnce(); expect(f.secondaryCall).not.toHaveBeenCalled();
  });

  it("prevents shadow dispatch before returning a successful fake result", async () => {
    const f = routedCore("shadow");
    const executor = new a2aGatewayInternals.GatewayAgentExecutor(f.gateway);
    await executor.execute(requestContext(), { publish: vi.fn() });
    expect(f.primaryCall).toHaveBeenCalledOnce(); expect(f.shadow).not.toHaveBeenCalled();
    expect(f.secondaryCall).not.toHaveBeenCalled();
  });

  it("rejects a fake-looking provider id with non-fake type before calling either adapter", async () => {
    const f = routedCore("plain", true, "openai");
    const executor = new a2aGatewayInternals.GatewayAgentExecutor(f.gateway);
    const eventBus = { publish: vi.fn() };
    await executor.execute(requestContext(), eventBus);
    expect(eventBus.publish.mock.calls.map(([event]) => event)
      .filter(event => event.kind === "statusUpdate" && event.data.status.state === 4)).toHaveLength(1);
    expect(f.primaryCall).not.toHaveBeenCalled(); expect(f.secondaryCall).not.toHaveBeenCalled();
  });

  it("does not accept JSON lookalikes as a private fake-only binding for ordinary Gateway calls", async () => {
    const f = routedCore("weighted");
    const result = await f.gateway.execute({ messages: [{ role: "user", content: "fixture" }],
      providerId: "local-fake-provider", model: "local-fake-model", metadata: { source: "a2a-v1", fakeProviderOnly: true } },
    { fakeProviderOnly: true });
    expect(result.success).toBe(true); expect(f.secondaryCall).toHaveBeenCalledOnce();
  });

  it("rejects a result that is not proven fake-provider", async () => {
    const gatewayService = {
      execute: vi.fn(async () => ({
        success: true,
        data: { executionMode: "real", selectedProvider: "openai", outputText: "hi" },
      })),
    };
    const executor = new a2aGatewayInternals.GatewayAgentExecutor(gatewayService);
    const eventBus = { publish: vi.fn() };

    await expect(executor.execute(requestContext(), eventBus))
      .rejects.toThrow("fake-provider proof");
  });

  it("completes when the gateway returns proven fake execution", async () => {
    const gatewayService = {
      execute: vi.fn(async () => ({
        success: true,
        data: {
          executionMode: "fake",
          selectedProvider: "local-fake-provider",
          outputText: "fake reply",
        },
      })),
    };
    const executor = new a2aGatewayInternals.GatewayAgentExecutor(gatewayService);
    const eventBus = { publish: vi.fn() };

    await executor.execute(requestContext(), eventBus);

    expect(eventBus.publish).toHaveBeenCalled();
    const allCalls = JSON.stringify(eventBus.publish.mock.calls);
    expect(allCalls).toContain("fake reply");
    expect(allCalls).toContain('"state":3'); // TASK_STATE_COMPLETED
  });

  it("denies client-selected workforce mode without server-derived workflow permission", async () => {
    const gatewayService = { execute: vi.fn() };
    const workforceExecutor = { execute: vi.fn() };
    const executor = new a2aGatewayInternals.GatewayAgentExecutor(
      gatewayService,
      workforceExecutor,
    );
    const eventBus = { publish: vi.fn() };

    await expect(executor.execute(
      requestContext({ executionMode: "workforce", permissions: ["chat:use"] }),
      eventBus,
    )).rejects.toMatchObject({
      code: "a2a_workforce_permission_required",
    });
    expect(workforceExecutor.execute).not.toHaveBeenCalled();
    expect(gatewayService.execute).not.toHaveBeenCalled();
  });

  it("allows workforce mode only with workflow:run permission", async () => {
    const gatewayService = { execute: vi.fn() };
    const workforceExecutor = {
      execute: vi.fn(async () => ({
        goal: "hello",
        status: "completed",
        llmDriven: false,
        roleOutputs: { reviewer: { summary: "reviewed" } },
      })),
    };
    const executor = new a2aGatewayInternals.GatewayAgentExecutor(
      gatewayService,
      workforceExecutor,
    );
    const eventBus = { publish: vi.fn() };

    await executor.execute(
      requestContext({ executionMode: "workforce", permissions: ["chat:use", "workflow:run"] }),
      eventBus,
    );

    expect(workforceExecutor.execute).toHaveBeenCalledOnce();
    expect(gatewayService.execute).not.toHaveBeenCalled();
    expect(JSON.stringify(eventBus.publish.mock.calls)).toContain("reviewed");
  });

  it("acquires and validates a fenced lease without exposing its token", async () => {
    const order = [];
    const lease = {
      mode: "postgres-fenced",
      token: "raw-lease-token-must-not-leak",
      fencingToken: "42",
      expiresAt: "2026-08-24T00:05:00.000Z",
      identity: {
        planId: "opaque-plan",
        taskId: "task-1",
        agentId: "instance-1",
        fencingToken: "42",
      },
    };
    const leaseManager = {
      status: {
        enabled: true,
        mode: "postgres-fenced",
        heartbeatMs: 60_000,
      },
      acquire: vi.fn(async () => {
        order.push("acquire");
        return { success: true, lease };
      }),
      validate: vi.fn(async () => {
        order.push("validate");
        return { success: true, code: "valid" };
      }),
      renew: vi.fn(async () => ({ success: true, code: "renewed" })),
      release: vi.fn(async () => {
        order.push("release");
        return { success: true, code: "released" };
      }),
      revokeForTask: vi.fn(),
    };
    const gatewayService = {
      execute: vi.fn(async () => {
        order.push("execute");
        return {
          success: true,
          data: {
            executionMode: "fake",
            selectedProvider: "local-fake-provider",
            selectedModel: "local-fake-model",
            outputText: "fenced fake reply",
          },
        };
      }),
    };
    const executor = new a2aGatewayInternals.GatewayAgentExecutor(
      gatewayService,
      null,
      leaseManager,
    );
    const eventBus = { publish: vi.fn() };

    await executor.execute(requestContext(), eventBus);

    expect(leaseManager.acquire).toHaveBeenCalledWith({
      taskId: "task-1",
      scope: { tenant: "tenant-a", owner: "test-user" },
    });
    expect(order).toEqual(["acquire", "validate", "execute", "validate", "release"]);
    const published = JSON.stringify(eventBus.publish.mock.calls);
    expect(published).toContain("postgres-fenced");
    expect(published).not.toContain(lease.token);
    expect(published).not.toContain('"fencingToken":"42"');
  });

  it("rejects a duplicate active execution before calling the gateway", async () => {
    const gatewayService = { execute: vi.fn() };
    const leaseManager = {
      status: { enabled: true, mode: "postgres-fenced", heartbeatMs: 60_000 },
      acquire: vi.fn(async () => ({
        success: false,
        code: "A2A_EXECUTION_ALREADY_ACTIVE",
        reason: "already active",
      })),
    };
    const executor = new a2aGatewayInternals.GatewayAgentExecutor(
      gatewayService,
      null,
      leaseManager,
    );
    const eventBus = { publish: vi.fn() };

    await expect(executor.execute(requestContext(), eventBus)).rejects.toMatchObject({
      code: "A2A_EXECUTION_ALREADY_ACTIVE",
    });
    expect(gatewayService.execute).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
    await expect(executor.close()).resolves.toBeUndefined();
  });

  it("does not publish completion after the execution lease is lost", async () => {
    let validations = 0;
    const lease = {
      mode: "postgres-fenced",
      token: "lease-token",
      fencingToken: "9",
      identity: {},
    };
    const leaseManager = {
      status: { enabled: true, mode: "postgres-fenced", heartbeatMs: 60_000 },
      acquire: vi.fn(async () => ({ success: true, lease })),
      validate: vi.fn(async () => {
        validations += 1;
        return validations === 1
          ? { success: true, code: "valid" }
          : { success: false, code: "lost" };
      }),
      renew: vi.fn(),
      release: vi.fn(async () => ({ success: true, code: "released" })),
    };
    const gatewayService = {
      execute: vi.fn(async () => ({
        success: true,
        data: {
          executionMode: "fake",
          selectedProvider: "local-fake-provider",
          outputText: "must not commit",
        },
      })),
    };
    const executor = new a2aGatewayInternals.GatewayAgentExecutor(
      gatewayService,
      null,
      leaseManager,
    );
    const eventBus = { publish: vi.fn() };

    await expect(executor.execute(requestContext(), eventBus)).rejects.toMatchObject({
      code: "A2A_EXECUTION_LEASE_LOST",
    });
    const published = JSON.stringify(eventBus.publish.mock.calls);
    expect(published).not.toContain("must not commit");
    expect(published).not.toContain('"state":3');
  });

  it("uses server-derived cancellation scope to revoke a remote lease", async () => {
    const leaseManager = {
      status: { enabled: true, mode: "postgres-fenced", heartbeatMs: 60_000 },
      revokeForTask: vi.fn(async () => ({ success: true, code: "revoked" })),
    };
    const taskStore = {
      load: vi.fn(async () => ({ id: "task-1", contextId: "ctx-remote" })),
    };
    const executor = new a2aGatewayInternals.GatewayAgentExecutor(
      { execute: vi.fn() },
      null,
      leaseManager,
      taskStore,
    );
    const eventBus = { publish: vi.fn() };
    const context = requestContext().context;
    await executor.withCancellationContext(context, () => executor.cancelTask("task-1", eventBus));

    expect(leaseManager.revokeForTask).toHaveBeenCalledWith({
      taskId: "task-1",
      scope: { tenant: "tenant-a", owner: "test-user" },
      reason: "A2A client cancellation",
    });
    expect(taskStore.load).toHaveBeenCalledWith("task-1", context);
    expect(JSON.stringify(eventBus.publish.mock.calls)).toContain("ctx-remote");
    expect(JSON.stringify(eventBus.publish.mock.calls)).toContain('"state":5');
  });

  it("defers lease release to the atomic terminal store and finalizes after commit", async () => {
    const lease = {
      mode: "postgres-fenced",
      token: "atomic-token",
      fencingToken: "51",
      identity: {
        planId: "opaque-plan",
        taskId: "task-1",
        agentId: "instance-1",
        fencingToken: "51",
      },
    };
    const leaseManager = {
      status: {
        enabled: true,
        mode: "postgres-fenced",
        heartbeatMs: 60_000,
        atomicTerminalFence: true,
      },
      acquire: vi.fn(async () => ({ success: true, lease })),
      validate: vi.fn(async () => ({ success: true, code: "valid" })),
      renew: vi.fn(async () => ({ success: true, code: "renewed" })),
      release: vi.fn(async () => ({ success: true, code: "released" })),
    };
    let binding;
    let terminalFinalize = Promise.resolve();
    const taskStoreControl = {
      store: {},
      status: { atomicTerminalFence: true },
      checkHealth: vi.fn(async () => ({ available: true })),
      bindExecutionLease: vi.fn((input) => {
        binding = input;
      }),
      markExecutionFinished: vi.fn(),
    };
    const gatewayService = {
      execute: vi.fn(async () => ({
        success: true,
        data: {
          executionMode: "fake",
          selectedProvider: "local-fake-provider",
          outputText: "atomically fenced",
        },
      })),
    };
    const executor = new a2aGatewayInternals.GatewayAgentExecutor(
      gatewayService,
      null,
      leaseManager,
      taskStoreControl,
    );
    const eventBus = {
      publish: vi.fn((event) => {
        if (event?.kind === "statusUpdate" && event.data?.status?.state === 3) {
          terminalFinalize = Promise.resolve(binding.finalize(true));
        }
      }),
    };

    await executor.execute(requestContext(), eventBus);
    await terminalFinalize;

    expect(taskStoreControl.checkHealth).toHaveBeenCalled();
    expect(taskStoreControl.bindExecutionLease).toHaveBeenCalledWith(expect.objectContaining({
      taskId: "task-1",
      scope: { tenant: "tenant-a", owner: "test-user" },
      lease,
    }));
    expect(taskStoreControl.markExecutionFinished).toHaveBeenCalled();
    expect(leaseManager.release).not.toHaveBeenCalled();
  });

  it("uses the atomic task-store path for cross-replica cancellation", async () => {
    const persisted = {
      id: "task-1",
      contextId: "ctx-remote",
      status: { state: 2, timestamp: "2026-08-24T00:00:00.000Z" },
      history: [],
      artifacts: [],
    };
    const taskStoreControl = {
      store: { load: vi.fn(async () => persisted) },
      status: { atomicTerminalFence: true },
      cancelTaskAtomically: vi.fn(async (_taskId, _context, cancellationStatus) => ({
        ...persisted,
        status: cancellationStatus,
      })),
    };
    const executor = new a2aGatewayInternals.GatewayAgentExecutor(
      { execute: vi.fn() },
      null,
      { status: { enabled: true, atomicTerminalFence: true } },
      taskStoreControl,
    );
    const eventBus = { publish: vi.fn(), finished: vi.fn() };
    const context = requestContext().context;

    const cancelled = await executor.cancelTaskAtomically("task-1", context, eventBus);

    expect(taskStoreControl.cancelTaskAtomically).toHaveBeenCalledWith(
      "task-1",
      context,
      expect.objectContaining({ state: 5 }),
    );
    expect(cancelled).toMatchObject({ id: "task-1", status: { state: 5 } });
    expect(eventBus.publish).toHaveBeenCalled();
    expect(eventBus.finished).toHaveBeenCalled();
  });

  it("routes cancellation through the atomic boundary even without a local event bus", async () => {
    const cancelledTask = {
      id: "task-remote",
      contextId: "ctx-remote",
      status: { state: 5, timestamp: "2026-08-24T00:00:00.000Z" },
      history: [],
      artifacts: [],
    };
    const executor = {
      supportsAtomicCancellation: () => true,
      cancelTaskAtomically: vi.fn(async () => cancelledTask),
    };
    const handler = new a2aGatewayInternals.ContextAwareA2ARequestHandler(
      { capabilities: {} },
      { load: vi.fn(), save: vi.fn(), list: vi.fn() },
      executor,
    );
    const context = requestContext().context;

    await expect(handler.cancelTask({ id: "task-remote" }, context))
      .resolves.toBe(cancelledTask);
    expect(executor.cancelTaskAtomically).toHaveBeenCalledWith(
      "task-remote",
      context,
      undefined,
    );
  });

  it("keeps concurrent same-ID cancellations scoped until each request is released", async () => {
    function deferred() {
      let resolve;
      const promise = new Promise(done => { resolve = done; });
      return { promise, resolve };
    }
    const contextA = { tenant: "tenant-a", user: { userName: "owner-a" } };
    const contextB = { tenant: "tenant-b", user: { userName: "owner-b" } };
    const enteredA = deferred(); const enteredB = deferred();
    const resumeA = deferred(); const resumeB = deferred();
    const tasks = new Map([contextA, contextB].map((context, index) => [context, {
      id: "shared-task-id", contextId: `context-${index}`,
      status: { state: 2, timestamp: "2026-09-09T00:00:00.000Z" },
      history: [], artifacts: [], metadata: {},
    }]));
    const loadCounts = new Map();
    const store = {
      load: vi.fn(async (_taskId, context) => {
        const count = loadCounts.get(context) ?? 0; loadCounts.set(context, count + 1);
        if (count === 0 && context === contextA) { enteredA.resolve(); await resumeA.promise; }
        if (count === 0 && context === contextB) { enteredB.resolve(); await resumeB.promise; }
        return structuredClone(tasks.get(context) ?? null);
      }),
      save: vi.fn(async (task, context) => { tasks.set(context, structuredClone(task)); }),
    };
    const executor = new a2aGatewayInternals.GatewayAgentExecutor({ execute: vi.fn() }, null, null, store);
    const activeA = executor.invocations.begin(contextA, "shared-task-id", "context-0");
    const activeB = executor.invocations.begin(contextB, "shared-task-id", "context-1");
    const buses = new DefaultExecutionEventBusManager();
    buses.createOrGetByTaskId("shared-task-id");
    const handler = new a2aGatewayInternals.ContextAwareA2ARequestHandler(
      { capabilities: {} }, store, executor, buses,
    );
    const first = handler.cancelTask({ id: "shared-task-id" }, contextA);
    let second;
    try {
      await enteredA.promise;
      second = handler.cancelTask({ id: "shared-task-id" }, contextB);
      await enteredB.promise;
      resumeA.resolve();
      expect(await first).toMatchObject({ id: "shared-task-id", status: { state: 5 } });
      expect(activeA.execution.signal.aborted).toBe(true);
      // B's own scoped load remains blocked; A must not cancel its execution.
      expect(activeB.execution.signal.aborted).toBe(false);
    } finally {
      resumeA.resolve(); resumeB.resolve();
      await Promise.allSettled([first, second].filter(Boolean));
      activeA.finish(); activeB.finish();
      buses.cleanupByTaskId("shared-task-id");
    }
  });

  it("aborts in-flight work when lease renewal is lost and releases the lease", async () => {
    let signal;
    const gateway = { execute: vi.fn((_input, execution) => new Promise((_resolve, reject) => {
      signal = execution.signal; signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    })) };
    const leases = { status: { enabled: true, heartbeatMs: 5 },
      acquire: vi.fn(async () => ({ success: true, lease: { mode: "fixture" } })),
      validate: vi.fn(async () => ({ success: true })), renew: vi.fn(async () => ({ success: false })),
      release: vi.fn(async () => ({ success: true })) };
    const executor = new a2aGatewayInternals.GatewayAgentExecutor(gateway, null, leases);
    const bus = { publish: vi.fn() };
    await executor.execute(requestContext(), bus);
    expect(signal.aborted).toBe(true); expect(signal.reason.code).toBe("EXECUTION_LEASE_LOST");
    expect(leases.release).toHaveBeenCalledOnce(); expect(gateway.execute).toHaveBeenCalledOnce();
    expect(JSON.stringify(bus.publish.mock.calls)).toContain('"state":4');
    await executor.close();
  });

  it("keeps its execution deadline independently of normal transport completion", async () => {
    const context = requestContext(); let signal;
    bindA2AGatewayCall(context.context, undefined, { signal: new AbortController().signal, deadlineAt: Date.now() + 20 });
    const gateway = { execute: vi.fn((_input, execution) => new Promise((_resolve, reject) => {
      signal = execution.signal; signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    })) };
    const executor = new a2aGatewayInternals.GatewayAgentExecutor(gateway);
    await executor.execute(context, { publish: vi.fn() });
    expect(signal.aborted).toBe(true); expect(signal.reason.code).toBe("GATEWAY_DEADLINE_EXCEEDED");
    await executor.close();
  });

  it("closes only its own active calls even when another executor has the same task ID", async () => {
    const signals = [];
    const gateway = { execute: vi.fn((_input, execution) => new Promise((_resolve, reject) => {
      const signal = execution.signal; signals.push(signal);
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    })) };
    const first = new a2aGatewayInternals.GatewayAgentExecutor(gateway);
    const second = new a2aGatewayInternals.GatewayAgentExecutor(gateway);
    const calls = [first.execute(requestContext(), { publish: vi.fn() }), second.execute(requestContext(), { publish: vi.fn() })];
    try {
      await vi.waitFor(() => expect(signals).toHaveLength(2));
      await first.close(); await calls[0];
      expect(signals[0].aborted).toBe(true); expect(signals[0].reason.code).toBe("GATEWAY_SHUTDOWN");
      expect(signals[1].aborted).toBe(false);
    } finally { await second.close(); await Promise.allSettled(calls); }
    await expect(first.execute(requestContext(), { publish: vi.fn() })).rejects.toMatchObject({ code: "GATEWAY_SHUTDOWN" });
  });
});
